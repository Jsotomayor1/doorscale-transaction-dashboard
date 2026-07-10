import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "transaction-documents";
const CONTACTS_URL_BASE = "https://services.leadconnectorhq.com/contacts";
const API_VERSION = "2021-07-28";

type DocumentRow = {
  document_name?: string | null;
  document_type?: string | null;
  doorscale_file_id?: string | null;
  file_url?: string | null;
  id: string;
  location_id: string;
  transaction_id: string;
  uploaded_at?: string | null;
};

async function getDocumentFileUrl(
  supabase: SupabaseClient,
  document: DocumentRow,
) {
  if (document.file_url) return document.file_url;
  if (!document.doorscale_file_id) return "";

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(document.doorscale_file_id, 60 * 60 * 24 * 7);
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(document.doorscale_file_id);

  if (signedUrlError) {
    console.error("DoorScale document retry link creation failed:", {
      documentId: document.id,
      error: signedUrlError,
      filePath: document.doorscale_file_id,
      transactionId: document.transaction_id,
    });
  }

  return signedUrlData?.signedUrl || publicUrlData?.publicUrl || document.doorscale_file_id;
}

async function mirrorDocumentToGhlContact(input: {
  accessToken: string;
  contactId: string;
  documentId: string;
  fileUrl: string;
  locationId: string;
  transactionId: string;
}) {
  const endpoint = `${CONTACTS_URL_BASE}/${encodeURIComponent(input.contactId)}`;
  const body = {
    customFields: [
      {
        key: "transaction_documents",
        field_value: input.fileUrl,
      },
    ],
  };

  console.log("DoorScale contact document retry mirror request:", {
    contactIdExists: Boolean(input.contactId),
    documentId: input.documentId,
    endpoint,
    fileUrlAvailable: Boolean(input.fileUrl),
    locationId: input.locationId,
    transactionId: input.transactionId,
  });

  const mirrorResponse = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify(body),
  });
  const responseBody = await mirrorResponse.text();

  console.log("DoorScale contact document retry mirror response:", {
    body: responseBody,
    contactIdExists: Boolean(input.contactId),
    documentId: input.documentId,
    status: mirrorResponse.status,
  });

  return {
    ok: mirrorResponse.ok,
    message: responseBody || mirrorResponse.statusText,
    status: mirrorResponse.status,
  };
}

async function addDocumentNoteToGhlContact(input: {
  accessToken: string;
  contactId: string;
  documentName: string;
  fileUrl: string;
  locationId: string;
  propertyAddress?: string | null;
  uploadedAt?: string | null;
}) {
  const endpoint = `${CONTACTS_URL_BASE}/${encodeURIComponent(input.contactId)}/notes`;
  const body = {
    body: [
      `Document uploaded: ${input.documentName}`,
      input.propertyAddress ? `Transaction: ${input.propertyAddress}` : "",
      input.uploadedAt ? `Uploaded: ${input.uploadedAt}` : "",
      `File: ${input.fileUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };

  console.log("DoorScale contact document retry note request:", {
    contactIdExists: Boolean(input.contactId),
    endpoint,
    locationId: input.locationId,
  });

  const noteResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify(body),
  });
  const responseBody = await noteResponse.text();
  let noteId = "";

  try {
    const parsedBody = JSON.parse(responseBody) as {
      id?: string;
      note?: { id?: string; _id?: string };
    };
    noteId = parsedBody.id || parsedBody.note?.id || parsedBody.note?._id || "";
  } catch {
    noteId = "";
  }

  console.log("DoorScale contact document retry note response:", {
    body: responseBody,
    contactIdExists: Boolean(input.contactId),
    noteId: noteId || null,
    status: noteResponse.status,
  });

  return {
    ok: noteResponse.ok,
    message: responseBody || noteResponse.statusText,
    noteId,
    status: noteResponse.status,
  };
}

async function loadPendingMirrorDocuments(
  supabase: SupabaseClient,
  activeLocationId: string,
  transactionId: string,
) {
  const richSelect =
    "id, location_id, transaction_id, document_type, document_name, doorscale_file_id, file_url, uploaded_at, ghl_mirror_status";
  const baseSelect =
    "id, location_id, transaction_id, document_type, document_name, doorscale_file_id, uploaded_at";
  const richResult = await supabase
    .from("transaction_documents")
    .select(richSelect)
    .eq("location_id", activeLocationId)
    .eq("transaction_id", transactionId)
    .not("doorscale_file_id", "is", null)
    .or("ghl_mirror_status.neq.synced,ghl_mirror_status.is.null");

  if (!richResult.error) return (richResult.data ?? []) as DocumentRow[];

  console.log("DoorScale document mirror retry metadata columns unavailable; using base fields.", {
    activeLocationId,
    message: richResult.error.message,
    transactionId,
  });

  const baseResult = await supabase
    .from("transaction_documents")
    .select(baseSelect)
    .eq("location_id", activeLocationId)
    .eq("transaction_id", transactionId)
    .not("doorscale_file_id", "is", null);

  if (baseResult.error) {
    throw baseResult.error;
  }

  return (baseResult.data ?? []) as DocumentRow[];
}

export async function retryPendingDocumentMirrors(input: {
  accessToken: string;
  activeLocationId: string;
  contactId?: string | null;
  propertyAddress?: string | null;
  supabase: SupabaseClient;
  transactionId: string;
}) {
  const { activeLocationId, contactId, supabase, transactionId } = input;

  if (!contactId) {
    console.log("DoorScale document mirror retry pending; contact not synced yet.", {
      activeLocationId,
      transactionId,
    });

    await supabase
      .from("transaction_documents")
      .update({
        ghl_mirror_error: "Waiting for CRM contact sync.",
        ghl_mirror_status: "pending",
      })
      .eq("location_id", activeLocationId)
      .eq("transaction_id", transactionId)
      .neq("ghl_mirror_status", "synced");

    return {
      pending: 0,
      retried: 0,
      synced: 0,
    };
  }

  const documents = await loadPendingMirrorDocuments(
    supabase,
    activeLocationId,
    transactionId,
  );

  console.log("DoorScale document mirror retry started:", {
    activeLocationId,
    contactIdExists: Boolean(contactId),
    documentCount: documents.length,
    transactionId,
  });

  let synced = 0;

  for (const document of documents) {
    const fileUrl = await getDocumentFileUrl(supabase, document);
    const documentName =
      document.document_name || document.document_type || "Transaction document";

    if (!fileUrl) {
      await supabase
        .from("transaction_documents")
        .update({
          ghl_mirror_error: "Missing document file URL.",
          ghl_mirror_status: "pending",
        })
        .eq("id", document.id)
        .eq("location_id", activeLocationId);
      continue;
    }

    const mirrorResult = await mirrorDocumentToGhlContact({
      accessToken: input.accessToken,
      contactId,
      documentId: document.id,
      fileUrl,
      locationId: activeLocationId,
      transactionId,
    });
    const noteResult = await addDocumentNoteToGhlContact({
      accessToken: input.accessToken,
      contactId,
      documentName,
      fileUrl,
      locationId: activeLocationId,
      propertyAddress: input.propertyAddress,
      uploadedAt: document.uploaded_at,
    });
    const isSynced = mirrorResult.ok || noteResult.ok;

    await supabase
      .from("transaction_documents")
      .update({
        doorscale_contact_id: contactId,
        ghl_file_url: fileUrl,
        ghl_mirror_error: isSynced
          ? null
          : (mirrorResult.message || noteResult.message || "Document mirror pending.").slice(0, 500),
        ghl_mirror_status: isSynced ? "synced" : "pending",
      })
      .eq("id", document.id)
      .eq("location_id", activeLocationId);

    console.log("DoorScale document mirror retry final state:", {
      documentId: document.id,
      finalMirrorError: isSynced
        ? null
        : (mirrorResult.message || noteResult.message || "Document mirror pending.").slice(0, 500),
      finalMirrorStatus: isSynced ? "synced" : "pending",
      noteId: noteResult.noteId || null,
      transactionId,
    });

    if (isSynced) synced += 1;
  }

  console.log("DoorScale document mirror retry finished:", {
    activeLocationId,
    retried: documents.length,
    synced,
    transactionId,
  });

  return {
    pending: documents.length - synced,
    retried: documents.length,
    synced,
  };
}
