import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getActiveLocation, getRequestedLocationId } from "./_active-location.js";

const API_VERSION = "2021-07-28";
const CONTACTS_URL_BASE = "https://services.leadconnectorhq.com/contacts";

type NotesBody = {
  action?: string;
  active_location_id?: string;
  body?: string;
  locationId?: string;
  note?: string;
  transactionId?: string;
};

type TransactionRow = {
  contact_id?: string | null;
  ghl_contact_id?: string | null;
  location_id: string;
};

type GhlNote = {
  _id?: string;
  body?: string;
  contactId?: string;
  createdAt?: string;
  dateAdded?: string;
  id?: string;
  note?: string;
  updatedAt?: string;
};

function resolveContactId(transaction: TransactionRow | null) {
  return transaction?.ghl_contact_id || transaction?.contact_id || "";
}

function normalizeNote(note: GhlNote, transactionId: string, contactId: string) {
  return {
    body: note.body || note.note || "",
    contactId: note.contactId || contactId,
    createdAt: note.createdAt || note.dateAdded || note.updatedAt || new Date().toISOString(),
    id: note.id || note._id || `crm-note-${Date.now()}`,
    source: "CRM",
    syncStatus: "synced",
    transactionId,
  };
}

function extractNotes(payload: unknown): GhlNote[] {
  if (Array.isArray(payload)) return payload as GhlNote[];

  const body = payload as {
    data?: GhlNote[];
    notes?: GhlNote[];
    results?: GhlNote[];
  };

  return body.notes || body.data || body.results || [];
}

function parseNoteId(payload: unknown) {
  const body = payload as {
    _id?: string;
    id?: string;
    note?: { _id?: string; id?: string };
  };

  return body.id || body._id || body.note?.id || body.note?._id || "";
}

async function loadTransaction(
  supabase: ReturnType<typeof createClient>,
  transactionId: string,
  activeLocationId: string,
) {
  const { data, error } = await supabase
    .from("transactions")
    .select("location_id, contact_id, ghl_contact_id")
    .eq("id", transactionId)
    .eq("location_id", activeLocationId)
    .maybeSingle();

  if (error) {
    console.error("DoorScale notes transaction lookup failed:", {
      error,
      transactionId,
    });
    throw new Error("transaction_lookup_failed");
  }

  return (data as TransactionRow | null) ?? null;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "This note action is not available." });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ ok: false, message: "Unable to load notes." });
    return;
  }

  const body = (request.body ?? {}) as NotesBody;
  const noteAction = body.action === "createNote" ? "create" : "fetch";
  const transactionId = body.transactionId || "";
  const activeLocationId = getRequestedLocationId(request);

  if (!transactionId || !activeLocationId) {
    response.status(400).json({ ok: false, message: "Note details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const transaction = await loadTransaction(supabase, transactionId, activeLocationId);
  const contactId = resolveContactId(transaction);

  console.log("DoorScale notes request:", {
    contactIdResolved: Boolean(contactId),
    noteAction,
    routeName: "/api/ghl/notes",
    transactionId,
  });

  if (!transaction || !contactId) {
    response.status(200).json({
      note:
        noteAction === "create"
          ? {
              body: body.body || body.note || "",
              contactId: "",
              createdAt: new Date().toISOString(),
              id: `pending-note-${transactionId}-${Date.now()}`,
              source: "DoorScale",
              syncStatus: "pending_sync",
              transactionId,
            }
          : undefined,
      notes: [],
      ok: false,
      pending: true,
      message: "Waiting for CRM contact sync.",
    });
    return;
  }

  const connectedAccount = await getActiveLocation(request, supabase, "/api/ghl/notes");
  const endpoint = `${CONTACTS_URL_BASE}/${encodeURIComponent(contactId)}/notes`;

  if (noteAction === "create") {
    const noteBody = (body.body || body.note || "").trim();

    if (!noteBody) {
      response.status(400).json({ ok: false, message: "Note is required." });
      return;
    }

    console.log("DoorScale note create request:", {
      contactIdResolved: Boolean(contactId),
      endpoint,
      transactionId,
    });

    const noteResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${connectedAccount.access_token}`,
        "Content-Type": "application/json",
        Version: API_VERSION,
      },
      body: JSON.stringify({ body: noteBody }),
    });
    const responseBody = await noteResponse.text();
    let parsedBody: unknown = {};

    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = {};
    }

    const noteId = parseNoteId(parsedBody);

    console.log("DoorScale note create response:", {
      contactIdResolved: Boolean(contactId),
      noteId: noteId || null,
      responseStatus: noteResponse.status,
      transactionId,
    });

    if (!noteResponse.ok) {
      response.status(noteResponse.status).json({
        ok: false,
        message: responseBody || "Unable to save note.",
      });
      return;
    }

    response.status(200).json({
      note: {
        body: noteBody,
        contactId,
        createdAt: new Date().toISOString(),
        id: noteId || `crm-note-${transactionId}-${Date.now()}`,
        source: "DoorScale",
        syncStatus: "synced",
        transactionId,
      },
      ok: true,
      message: "Note saved.",
    });
    return;
  }

  console.log("DoorScale note fetch request:", {
    contactIdResolved: Boolean(contactId),
    endpoint,
    transactionId,
  });

  const notesResponse = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${connectedAccount.access_token}`,
      Version: API_VERSION,
    },
  });
  const responseBody = await notesResponse.text();
  let parsedBody: unknown = {};

  try {
    parsedBody = JSON.parse(responseBody);
  } catch {
    parsedBody = {};
  }

  const notes = extractNotes(parsedBody)
    .map((note) => normalizeNote(note, transactionId, contactId))
    .filter((note) => note.body);

  console.log("DoorScale note fetch response:", {
    contactIdResolved: Boolean(contactId),
    noteFetchCount: notes.length,
    responseStatus: notesResponse.status,
    transactionId,
  });

  if (!notesResponse.ok) {
    response.status(notesResponse.status).json({
      ok: false,
      message: responseBody || "Unable to load notes.",
      notes: [],
    });
    return;
  }

  response.status(200).json({ notes, ok: true });
}
