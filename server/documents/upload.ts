import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getActiveLocation } from "../ghl/_active-location.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const BUCKET_NAME = "transaction-documents";
const CONTACTS_URL_BASE = "https://services.leadconnectorhq.com/contacts";
const API_VERSION = "2021-07-28";

type MultipartPart = {
  contentType: string;
  data: Buffer;
  filename: string;
  name: string;
};

type TransactionRow = {
  ghl_contact_id?: string | null;
  ghl_opportunity_id?: string | null;
  id: string;
  location_id: string;
  stage?: string | null;
  transaction_type?: string | null;
};

type DocumentRow = {
  doorscale_contact_id?: string | null;
  document_type?: string | null;
  id: string;
  location_id: string;
  transaction_id: string;
};

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("service_connection_not_configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function getBoundary(contentType = "") {
  return contentType
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("boundary="))
    ?.replace("boundary=", "")
    .replace(/^"|"$/g, "");
}

async function readRequestBuffer(request: VercelRequest) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function parseDisposition(value = "") {
  return Object.fromEntries(
    value
      .split(";")
      .map((part) => part.trim())
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, rest.join("=").replace(/^"|"$/g, "")];
      })
      .filter(([key]) => Boolean(key)),
  ) as Record<string, string>;
}

function parseMultipart(buffer: Buffer, boundary: string) {
  const body = buffer.toString("binary");
  const delimiter = `--${boundary}`;
  const fields: Record<string, string> = {};
  const files: MultipartPart[] = [];

  body.split(delimiter).forEach((part) => {
    if (!part || part === "--\r\n" || part === "--") return;

    const trimmedPart = part.startsWith("\r\n") ? part.slice(2) : part;
    const headerEndIndex = trimmedPart.indexOf("\r\n\r\n");

    if (headerEndIndex === -1) return;

    const rawHeaders = trimmedPart.slice(0, headerEndIndex);
    let rawData = trimmedPart.slice(headerEndIndex + 4);

    if (rawData.endsWith("\r\n")) rawData = rawData.slice(0, -2);
    if (rawData.endsWith("--")) rawData = rawData.slice(0, -2);

    const headers = Object.fromEntries(
      rawHeaders.split("\r\n").map((line) => {
        const separatorIndex = line.indexOf(":");
        const name = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();

        return [name, value];
      }),
    ) as Record<string, string>;
    const disposition = parseDisposition(headers["content-disposition"]);
    const name = disposition.name;

    if (!name) return;

    if (disposition.filename) {
      files.push({
        contentType: headers["content-type"] || "application/octet-stream",
        data: Buffer.from(rawData, "binary"),
        filename: disposition.filename,
        name,
      });
      return;
    }

    fields[name] = Buffer.from(rawData, "binary").toString("utf8");
  });

  return { fields, files };
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "document";
}

async function mirrorDocumentToGhlContact(input: {
  accessToken: string;
  contactId?: string | null;
  documentId: string;
  fileUrl: string;
  locationId: string;
  transactionId: string;
}) {
  if (!input.contactId || !input.fileUrl) {
    console.log("DoorScale contact document mirror skipped:", {
      contactId: input.contactId || null,
      documentId: input.documentId,
      fileUrlAvailable: Boolean(input.fileUrl),
      locationId: input.locationId,
      transactionId: input.transactionId,
    });
    return {
      ok: false,
      message: !input.contactId ? "Missing contact id." : "Missing file URL.",
      status: 0,
    };
  }

  const endpoint = `${CONTACTS_URL_BASE}/${encodeURIComponent(input.contactId)}`;
  const body = {
    customFields: [
      {
        key: "transaction_documents",
        field_value: input.fileUrl,
      },
    ],
  };

  console.log("DoorScale contact document mirror request:", {
    contactId: input.contactId || null,
    documentId: input.documentId,
    endpoint,
    fileUrl: input.fileUrl,
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

  console.log("DoorScale contact document mirror response:", {
    body: responseBody,
    contactId: input.contactId,
    documentId: input.documentId,
    status: mirrorResponse.status,
  });

  return {
    ok: mirrorResponse.ok,
    message: responseBody || mirrorResponse.statusText,
    status: mirrorResponse.status,
  };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    return response.status(405).json({
      message: "This document action is not available.",
      ok: false,
    });
  }

  try {
    const supabase = getSupabaseServiceClient();
    const activeLocation = await getActiveLocation(
      request,
      supabase,
      "/api/documents/upload",
    );
    const contentType = request.headers["content-type"];
    const boundary = getBoundary(Array.isArray(contentType) ? contentType[0] : contentType);

    if (!boundary) {
      return response.status(400).json({
        message: "Choose a document file to upload.",
        ok: false,
      });
    }

    const requestBuffer = await readRequestBuffer(request);
    const { fields, files } = parseMultipart(requestBuffer, boundary);
    let documentId = (fields.document_id || fields.documentId)?.trim();
    const transactionId = (fields.transaction_id || fields.transactionId)?.trim();
    const documentType =
      fields.documentType?.trim() ||
      fields.document_type?.trim() ||
      fields.documentName?.trim() ||
      fields.document_name?.trim();
    const file = files.find((currentFile) => currentFile.name === "file");

    console.log("DoorScale document action received:", {
      activeLocationId: activeLocation.activeLocationId,
      action: "upload",
      document_id: documentId || null,
      routeName: "/api/documents/upload",
      transaction_id: transactionId || null,
      uploadFileName: file?.filename || null,
    });

    if (!transactionId || !documentType || !file?.data.length) {
      return response.status(400).json({
        message: "Choose a document file to upload.",
        ok: false,
      });
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id, location_id, ghl_contact_id, ghl_opportunity_id, stage, transaction_type")
      .eq("id", transactionId)
      .eq("location_id", activeLocation.activeLocationId)
      .maybeSingle();

    if (transactionError) {
      console.error("DoorScale document transaction lookup failed:", {
        activeLocationId: activeLocation.activeLocationId,
        error: transactionError,
        transactionId,
      });
      return response.status(500).json({
        message: "Unable to upload document.",
        ok: false,
      });
    }

    const transactionRow = transaction as TransactionRow | null;

    if (!transactionRow) {
      return response.status(404).json({
        message: "Transaction not found.",
        ok: false,
      });
    }

    let documentRow: unknown = null;

    if (documentId) {
      const { data: existingDocumentRow, error: documentLookupError } = await supabase
        .from("transaction_documents")
        .select("id, transaction_id, document_type, location_id, doorscale_contact_id")
        .eq("id", documentId)
        .eq("transaction_id", transactionId)
        .eq("location_id", activeLocation.activeLocationId)
        .maybeSingle();

      if (documentLookupError) {
        console.error("DoorScale document checklist lookup failed:", {
          activeLocationId: activeLocation.activeLocationId,
          documentId,
          error: documentLookupError,
          transactionId,
        });
        return response.status(500).json({
          message: "Unable to upload document.",
          ok: false,
        });
      }

      documentRow = existingDocumentRow;
    }

    if (!documentRow) {
      const { data: createdDocumentRow, error: createDocumentError } = await supabase
        .from("transaction_documents")
        .insert({
          document_name: documentType,
          document_type: documentType,
          doorscale_contact_id: transactionRow.ghl_contact_id ?? null,
          location_id: activeLocation.activeLocationId,
          status: "needed",
          transaction_id: transactionId,
        })
        .select("id, transaction_id, document_type, location_id, doorscale_contact_id")
        .single();

      if (createDocumentError || !createdDocumentRow) {
        console.error("DoorScale manual document row create failed:", {
          activeLocationId: activeLocation.activeLocationId,
          error: createDocumentError,
          transactionId,
        });
        return response.status(500).json({
          message: "Unable to upload document.",
          ok: false,
        });
      }

      documentRow = createdDocumentRow;
      documentId = String(createdDocumentRow.id);
    }

    const documentRecord = documentRow as DocumentRow;
    const timestamp = Date.now();
    const fileName = file.filename || "document";
    const filePath = [
      sanitizePathSegment(activeLocation.activeLocationId),
      sanitizePathSegment(transactionId),
      sanitizePathSegment(documentId),
      `${timestamp}-${sanitizePathSegment(fileName)}`,
    ].join("/");

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.data, {
        contentType: file.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("DoorScale document upload failed:", {
        activeLocationId: activeLocation.activeLocationId,
        error: uploadError,
        filePath,
        transactionId,
      });
      return response.status(500).json({
        message: "Unable to upload document.",
        ok: false,
      });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (signedUrlError) {
      console.error("DoorScale document link creation failed:", {
        activeLocationId: activeLocation.activeLocationId,
        error: signedUrlError,
        filePath,
      });
    }

    const fileUrl = signedUrlData?.signedUrl || publicUrlData?.publicUrl || filePath;
    console.log("DoorScale document file URL generated:", {
      activeLocationId: activeLocation.activeLocationId,
      documentId,
      fileUrl,
      transactionId,
    });

    const contactId =
      documentRecord.doorscale_contact_id || transactionRow.ghl_contact_id || null;
    const uploadedAt = new Date().toISOString();
    const payload = {
      doorscale_file_id: filePath,
      document_name: documentType,
      doorscale_contact_id: contactId,
      location_id: activeLocation.activeLocationId,
      status: "uploaded",
      transaction_id: transactionId,
      uploaded_at: uploadedAt,
    };
    const { data: updatedDocument, error: updateError } = await supabase
      .from("transaction_documents")
      .update(payload)
      .eq("id", documentId)
      .eq("transaction_id", transactionId)
      .eq("location_id", activeLocation.activeLocationId)
      .select(
        "id, transaction_id, document_type, document_name, delivery_type, doorscale_file_id, doorscale_contact_id, status, uploaded_at, created_at, workflow_name, workflow_trigger_tag",
      )
      .single();

    if (updateError) {
      console.error("DoorScale document metadata update failed:", {
        activeLocationId: activeLocation.activeLocationId,
        documentId,
        error: updateError,
        transactionId,
      });
      return response.status(500).json({
        message: "Unable to save uploaded document.",
        ok: false,
      });
    }

    console.log("DoorScale document metadata update result:", {
      activeLocationId: activeLocation.activeLocationId,
      documentId,
      status: updatedDocument?.status ?? null,
      transactionId,
      updatedDocumentId: updatedDocument?.id ?? null,
    });

    const optionalMetadata = {
      file_name: fileName,
      file_path: filePath,
      file_url: fileUrl,
      ghl_contact_id: transactionRow.ghl_contact_id ?? null,
      ghl_opportunity_id: transactionRow.ghl_opportunity_id ?? null,
      uploaded_by: "DoorScale",
    };
    const { error: optionalMetadataError } = await supabase
      .from("transaction_documents")
      .update(optionalMetadata)
      .eq("id", documentId)
      .eq("transaction_id", transactionId)
      .eq("location_id", activeLocation.activeLocationId);

    if (optionalMetadataError) {
      console.log("DoorScale optional document metadata skipped:", {
        activeLocationId: activeLocation.activeLocationId,
        documentId,
        message: optionalMetadataError.message,
        transactionId,
      });
    }

    let mirrorStatus = "skipped";
    let mirrorError = "";

    try {
      const mirrorResult = await mirrorDocumentToGhlContact({
        accessToken: activeLocation.access_token,
        contactId,
        documentId,
        fileUrl,
        locationId: activeLocation.activeLocationId,
        transactionId,
      });

      mirrorStatus = mirrorResult.ok ? "synced" : "failed";
      mirrorError = mirrorResult.ok ? "" : mirrorResult.message.slice(0, 500);
    } catch (mirrorException) {
      mirrorStatus = "failed";
      const message =
        mirrorException instanceof Error
          ? mirrorException.message
          : "Unable to mirror document.";
      console.error("DoorScale document mirror skipped:", {
        activeLocationId: activeLocation.activeLocationId,
        documentId,
        error: mirrorException,
        transactionId,
      });
      mirrorError = message.slice(0, 500);
    }

    const { error: mirrorMetadataError } = await supabase
      .from("transaction_documents")
      .update({
        ghl_file_url: fileUrl,
        ghl_mirror_error: mirrorError || null,
        ghl_mirror_status: mirrorStatus,
      })
      .eq("id", documentId)
      .eq("transaction_id", transactionId)
      .eq("location_id", activeLocation.activeLocationId);

    if (mirrorMetadataError) {
      console.log("DoorScale document mirror metadata skipped:", {
        activeLocationId: activeLocation.activeLocationId,
        documentId,
        message: mirrorMetadataError.message,
        transactionId,
      });
    }

    console.log("DoorScale document upload completed:", {
      activeLocationId: activeLocation.activeLocationId,
      documentId,
      filePath,
      routeName: "/api/documents/upload",
      transactionId,
    });

    return response.status(200).json({
      document: {
        ...(updatedDocument ?? {}),
        fileName,
        filePath,
        fileUrl,
      },
      message: "Document uploaded.",
      ok: true,
    });
  } catch (error) {
    console.error("DoorScale document upload route failed:", error);
    return response.status(500).json({
      message: "Unable to upload document.",
      ok: false,
    });
  }
}
