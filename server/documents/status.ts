import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getActiveLocation } from "../ghl/_active-location.js";

type StatusBody = {
  document_id?: string;
  documentId?: string;
  status?: string;
  transaction_id?: string;
  transactionId?: string;
};

const ALLOWED_STATUSES = new Set([
  "needed",
  "sent",
  "viewed",
  "completed",
  "uploaded",
  "pending_review",
  "approved",
  "rejected",
  "missing",
]);

function normalizeStatus(status = "") {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("service_connection_not_configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
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
    const body = (request.body ?? {}) as StatusBody;
    const documentId = (body.document_id || body.documentId || "").trim();
    const transactionId = (body.transaction_id || body.transactionId || "").trim();
    const status = normalizeStatus(body.status);

    if (!documentId || !ALLOWED_STATUSES.has(status)) {
      return response.status(400).json({
        message: "Document status is missing.",
        ok: false,
      });
    }

    const supabase = getSupabaseServiceClient();
    const activeLocation = await getActiveLocation(
      request,
      supabase,
      "/api/documents/status",
    );
    console.log("DoorScale document action received:", {
      activeLocationId: activeLocation.activeLocationId,
      action: "updateStatus",
      document_id: documentId,
      routeName: "/api/documents/status",
      status,
      transaction_id: transactionId || null,
    });

    let query = supabase
      .from("transaction_documents")
      .update({ status })
      .eq("id", documentId)
      .eq("location_id", activeLocation.activeLocationId);

    if (transactionId) {
      query = query.eq("transaction_id", transactionId);
    }

    const { data: updatedDocument, error } = await query
      .select(
        "id, transaction_id, document_type, document_name, delivery_type, doorscale_file_id, doorscale_contact_id, status, uploaded_at, created_at, workflow_name, workflow_trigger_tag",
      )
      .single();

    if (error) {
      console.error("DoorScale document status update failed:", {
        activeLocationId: activeLocation.activeLocationId,
        documentId,
        error,
        transactionId: transactionId || null,
      });
      return response.status(500).json({
        message: "Unable to update document status.",
        ok: false,
      });
    }

    console.log("DoorScale document status updated:", {
      activeLocationId: activeLocation.activeLocationId,
      documentId,
      routeName: "/api/documents/status",
      status,
      transactionId: transactionId || null,
      updatedDocumentId: updatedDocument?.id ?? null,
    });

    return response.status(200).json({
      document: updatedDocument,
      ok: true,
    });
  } catch (error) {
    console.error("DoorScale document status route failed:", error);
    return response.status(500).json({
      message: "Unable to update document status.",
      ok: false,
    });
  }
}
