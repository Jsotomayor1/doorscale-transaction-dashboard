import type { VercelRequest, VercelResponse } from "@vercel/node";
import statusHandler from "../../server/documents/status.js";
import uploadHandler from "../../server/documents/upload.js";
import viewHandler from "../../server/documents/view.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

type ActionBody = {
  action?: string;
};

async function readRequestBody(request: VercelRequest) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function getQueryAction(request: VercelRequest) {
  return Array.isArray(request.query.action)
    ? request.query.action[0]
    : request.query.action;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const contentType = Array.isArray(request.headers["content-type"])
    ? request.headers["content-type"][0]
    : request.headers["content-type"] || "";
  const queryAction = getQueryAction(request);

  if (request.method === "GET" && queryAction === "view") {
    return viewHandler(request, response);
  }

  if (contentType.includes("multipart/form-data")) {
    return uploadHandler(request, response);
  }

  if (request.method === "POST") {
    const rawBody = await readRequestBody(request);
    const body = rawBody ? (JSON.parse(rawBody) as ActionBody) : {};
    (request as VercelRequest & { body: ActionBody }).body = body;

    if (body.action === "updateStatus" || body.action === "rename") {
      return statusHandler(request, response);
    }
  }

  return response.status(400).json({
    message: "Document action is missing.",
    ok: false,
  });
}
