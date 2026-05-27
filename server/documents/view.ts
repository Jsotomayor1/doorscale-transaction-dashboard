import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getActiveLocation } from "../ghl/_active-location.js";

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
  if (request.method !== "GET") {
    return response.status(405).json({
      message: "This document action is not available.",
      ok: false,
    });
  }

  try {
    const documentId = String(request.query.document_id || "").trim();
    const transactionId = String(request.query.transaction_id || "").trim();

    if (!documentId || !transactionId) {
      return response.status(400).json({
        message: "Document details are missing.",
        ok: false,
      });
    }

    const supabase = getSupabaseServiceClient();
    const activeLocation = await getActiveLocation(
      request,
      supabase,
      "/api/documents/view",
    );

    const { data: documentRow, error } = await supabase
      .from("transaction_documents")
      .select("doorscale_file_id")
      .eq("id", documentId)
      .eq("transaction_id", transactionId)
      .eq("location_id", activeLocation.activeLocationId)
      .maybeSingle();

    if (error) {
      console.error("DoorScale document view lookup failed:", {
        activeLocationId: activeLocation.activeLocationId,
        documentId,
        error,
        transactionId,
      });
      return response.status(500).json({
        message: "Unable to open document.",
        ok: false,
      });
    }

    const filePath = documentRow?.doorscale_file_id?.trim();

    if (!filePath) {
      return response.status(404).json({
        message: "Document file not found.",
        ok: false,
      });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("transaction-documents")
      .createSignedUrl(filePath, 60 * 15);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("DoorScale document view link failed:", {
        activeLocationId: activeLocation.activeLocationId,
        documentId,
        error: signedUrlError,
        transactionId,
      });
      return response.status(500).json({
        message: "Unable to open document.",
        ok: false,
      });
    }

    return response.redirect(302, signedUrlData.signedUrl);
  } catch (error) {
    console.error("DoorScale document view route failed:", error);
    return response.status(500).json({
      message: "Unable to open document.",
      ok: false,
    });
  }
}
