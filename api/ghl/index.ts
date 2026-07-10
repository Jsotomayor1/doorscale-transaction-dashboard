import type { VercelRequest, VercelResponse } from "@vercel/node";
import locationsHandler from "../../server/ghl/locations.js";
import privateConnectHandler from "../../server/ghl/private-connect.js";
import notesHandler from "../../server/ghl/notes.js";
import selectLocationHandler from "../../server/ghl/select-location.js";
import statusHandler from "../../server/ghl/status.js";
import syncHandler from "../../server/ghl/sync.js";
import createTaskHandler from "../../server/ghl/tasks/create.js";
import updateTaskHandler from "../../server/ghl/tasks/update.js";
import createTransactionHandler from "../../server/ghl/transactions/create.js";
import updateTransactionHandler from "../../server/ghl/transactions/update.js";

type ActionBody = {
  action?: string;
};

function getAction(request: VercelRequest) {
  const body = (request.body ?? {}) as ActionBody;
  const queryAction = Array.isArray(request.query.action)
    ? request.query.action[0]
    : request.query.action;

  return (body.action || queryAction || "").trim();
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const action = getAction(request);

  switch (action) {
    case "createTask":
      return createTaskHandler(request, response);
    case "createTransaction":
      return createTransactionHandler(request, response);
    case "locations":
      return locationsHandler(request, response);
    case "createNote":
    case "fetchNotes":
      return notesHandler(request, response);
    case "privateConnect":
      return privateConnectHandler(request, response);
    case "selectLocation":
      return selectLocationHandler(request, response);
    case "status":
      return statusHandler(request, response);
    case "sync":
      return syncHandler(request, response);
    case "updateTask":
      return updateTaskHandler(request, response);
    case "updateTransaction":
      return updateTransactionHandler(request, response);
    default:
      return response.status(400).json({
        message: "DoorScale action is missing.",
        ok: false,
      });
  }
}


