import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, subDays } from "date-fns";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getDoorScaleLocationHeaders,
  getStoredActiveLocationId,
  getUrlActiveLocationId,
  setStoredActiveLocationId,
  subscribeToActiveLocationChange,
} from "@/lib/active-location";

export const TRANSACTION_STAGES = [
  "Pre-listing",
  "Active",
  "Under Contract",
  "Inspections",
  "Appraisal",
  "Clear to Close",
  "Closed",
  "Dead",
] as const;

export type TransactionStage = (typeof TRANSACTION_STAGES)[number];

export type TransactionType = string;

export const TRANSACTION_TYPES = [
  "Buyer",
  "Seller",
  "Buyer/Seller",
  "Rental",
] as const;

export type NewTransactionInput = {
  clientEmail: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  propertyAddress: string;
  transactionType: string;
  stage: TransactionStage;
  buyerName: string;
  sellerName: string;
  closingDate: string;
  inspectionDate: string;
  commission: string;
};

export type UpdateTransactionStageInput = {
  transactionId: string;
  transactionType: string;
  stage: TransactionStage;
};

export type UpdateTaskDueDateTimeInput = {
  taskId: string;
  dueDate: string;
  dueTime: string;
};

export type UpdateDocumentStatusInput = {
  documentId: string;
  status: DocumentStatus;
  transactionId: string;
};

export type UploadDocumentInput = {
  documentId: string;
  documentType: string;
  file: File;
  transactionId: string;
};

export type EnsureTransactionDocumentsInput = {
  stage: string;
  transactionId: string;
  transactionType: string;
};

export type CreateTaskInput = {
  assignedTo: string;
  description: string;
  dueDate: string;
  dueTime: string;
  status: string;
  title: string;
  transactionId: string;
};

export type UpdateTransactionDetailsInput = {
  transactionId: string;
  assignedTo: string;
  clientEmail: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  propertyAddress: string;
  transactionType: string;
  buyerName: string;
  sellerName: string;
  closingDate: string;
  inspectionDate: string;
  commission: string;
  status: string;
};

export type TaskStatus = "Open" | "In Progress" | "Blocked" | "Done" | string;

export type TransactionTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  dueDateTime: string;
  owner: string;
};

export type Transaction = {
  id: string;
  clientName: string;
  propertyAddress: string;
  type: TransactionType;
  stage: TransactionStage;
  closeDate: string;
  inspectionDate: string;
  contractValue: number;
  commission: number;
  status: string;
  buyerName: string;
  sellerName: string;
  clientEmail?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientPhone?: string;
  assignedTo?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
  tasks: TransactionTask[];
  syncStatus?: string;
  lastSyncError?: string;
  lastSyncedAt?: string;
  ghlContactId?: string;
  ghlLocationId?: string;
  ghlOpportunityId?: string;
  documentCounts?: DocumentStatusCounts;
};

export type Opportunity = {
  id: string;
  name: string;
  contactId: string;
  pipelineId: string;
  stage: string;
  status: string;
  assignedTo: string;
  value: number;
  createdAt: string;
  updatedAt: string;
  customFields: {
    propertyAddress: string;
    transactionType: string;
    closingDate: string;
    inspectionDeadline: string;
    buyerName: string;
    sellerName: string;
    assignedAgent?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    grossCommission: number;
    netCommission: number;
    agentPayout: number;
    missingDocuments: string[];
  };
  syncStatus?: string;
  lastSyncError?: string;
  lastSyncedAt?: string;
  ghlContactId?: string;
  ghlLocationId?: string;
  ghlOpportunityId?: string;
};

export type DashboardTask = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  dueDateTime: string;
  assignedTo: string;
  status: string;
  relatedOpportunityId: string;
  transactionId: string;
  propertyAddress: string;
  clientName: string;
  syncStatus?: string;
  lastSyncError?: string;
  lastSyncedAt?: string;
  ghlTaskId?: string;
};

export type TransactionDocument = {
  id: string;
  locationId: string;
  transactionId: string;
  templateId: string;
  documentType: string;
  documentName: string;
  deliveryType: "workflow" | "manual_upload" | string;
  doorScaleFileId: string;
  doorScaleContactId: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  ghlContactId: string;
  ghlOpportunityId: string;
  status: string;
  uploadedAt: string;
  uploadedBy: string;
  workflowName: string;
  workflowTriggerTag: string;
  createdAt: string;
};

export type DocumentStatus =
  | "needed"
  | "sent"
  | "viewed"
  | "completed"
  | "uploaded"
  | "pending_review"
  | "approved"
  | "rejected"
  | "missing";

export type DocumentStatusCounts = Record<DocumentStatus, number>;

type TaskWriteResponse = {
  message?: string;
  ok?: boolean;
  taskId?: string;
};

type TransactionWriteResponse = {
  message?: string;
  ok?: boolean;
  transactionId?: string;
};

type DocumentUploadResponse = {
  document?: Partial<TransactionDocument> & {
    document_id?: string;
    document_name?: string;
    document_type?: string;
    delivery_type?: string;
    doorscale_file_id?: string;
    file_name?: string;
    file_path?: string;
    file_url?: string;
    id?: string;
    status?: string;
    template_id?: string;
    uploaded_at?: string;
  };
  message?: string;
  ok?: boolean;
};

type DocumentStatusResponse = {
  document?: Partial<TransactionDocument> & {
    document_name?: string;
    document_type?: string;
    delivery_type?: string;
    doorscale_file_id?: string;
    file_name?: string;
    file_path?: string;
    file_url?: string;
    id?: string;
    status?: string;
    template_id?: string;
    uploaded_at?: string;
  };
  message?: string;
  ok?: boolean;
};

type SupabaseTransaction = {
  id: string;
  location_id: string;
  property_address: string | null;
  transaction_type: string | null;
  stage: string | null;
  buyer_name: string | null;
  seller_name: string | null;
  assigned_to: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  client_email?: string | null;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_phone?: string | null;
  closing_date: string | null;
  inspection_date: string | null;
  commission: number | null;
  status: string | null;
  sync_status: string | null;
  last_sync_error: string | null;
  last_synced_at: string | null;
  contact_id?: string | null;
  ghl_contact_id?: string | null;
  ghl_location_id?: string | null;
  created_at: string | null;
  updated_at: string | null;
  ghl_opportunity_id?: string | null;
};

type SupabaseTask = {
  id: string;
  location_id: string;
  transaction_id: number | string | null;
  title: string | null;
  description?: string | null;
  due_date: string | null;
  due_datetime: string | null;
  status: string | null;
  assigned_to: string | null;
  sync_status: string | null;
  last_sync_error: string | null;
  last_synced_at: string | null;
  ghl_task_id?: string | null;
  created_at: string | null;
};

type SupabaseTransactionDocument = {
  id: string;
  location_id?: string | null;
  transaction_id: number | string | null;
  template_id?: string | null;
  document_type: string | null;
  document_name: string | null;
  delivery_type?: string | null;
  doorscale_file_id: string | null;
  doorscale_contact_id: string | null;
  file_name?: string | null;
  file_path?: string | null;
  file_url?: string | null;
  ghl_contact_id?: string | null;
  ghl_opportunity_id?: string | null;
  status: string | null;
  uploaded_at: string | null;
  uploaded_by?: string | null;
  workflow_name?: string | null;
  workflow_trigger_tag?: string | null;
  created_at: string | null;
};

type SupabaseTaskTemplate = {
  id: string;
  location_id?: string | null;
  transaction_type?: string | null;
  stage?: string | null;
  title: string | null;
  days_offset: number | null;
  assigned_role: string | null;
  sort_order: number | null;
};

type SupabaseDocumentTemplate = {
  id: string;
  delivery_type?: string | null;
  location_id?: string | null;
  document_type: string | null;
  stage?: string | null;
  stage_name?: string | null;
  transaction_type?: string | null;
  workflow_name?: string | null;
  workflow_trigger_tag?: string | null;
  sort_order: number | null;
};

type SupabaseTaskTitle = {
  title: string | null;
};

type SupabaseDocumentType = {
  document_type: string | null;
  template_id?: string | null;
};

type CrmDataState = {
  transactions: Transaction[];
  opportunities: Opportunity[];
  tasks: DashboardTask[];
  documents: TransactionDocument[];
};

function normalizeDocumentStatusValue(status = "needed"): DocumentStatus {
  const normalizedStatus = status.trim().toLowerCase().replace(/\s+/g, "_");

  if (normalizedStatus === "completed") return "completed";
  if (normalizedStatus === "sent") return "sent";
  if (normalizedStatus === "viewed") return "viewed";
  if (normalizedStatus === "uploaded") return "uploaded";
  if (normalizedStatus === "pending_review") return "pending_review";
  if (normalizedStatus === "approved") return "approved";
  if (normalizedStatus === "rejected") return "rejected";
  if (normalizedStatus === "missing") return "missing";
  return "needed";
}

function emptyDocumentCounts(): DocumentStatusCounts {
  return {
    needed: 0,
    sent: 0,
    viewed: 0,
    completed: 0,
    uploaded: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    missing: 0,
  };
}

const today = new Date();

const demoTransactions: Transaction[] = [
  {
    id: "txn-1001",
    clientName: "Avery Johnson",
    propertyAddress: "1842 Harbor View Dr, Tampa, FL",
    type: "Buyer",
    stage: "Inspections",
    closeDate: addDays(today, 18).toISOString(),
    inspectionDate: addDays(today, 4).toISOString(),
    contractValue: 645000,
    commission: 19350,
    status: "active",
    buyerName: "Avery Johnson",
    sellerName: "",
    createdAt: subDays(today, 12).toISOString(),
    updatedAt: today.toISOString(),
    tasks: [
      {
        id: "task-1",
        title: "Confirm inspection repair response",
        status: "pending",
        dueDate: addDays(today, 1).toISOString(),
        dueDateTime: addDays(today, 1).toISOString(),
        owner: "Transaction Coordinator",
      },
      {
        id: "task-2",
        title: "Upload earnest money receipt",
        status: "completed",
        dueDate: subDays(today, 1).toISOString(),
        dueDateTime: subDays(today, 1).toISOString(),
        owner: "Agent",
      },
    ],
  },
  {
    id: "txn-1002",
    clientName: "Morgan Lee",
    propertyAddress: "921 Cedar Ridge Way, Austin, TX",
    type: "Seller",
    stage: "Active",
    closeDate: addDays(today, 27).toISOString(),
    inspectionDate: addDays(today, 12).toISOString(),
    contractValue: 785000,
    commission: 23550,
    status: "active",
    buyerName: "",
    sellerName: "Morgan Lee",
    createdAt: subDays(today, 9).toISOString(),
    updatedAt: today.toISOString(),
    tasks: [
      {
        id: "task-3",
        title: "Send appraisal access instructions",
        status: "pending",
        dueDate: addDays(today, 2).toISOString(),
        dueDateTime: addDays(today, 2).toISOString(),
        owner: "Agent",
      },
      {
        id: "task-4",
        title: "Verify payoff statement request",
        status: "pending",
        dueDate: addDays(today, 5).toISOString(),
        dueDateTime: addDays(today, 5).toISOString(),
        owner: "Closing Team",
      },
    ],
  },
];

function isDemoMode() {
  return (
    import.meta.env.DEMO_MODE === "true" ||
    import.meta.env.VITE_DEMO_MODE === "true"
  );
}

function getSupabaseClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function normalizeStage(stage: string | null): TransactionStage {
  const stageMap: Record<string, TransactionStage> = {
    "pre-listing": "Pre-listing",
    prelisting: "Pre-listing",
    active: "Active",
    "under contract": "Under Contract",
    inspection: "Inspections",
    inspections: "Inspections",
    appraisal: "Appraisal",
    "clear to close": "Clear to Close",
    closed: "Closed",
    dead: "Dead",
  };

  return stageMap[(stage ?? "").toLowerCase()] ?? "Pre-listing";
}

function getClientName(transaction: SupabaseTransaction) {
  const clientName = [
    transaction.client_first_name,
    transaction.client_last_name,
  ].filter(Boolean).join(" ").trim();

  return clientName || transaction.contact_name || "Unknown Client";
}

function toOpportunity(
  transaction: SupabaseTransaction,
  relatedTasks: SupabaseTask[],
): Opportunity {
  const commission = Number(transaction.commission ?? 0);
  const assignedTo = relatedTasks.find((task) => task.assigned_to)?.assigned_to ?? "";

  return {
    id: transaction.id,
    name: transaction.property_address ?? "Untitled transaction",
    contactId: "",
    pipelineId: "Transaction Management",
    stage: normalizeStage(transaction.stage),
    status: transaction.status ?? "active",
    assignedTo,
    value: commission,
    createdAt: transaction.created_at ?? "",
    updatedAt: transaction.updated_at ?? transaction.created_at ?? "",
    customFields: {
      propertyAddress: transaction.property_address ?? "",
      transactionType: transaction.transaction_type ?? "",
      closingDate: transaction.closing_date ?? "",
      inspectionDeadline: transaction.inspection_date ?? "",
      buyerName: transaction.buyer_name ?? "",
      sellerName: transaction.seller_name ?? "",
      contactName: getClientName(transaction),
      assignedAgent: transaction.assigned_to ?? "",
      contactEmail: transaction.client_email ?? transaction.contact_email ?? "",
      contactPhone: transaction.client_phone ?? transaction.contact_phone ?? "",
      grossCommission: commission,
      netCommission: commission,
      agentPayout: commission,
      missingDocuments: [],
    },
    syncStatus: transaction.sync_status ?? "synced",
    lastSyncError: transaction.last_sync_error ?? "",
    lastSyncedAt: transaction.last_synced_at ?? "",
    ghlContactId: transaction.ghl_contact_id ?? transaction.contact_id ?? "",
    ghlLocationId: transaction.ghl_location_id ?? transaction.location_id ?? "",
    ghlOpportunityId: transaction.ghl_opportunity_id ?? "",
  };
}

function mapSupabaseData(
  supabaseTransactions: SupabaseTransaction[],
  supabaseTasks: SupabaseTask[],
  supabaseDocuments: SupabaseTransactionDocument[],
): CrmDataState {
  const documents = supabaseDocuments.map<TransactionDocument>((document) => ({
    fileName:
      document.file_name ??
      document.doorscale_file_id?.split("/").pop()?.replace(/^\d+-/, "") ??
      "",
    filePath: document.file_path ?? document.doorscale_file_id ?? "",
    fileUrl: document.file_url ?? "",
    ghlContactId: document.ghl_contact_id ?? "",
    ghlOpportunityId: document.ghl_opportunity_id ?? "",
    id: document.id,
    locationId: document.location_id ?? "",
    transactionId:
      document.transaction_id === null || document.transaction_id === undefined
        ? ""
        : String(document.transaction_id),
    templateId: document.template_id ?? "",
    documentType: document.document_type ?? "",
    documentName: document.document_name ?? "",
    deliveryType: document.delivery_type ?? "manual_upload",
    doorScaleFileId: document.doorscale_file_id ?? "",
    doorScaleContactId: document.doorscale_contact_id ?? "",
    status: normalizeDocumentStatusValue(document.status ?? undefined),
    uploadedAt: document.uploaded_at ?? "",
    uploadedBy: document.uploaded_by ?? "",
    workflowName: document.workflow_name ?? "",
    workflowTriggerTag: document.workflow_trigger_tag ?? "",
    createdAt: document.created_at ?? "",
  }));
  const documentCountsByTransaction = documents.reduce<
    Record<string, DocumentStatusCounts>
  >((counts, document) => {
    const transactionId = String(document.transactionId);

    if (!transactionId) return counts;

    counts[transactionId] ??= emptyDocumentCounts();
    counts[transactionId][document.status as DocumentStatus] += 1;
    return counts;
  }, {});
  const transactions = supabaseTransactions.map<Transaction>((transaction) => {
    const relatedTasks = supabaseTasks.filter(
      (task) => String(task.transaction_id) === String(transaction.id),
    );
    const commission = Number(transaction.commission ?? 0);

    return {
      id: transaction.id,
      clientName: getClientName(transaction),
      propertyAddress: transaction.property_address ?? "Untitled transaction",
      type: transaction.transaction_type ?? "",
      stage: normalizeStage(transaction.stage),
      closeDate: transaction.closing_date ?? "",
      inspectionDate: transaction.inspection_date ?? "",
      contractValue: commission,
      commission,
      status: transaction.status ?? "active",
      buyerName: transaction.buyer_name ?? "",
      sellerName: transaction.seller_name ?? "",
      clientEmail: transaction.client_email ?? transaction.contact_email ?? "",
      clientFirstName: transaction.client_first_name ?? "",
      clientLastName: transaction.client_last_name ?? "",
      clientPhone: transaction.client_phone ?? transaction.contact_phone ?? "",
      assignedTo: transaction.assigned_to ?? "",
      contactName: getClientName(transaction),
      contactEmail: transaction.client_email ?? transaction.contact_email ?? "",
      contactPhone: transaction.client_phone ?? transaction.contact_phone ?? "",
      createdAt: transaction.created_at ?? "",
      updatedAt: transaction.updated_at ?? transaction.created_at ?? "",
      syncStatus: transaction.sync_status ?? "synced",
      lastSyncError: transaction.last_sync_error ?? "",
      lastSyncedAt: transaction.last_synced_at ?? "",
      ghlContactId: transaction.ghl_contact_id ?? transaction.contact_id ?? "",
      ghlLocationId: transaction.ghl_location_id ?? transaction.location_id ?? "",
      ghlOpportunityId: transaction.ghl_opportunity_id ?? "",
      documentCounts:
        documentCountsByTransaction[String(transaction.id)] ?? emptyDocumentCounts(),
      tasks: relatedTasks.map((task) => ({
        description: task.description ?? "",
        id: task.id,
        title: task.title ?? "Untitled task",
        status: task.status ?? "pending",
        dueDate: task.due_date ?? "",
        dueDateTime: task.due_datetime ?? task.due_date ?? "",
        owner: task.assigned_to ?? "",
      })),
    };
  });

  const transactionById = new Map(
    transactions.map((transaction) => [String(transaction.id), transaction]),
  );

  return {
    transactions,
    opportunities: supabaseTransactions.map((transaction) =>
      toOpportunity(
        transaction,
        supabaseTasks.filter(
          (task) => String(task.transaction_id) === String(transaction.id),
        ),
      ),
    ),
    tasks: supabaseTasks.map((task) => {
      const taskTransactionId =
        task.transaction_id === null || task.transaction_id === undefined
          ? ""
          : String(task.transaction_id);
      const transaction = transactionById.get(taskTransactionId);

      return {
        id: task.id,
        title: task.title ?? "Untitled task",
        description: task.description ?? "",
        dueDate: task.due_date ?? "",
        dueDateTime: task.due_datetime ?? task.due_date ?? "",
        assignedTo: task.assigned_to ?? "",
        status: task.status ?? "pending",
        relatedOpportunityId: taskTransactionId,
        transactionId: taskTransactionId,
        propertyAddress: transaction?.propertyAddress ?? "",
        clientName: transaction?.clientName ?? "",
        syncStatus: task.sync_status ?? "synced",
        lastSyncError: task.last_sync_error ?? "",
        lastSyncedAt: task.last_synced_at ?? "",
        ghlTaskId: task.ghl_task_id ?? "",
      };
    }),
    documents,
  };
}

function mapSupabaseDocument(document: SupabaseTransactionDocument): TransactionDocument {
  return {
    fileName:
      document.file_name ??
      document.doorscale_file_id?.split("/").pop()?.replace(/^\d+-/, "") ??
      "",
    filePath: document.file_path ?? document.doorscale_file_id ?? "",
    fileUrl: document.file_url ?? "",
    ghlContactId: document.ghl_contact_id ?? "",
    ghlOpportunityId: document.ghl_opportunity_id ?? "",
    id: document.id,
    locationId: document.location_id ?? "",
    transactionId:
      document.transaction_id === null || document.transaction_id === undefined
        ? ""
        : String(document.transaction_id),
    templateId: document.template_id ?? "",
    documentType: document.document_type ?? "",
    documentName: document.document_name ?? "",
    deliveryType: document.delivery_type ?? "manual_upload",
    doorScaleFileId: document.doorscale_file_id ?? "",
    doorScaleContactId: document.doorscale_contact_id ?? "",
    status: normalizeDocumentStatusValue(document.status ?? undefined),
    uploadedAt: document.uploaded_at ?? "",
    uploadedBy: document.uploaded_by ?? "",
    workflowName: document.workflow_name ?? "",
    workflowTriggerTag: document.workflow_trigger_tag ?? "",
    createdAt: document.created_at ?? "",
  };
}

function mapDemoData(): CrmDataState {
  const tasks = demoTransactions.flatMap((transaction) =>
    transaction.tasks.map((task) => ({
      ...task,
      description: "",
      dueDate: task.dueDate,
      dueDateTime: task.dueDate,
      assignedTo: task.owner,
      relatedOpportunityId: transaction.id,
      transactionId: transaction.id,
      propertyAddress: transaction.propertyAddress,
      clientName: transaction.clientName,
    })),
  );

  return {
    transactions: demoTransactions,
    opportunities: demoTransactions.map((transaction) => ({
      id: transaction.id,
      name: transaction.propertyAddress,
      contactId: "",
      pipelineId: "Transaction Management",
      stage: transaction.stage,
      status: transaction.status,
      assignedTo: transaction.tasks.find((task) => task.owner)?.owner ?? "",
      value: transaction.commission,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      customFields: {
        propertyAddress: transaction.propertyAddress,
        transactionType: transaction.type,
        closingDate: transaction.closeDate,
        inspectionDeadline: transaction.inspectionDate,
        buyerName: transaction.buyerName,
        sellerName: transaction.sellerName,
        grossCommission: transaction.commission,
        netCommission: transaction.commission,
        agentPayout: transaction.commission,
        missingDocuments: [],
      },
    })),
    tasks,
    documents: [],
  };
}

async function getActiveLocationId() {
  const urlLocationId = getUrlActiveLocationId();

  if (urlLocationId) {
    setStoredActiveLocationId(urlLocationId);
    return urlLocationId;
  }

  const storedLocationId = getStoredActiveLocationId();

  if (storedLocationId) return storedLocationId;

  return "";
}

async function loadLocationDocuments(
  client: SupabaseClient,
  activeLocationId: string,
) {
  return client
    .from("transaction_documents")
    .select(
      "id, location_id, transaction_id, document_type, document_name, delivery_type, doorscale_file_id, doorscale_contact_id, file_name, file_path, file_url, ghl_contact_id, ghl_opportunity_id, status, uploaded_at, uploaded_by, created_at, workflow_name, workflow_trigger_tag",
    )
    .eq("location_id", activeLocationId)
    .order("created_at", { ascending: false });
}

async function loadTransactionDocuments(
  client: SupabaseClient,
  activeLocationId: string,
  transactionId: string,
) {
  return client
    .from("transaction_documents")
    .select(
      "id, location_id, transaction_id, document_type, document_name, delivery_type, doorscale_file_id, doorscale_contact_id, file_name, file_path, file_url, ghl_contact_id, ghl_opportunity_id, status, uploaded_at, uploaded_by, created_at, workflow_name, workflow_trigger_tag",
    )
    .eq("location_id", activeLocationId)
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });
}

async function fetchCrmData(
  client: SupabaseClient,
  activeLocationId: string,
): Promise<CrmDataState> {
  const [transactionsResult, tasksResult, documentsResult] = await Promise.all([
    client
      .from("transactions")
      .select(
        "id, location_id, property_address, transaction_type, stage, buyer_name, seller_name, assigned_to, contact_name, contact_email, contact_phone, client_first_name, client_last_name, client_email, client_phone, closing_date, inspection_date, commission, status, sync_status, last_sync_error, last_synced_at, contact_id, ghl_contact_id, ghl_location_id, ghl_opportunity_id, created_at, updated_at",
      )
      .eq("location_id", activeLocationId)
      .order("updated_at", { ascending: false }),
    client
      .from("tasks")
      .select(
        "id, location_id, transaction_id, title, due_date, due_datetime, status, assigned_to, sync_status, last_sync_error, last_synced_at, ghl_task_id, created_at",
      )
      .eq("location_id", activeLocationId)
      .order("created_at", { ascending: false }),
    loadLocationDocuments(client, activeLocationId),
  ]);

  if (transactionsResult.error) {
    console.error("DoorScale transaction query failed:", {
      transactionsError: transactionsResult.error,
      tasksError: tasksResult.error,
      documentsError: documentsResult.error,
    });
    throw new Error("Unable to load transaction data.");
  }

  if (tasksResult.error) {
    console.warn("DoorScale tasks unavailable during load:", tasksResult.error);
  }

  if ("error" in documentsResult && documentsResult.error) {
    console.warn(
      "DoorScale documents unavailable during load:",
      documentsResult.error,
    );
  }

  console.log("DoorScale dashboard data loaded:", {
    activeLocationId,
    documents: documentsResult.data?.length ?? 0,
    tables: ["transactions", "tasks", "transaction_documents"],
    tasks: tasksResult.data?.length ?? 0,
    transactions: transactionsResult.data?.length ?? 0,
  });

  const transactions = (transactionsResult.data ?? []) as SupabaseTransaction[];
  const tasks = tasksResult.error ? [] : (tasksResult.data ?? []);
  let documents = documentsResult.error
    ? []
    : ((documentsResult.data ?? []) as SupabaseTransactionDocument[]);

  let createdDocumentRows = false;
  try {
    createdDocumentRows = await ensureDocumentChecklists(
      client,
      activeLocationId,
      transactions,
    );
  } catch (checklistError) {
    console.warn("DoorScale document checklist generation skipped:", {
      activeLocationId,
      error: checklistError,
    });
  }

  if (createdDocumentRows) {
    const refreshedDocumentsResult = await loadLocationDocuments(
      client,
      activeLocationId,
    );

    if (refreshedDocumentsResult.error) {
      console.error("DoorScale document checklist reload failed:", {
        activeLocationId,
        error: refreshedDocumentsResult.error,
      });
    } else {
      documents =
        (refreshedDocumentsResult.data ?? []) as SupabaseTransactionDocument[];
    }
  }

  return mapSupabaseData(
    transactions,
    tasks,
    documents,
  );
}

async function generateChecklistTasks(
  client: SupabaseClient,
  activeLocationId: string,
  transactionId: string,
  transactionType: string,
  stage: TransactionStage,
) {
  const { data: templates, error: templateError } = await client
    .from("task_templates")
    .select("id, location_id, transaction_type, stage, title, days_offset, assigned_role, sort_order")
    .in("location_id", [activeLocationId, "demo-location", "global"])
    .order("sort_order", { ascending: true });

  if (templateError) {
    throw new Error("Unable to generate checklist tasks.");
  }

  const templateRows = (templates ?? []) as Array<
    SupabaseTaskTemplate & { location_id?: string | null }
  >;
  const normalizedType = normalizeTemplateKey(transactionType);
  const normalizedStage = normalizeTemplateKey(stage);
  const matchingTemplates = templateRows.filter(
    (template) =>
      normalizeTemplateKey(template.transaction_type ?? "") === normalizedType &&
      normalizeTemplateKey(template.stage ?? "") === normalizedStage,
  );
  const locationSpecificTemplates = matchingTemplates.filter(
    (template) => template.location_id === activeLocationId,
  );
  const taskTemplates =
    locationSpecificTemplates.length > 0
      ? locationSpecificTemplates
      : matchingTemplates.filter((template) =>
          ["demo-location", "global"].includes(template.location_id ?? ""),
        );

  if (!taskTemplates.length) return;

  const { data: existingTasks, error: existingTasksError } = await client
    .from("tasks")
    .select("title")
    .eq("location_id", activeLocationId)
    .eq("transaction_id", transactionId);

  if (existingTasksError) {
    throw new Error("Unable to check existing checklist tasks.");
  }

  const existingTitles = new Set(
    ((existingTasks ?? []) as SupabaseTaskTitle[])
      .map((task) => task.title?.trim().toLowerCase())
      .filter(Boolean),
  );

  const taskRows = taskTemplates
    .filter((template) => {
      const title = template.title?.trim().toLowerCase();

      return title ? !existingTitles.has(title) : false;
    })
    .map((template) => {
      const dueDateTime = addDays(
        new Date(),
        Number(template.days_offset ?? 0),
      );

      return {
        location_id: activeLocationId,
        transaction_id: transactionId,
        title: template.title ?? "Untitled task",
        due_date: dueDateTime.toISOString().slice(0, 10),
        due_datetime: dueDateTime.toISOString(),
        status: "pending",
        assigned_to: template.assigned_role || "Agent",
      };
    });

  if (!taskRows.length) return;

  const { error: taskInsertError } = await client.from("tasks").insert(taskRows);

  if (taskInsertError) {
    throw new Error("Unable to create checklist tasks.");
  }
}

async function generateDocumentChecklist(
  client: SupabaseClient,
  activeLocationId: string,
  transactionId: string,
  transactionType: string,
  stage: string,
) {
  const { data: templates, error: templateError } = await client
    .from("document_templates")
    .select(
      "id, location_id, transaction_type, stage, stage_name, document_type, delivery_type, workflow_trigger_tag, workflow_name, sort_order",
    )
    .in("location_id", [activeLocationId, "global", "demo-location"])
    .order("sort_order", { ascending: true });

  if (templateError) {
    throw new Error("Unable to generate document checklist.");
  }

  const templateRows = (templates ?? []) as SupabaseDocumentTemplate[];
  const normalizedTransactionType = normalizeTemplateKey(transactionType);
  const normalizedStage = normalizeTemplateKey(stage);
  const matchingTemplates = templateRows.filter((template) => {
    const templateTransactionType = normalizeTemplateKey(
      template.transaction_type ?? "",
    );
    const templateStage = normalizeTemplateKey(
      template.stage_name || template.stage || "",
    );

    return (
      templateTransactionType === normalizedTransactionType &&
      templateStage === normalizedStage
    );
  });
  const locationSpecificTemplates = matchingTemplates.filter(
    (template) => template.location_id === activeLocationId,
  );
  const documentTemplates =
    locationSpecificTemplates.length > 0
      ? locationSpecificTemplates
      : matchingTemplates.filter((template) =>
          ["global", "demo-location"].includes(template.location_id ?? ""),
        );

  if (!documentTemplates.length) return false;

  const { data: existingDocuments, error: existingDocumentsError } = await client
    .from("transaction_documents")
    .select("document_type")
    .eq("location_id", activeLocationId)
    .eq("transaction_id", transactionId);

  if (existingDocumentsError) {
    throw new Error("Unable to check existing document checklist.");
  }

  const existingTypes = new Set(
    ((existingDocuments ?? []) as SupabaseDocumentType[])
      .map((document) => document.document_type?.trim().toLowerCase())
      .filter(Boolean),
  );
  const documentRows = documentTemplates
    .filter((template) => {
      const documentType = template.document_type?.trim().toLowerCase();

      if (!documentType) return false;

      return !existingTypes.has(documentType);
    })
    .map((template) => ({
      location_id: activeLocationId,
      transaction_id: transactionId,
      document_type: template.document_type,
      document_name: template.document_type,
      delivery_type: template.delivery_type || "manual_upload",
      workflow_trigger_tag: template.workflow_trigger_tag || null,
      workflow_name: template.workflow_name || null,
      status: "needed",
    }));

  if (!documentRows.length) return false;

  const { error: insertError } = await client
    .from("transaction_documents")
    .insert(documentRows);

  if (insertError) {
    throw new Error("Unable to create document checklist.");
  }

  return true;
}

async function ensureDocumentChecklists(
  client: SupabaseClient,
  activeLocationId: string,
  transactions: SupabaseTransaction[],
) {
  let createdRows = false;
  for (const transaction of transactions) {
    const created = await generateDocumentChecklist(
      client,
      activeLocationId,
      transaction.id,
      transaction.transaction_type || "",
      transaction.stage || "",
    );
    createdRows ||= Boolean(created);
  }

  return createdRows;
}

const emptyData: CrmDataState = {
  transactions: [],
  opportunities: [],
  tasks: [],
  documents: [],
};

function getDueDateTime(dueDate: string, dueTime: string) {
  if (dueDate && dueTime) {
    return new Date(`${dueDate}T${dueTime}`).toISOString();
  }

  if (dueDate) {
    return new Date(`${dueDate}T00:00`).toISOString();
  }

  return null;
}

function normalizeTemplateKey(value = "") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

async function parseTaskWriteResponse(response: Response) {
  const result = (await response.json().catch(() => ({}))) as TaskWriteResponse;

  if (!response.ok) {
    throw new Error(result.message || "Unable to save task.");
  }

  return result;
}

async function parseTransactionWriteResponse(response: Response) {
  const result = (await response.json().catch(() => ({}))) as TransactionWriteResponse;

  if (!response.ok) {
    throw new Error(result.message || "Unable to save transaction.");
  }

  return result;
}

export function useCrmData() {
  const [data, setData] = useState<CrmDataState>(() =>
    isDemoMode() ? mapDemoData() : emptyData,
  );
  const [loading, setLoading] = useState(!isDemoMode());
  const [error, setError] = useState<string | null>(null);
  const [activeLocationId, setActiveLocationId] = useState("");

  const refreshData = useCallback(async () => {
    if (isDemoMode()) {
      setData(mapDemoData());
      setLoading(false);
      setError(null);
      return;
    }

    const client = getSupabaseClient();

    if (!client) {
      setLoading(false);
      setError("DoorScale connection is not configured.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const locationId = await getActiveLocationId();

      if (!locationId) {
        setData(emptyData);
        setError("Connect DoorScale to load transaction data.");
        return;
      }

      setActiveLocationId(locationId);
      setData(await fetchCrmData(client, locationId));
    } catch (crmError) {
      console.error("DoorScale transaction data load failed:", crmError);
      setError("Unable to load transaction data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const createTransaction = useCallback(
    async (input: NewTransactionInput) => {
      if (isDemoMode()) {
        const createdAt = new Date().toISOString();
        const commission = Number(input.commission || 0);
        const demoTransaction: Transaction = {
          id: `txn-${Date.now()}`,
          clientName:
            [input.clientFirstName, input.clientLastName].filter(Boolean).join(" ") ||
            "Unknown Client",
          propertyAddress: input.propertyAddress,
          type: input.transactionType,
          stage: input.stage,
          closeDate: input.closingDate,
          inspectionDate: input.inspectionDate,
          contractValue: commission,
          commission,
          status: "active",
          buyerName: input.buyerName,
          clientEmail: input.clientEmail,
          clientFirstName: input.clientFirstName,
          clientLastName: input.clientLastName,
          clientPhone: input.clientPhone,
          sellerName: input.sellerName,
          createdAt,
          updatedAt: createdAt,
          tasks: [],
        };

        setData((currentData) => ({
          transactions: [...currentData.transactions, demoTransaction],
          opportunities: [
            ...currentData.opportunities,
            {
              id: demoTransaction.id,
              name: demoTransaction.propertyAddress,
              contactId: "",
              pipelineId: "Transaction Management",
              stage: demoTransaction.stage,
              status: demoTransaction.status,
              assignedTo: "",
              value: demoTransaction.commission,
              createdAt,
              updatedAt: createdAt,
              customFields: {
                propertyAddress: demoTransaction.propertyAddress,
                transactionType: demoTransaction.type,
                closingDate: demoTransaction.closeDate,
                inspectionDeadline: demoTransaction.inspectionDate,
                buyerName: demoTransaction.buyerName,
                contactEmail: demoTransaction.clientEmail,
                contactName: demoTransaction.clientName,
                contactPhone: demoTransaction.clientPhone,
                sellerName: demoTransaction.sellerName,
                grossCommission: demoTransaction.commission,
                netCommission: demoTransaction.commission,
                agentPayout: demoTransaction.commission,
                missingDocuments: [],
              },
            },
          ],
          tasks: currentData.tasks,
          documents: currentData.documents,
        }));
        return;
      }

      const client = getSupabaseClient();

      if (!client) {
        throw new Error("DoorScale connection is not configured.");
      }
      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save transaction data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          ...input,
          action: "createTransaction",
          active_location_id: locationId,
          locationId,
          status: "active",
        }),
      });
      const result = await parseTransactionWriteResponse(response);

      if (!result.transactionId) {
        throw new Error("Transaction was created, but no id was returned.");
      }

      await generateChecklistTasks(
        client,
        locationId,
        result.transactionId,
        input.transactionType,
        input.stage,
      );
      await generateDocumentChecklist(
        client,
        locationId,
        result.transactionId,
        input.transactionType,
        input.stage,
      );

      await refreshData();

      return result.ok === false
        ? result.message || "Stage saved locally. DoorScale sync will retry."
        : undefined;
    },
    [activeLocationId, refreshData],
  );

  const updateTransactionStage = useCallback(
    async (input: UpdateTransactionStageInput) => {
      if (isDemoMode()) {
        setData((currentData) => ({
          transactions: currentData.transactions.map((transaction) =>
            transaction.id === input.transactionId
              ? { ...transaction, stage: input.stage }
              : transaction,
          ),
          opportunities: currentData.opportunities.map((opportunity) =>
            String(opportunity.id) === String(input.transactionId)
              ? { ...opportunity, stage: input.stage }
              : opportunity,
          ),
          tasks: currentData.tasks,
          documents: currentData.documents,
        }));
        return;
      }

      const client = getSupabaseClient();

      if (!client) {
        throw new Error("DoorScale connection is not configured.");
      }
      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save transaction data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action: "updateTransaction",
          active_location_id: locationId,
          locationId,
          stage: input.stage,
          transactionId: input.transactionId,
        }),
      });
      const result = await parseTransactionWriteResponse(response);

      await generateChecklistTasks(
        client,
        locationId,
        input.transactionId,
        input.transactionType,
        input.stage,
      );
      await generateDocumentChecklist(
        client,
        locationId,
        input.transactionId,
        input.transactionType,
        input.stage,
      );

      await refreshData();

      return result.ok === false
        ? result.message || "Transaction saved locally. DoorScale sync will retry later."
        : undefined;
    },
    [activeLocationId, refreshData],
  );

  const updateTransactionDetails = useCallback(
    async (input: UpdateTransactionDetailsInput) => {
      const commission = Number(input.commission || 0);

      if (isDemoMode()) {
        const updatedAt = new Date().toISOString();

        setData((currentData) => ({
          transactions: currentData.transactions.map((transaction) =>
            transaction.id === input.transactionId
              ? {
                  ...transaction,
                  clientName:
                    [input.clientFirstName, input.clientLastName]
                      .filter(Boolean)
                      .join(" ") ||
                    input.buyerName ||
                    input.sellerName ||
                    input.propertyAddress ||
                    transaction.clientName,
                  clientEmail: input.clientEmail,
                  clientFirstName: input.clientFirstName,
                  clientLastName: input.clientLastName,
                  clientPhone: input.clientPhone,
                  contactEmail: input.clientEmail,
                  contactName: [input.clientFirstName, input.clientLastName]
                    .filter(Boolean)
                    .join(" "),
                  contactPhone: input.clientPhone,
                  propertyAddress: input.propertyAddress,
                  type: input.transactionType,
                  closeDate: input.closingDate,
                  inspectionDate: input.inspectionDate,
                  commission,
                  contractValue: commission,
                  status: input.status,
                  buyerName: input.buyerName,
                  sellerName: input.sellerName,
                  updatedAt,
                }
              : transaction,
          ),
          opportunities: currentData.opportunities.map((opportunity) =>
            String(opportunity.id) === String(input.transactionId)
              ? {
                  ...opportunity,
                  name: input.propertyAddress,
                  status: input.status,
                  value: commission,
                  updatedAt,
                  customFields: {
                    ...opportunity.customFields,
                    propertyAddress: input.propertyAddress,
                    transactionType: input.transactionType,
                    contactEmail: input.clientEmail,
                    contactName: [input.clientFirstName, input.clientLastName]
                      .filter(Boolean)
                      .join(" "),
                    contactPhone: input.clientPhone,
                    buyerName: input.buyerName,
                    sellerName: input.sellerName,
                    closingDate: input.closingDate,
                    inspectionDeadline: input.inspectionDate,
                    grossCommission: commission,
                    netCommission: commission,
                    agentPayout: commission,
                  },
                }
              : opportunity,
          ),
          tasks: currentData.tasks,
          documents: currentData.documents,
        }));
        return;
      }

      const client = getSupabaseClient();

      if (!client) {
        throw new Error("DoorScale connection is not configured.");
      }
      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save transaction data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          ...input,
          action: "updateTransaction",
          active_location_id: locationId,
          locationId,
        }),
      });
      const result = await parseTransactionWriteResponse(response);

      await refreshData();

      return result.ok === false
        ? result.message || "Transaction saved locally. DoorScale sync will retry later."
        : undefined;
    },
    [activeLocationId, refreshData],
  );

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      const dueDateTime = getDueDateTime(input.dueDate, input.dueTime);

      if (isDemoMode()) {
        const createdTask: DashboardTask = {
          id: `task-${Date.now()}`,
          assignedTo: input.assignedTo,
          clientName: "",
          description: input.description,
          dueDate: input.dueDate,
          dueDateTime: dueDateTime ?? "",
          propertyAddress: "",
          relatedOpportunityId: input.transactionId,
          status: input.status || "pending",
          title: input.title,
          transactionId: input.transactionId,
        };

        setData((currentData) => ({
          ...currentData,
          tasks: [...currentData.tasks, createdTask],
        }));
        return;
      }

      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save task data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action: "createTask",
          active_location_id: locationId,
          assignedTo: input.assignedTo,
          description: input.description,
          dueDate: input.dueDate || null,
          dueDateTime,
          status: input.status || "pending",
          title: input.title,
          transactionId: input.transactionId,
          locationId,
        }),
      });
      const result = await parseTaskWriteResponse(response);

      await refreshData();

      if (result.ok === false) {
        return result.message || "Task saved locally. DoorScale sync will retry later.";
      }

      return result.message || "Task saved.";
    },
    [activeLocationId, refreshData],
  );

  const markTaskCompleted = useCallback(
    async (taskId: string) => {
      if (isDemoMode()) {
        setData((currentData) => ({
          ...currentData,
          tasks: currentData.tasks.map((task) =>
            task.id === taskId ? { ...task, status: "completed" } : task,
          ),
        }));
        return;
      }

      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save task data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action: "updateTask",
          active_location_id: locationId,
          locationId,
          status: "completed",
          taskId,
        }),
      });
      const result = await parseTaskWriteResponse(response);

      await refreshData();

      if (result.ok === false) {
        throw new Error(
          result.message || "Task saved locally. DoorScale sync will retry later.",
        );
      }
    },
    [activeLocationId, refreshData],
  );

  const updateTaskDueDateTime = useCallback(
    async ({ dueDate, dueTime, taskId }: UpdateTaskDueDateTimeInput) => {
      const dueDateTime = getDueDateTime(dueDate, dueTime);

      if (isDemoMode()) {
        setData((currentData) => ({
          ...currentData,
          tasks: currentData.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  dueDate,
                  dueDateTime: dueDateTime ?? "",
                }
              : task,
          ),
        }));
        return;
      }

      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save task data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action: "updateTask",
          active_location_id: locationId,
          dueDate: dueDate || null,
          dueDateTime,
          locationId,
          taskId,
        }),
      });
      const result = await parseTaskWriteResponse(response);

      await refreshData();

      if (result.ok === false) {
        throw new Error(
          result.message || "Task saved locally. DoorScale sync will retry later.",
        );
      }
    },
    [activeLocationId, refreshData],
  );

  const retryTransactionSync = useCallback(
    async (transactionId: string) => {
      const transaction = data.opportunities.find(
        (opportunity) => String(opportunity.id) === String(transactionId),
      );
      const transactionRow = data.transactions.find(
        (currentTransaction) => String(currentTransaction.id) === String(transactionId),
      );

      if (!transaction) {
        throw new Error("Transaction not found.");
      }

      const fields = transaction.customFields;
      const clientNameParts = (transactionRow?.clientName || fields.contactName || "")
        .trim()
        .split(/\s+/);
      const clientFirstName =
        transactionRow?.clientFirstName || clientNameParts[0] || "";
      const clientLastName =
        transactionRow?.clientLastName || clientNameParts.slice(1).join(" ") || "";
      const action = transaction.ghlOpportunityId
        ? "updateTransaction"
        : "createTransaction";
      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save transaction data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action,
          active_location_id: locationId,
          assignedTo: transactionRow?.assignedTo || fields.assignedAgent || "",
          buyerName: transactionRow?.buyerName || fields.buyerName,
          clientEmail:
            transactionRow?.clientEmail ||
            transactionRow?.contactEmail ||
            fields.contactEmail ||
            "",
          clientFirstName,
          clientLastName,
          clientPhone:
            transactionRow?.clientPhone ||
            transactionRow?.contactPhone ||
            fields.contactPhone ||
            "",
          closingDate: transactionRow?.closeDate || fields.closingDate,
          commission: String(transactionRow?.commission ?? transaction.value ?? 0),
          inspectionDate: transactionRow?.inspectionDate || fields.inspectionDeadline,
          propertyAddress:
            transactionRow?.propertyAddress ||
            fields.propertyAddress ||
            transaction.name,
          sellerName: transactionRow?.sellerName || fields.sellerName,
          stage: transaction.stage,
          status: transaction.status,
          locationId,
          transactionId,
          transactionType: transactionRow?.type || fields.transactionType,
        }),
      });
      const result = await parseTransactionWriteResponse(response);

      await refreshData();

      return result.ok === false
        ? result.message || "Transaction saved locally. DoorScale sync will retry later."
        : "Transaction synced.";
    },
    [activeLocationId, data.opportunities, data.transactions, refreshData],
  );

  const retryTaskSync = useCallback(
    async (taskId: string) => {
      const task = data.tasks.find((currentTask) => currentTask.id === taskId);

      if (!task) {
        throw new Error("Task not found.");
      }

      const action = task.ghlTaskId ? "updateTask" : "createTask";
      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Connect DoorScale to save task data.");
      }

      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action,
          active_location_id: locationId,
          assignedTo: task.assignedTo,
          dueDate: task.dueDate || null,
          dueDateTime: task.dueDateTime || null,
          status: task.status,
          taskId,
          title: task.title,
          transactionId: task.transactionId,
          locationId,
        }),
      });
      const result = await parseTaskWriteResponse(response);

      await refreshData();

      return result.ok === false
        ? result.message || "Task saved locally. DoorScale sync will retry later."
        : "Task synced.";
    },
    [activeLocationId, data.tasks, refreshData],
  );

  const updateDocumentStatus = useCallback(
    async ({ documentId, status, transactionId }: UpdateDocumentStatusInput) => {
      if (isDemoMode()) {
        setData((currentData) => ({
          ...currentData,
          documents: currentData.documents.map((document) =>
            document.id === documentId ? { ...document, status } : document,
          ),
        }));
        return { message: "Document status updated.", status: 200 };
      }

      const client = getSupabaseClient();

      if (!client) {
        throw new Error("DoorScale connection is not configured.");
      }
      const locationId = activeLocationId || (await getActiveLocationId());
      const normalizedStatus = normalizeDocumentStatusValue(status);

      setData((currentData) => ({
        ...currentData,
        documents: currentData.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                status: normalizedStatus,
              }
            : document,
        ),
      }));

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action: "updateStatus",
          active_location_id: locationId,
          document_id: documentId,
          status: normalizedStatus,
          transaction_id: transactionId,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as DocumentStatusResponse;

      if (!response.ok || result.ok === false) {
        await refreshData();
        throw new Error(result.message || "Unable to update document status.");
      }

      if (result.document) {
        setData((currentData) => ({
          ...currentData,
          documents: currentData.documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  status: normalizeDocumentStatusValue(
                    result.document?.status ?? normalizedStatus,
                  ),
                  deliveryType:
                    result.document?.deliveryType ||
                    result.document?.delivery_type ||
                    document.deliveryType,
                  documentName:
                    result.document?.documentName ||
                    result.document?.document_name ||
                    document.documentName,
                  documentType:
                    result.document?.documentType ||
                    result.document?.document_type ||
                    document.documentType,
                  doorScaleFileId:
                    result.document?.doorScaleFileId ||
                    result.document?.doorscale_file_id ||
                    document.doorScaleFileId,
                  fileName:
                    result.document?.fileName ||
                    result.document?.file_name ||
                    document.fileName,
                  filePath:
                    result.document?.filePath ||
                    result.document?.file_path ||
                    document.filePath,
                  fileUrl:
                    result.document?.fileUrl ||
                    result.document?.file_url ||
                    document.fileUrl,
                  uploadedAt:
                    result.document?.uploadedAt ||
                    result.document?.uploaded_at ||
                    document.uploadedAt,
                  templateId:
                    result.document?.templateId ||
                    result.document?.template_id ||
                    document.templateId,
                }
              : document,
          ),
        }));
        return {
          message: result.message || "Document status updated.",
          status: response.status,
        };
      }

      await refreshData();
      return {
        message: result.message || "Document status updated.",
        status: response.status,
      };
    },
    [activeLocationId, refreshData],
  );

  const uploadTransactionDocument = useCallback(
    async ({ documentId, documentType, file, transactionId }: UploadDocumentInput) => {
      if (isDemoMode()) {
        const uploadedAt = new Date().toISOString();

        setData((currentData) => ({
          ...currentData,
          documents: currentData.documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  fileName: file.name,
                  status: "uploaded",
                  uploadedAt,
                }
              : document,
          ),
        }));
        return { message: "Document uploaded.", status: 200 };
      }

      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId) {
        throw new Error("Open this dashboard from your DoorScale account.");
      }

      const formData = new FormData();
      formData.append("active_location_id", locationId);
      formData.append("document_id", documentId);
      formData.append("documentId", documentId);
      formData.append("documentType", documentType);
      formData.append("transaction_id", transactionId);
      formData.append("transactionId", transactionId);
      formData.append("file", file);

      formData.append("action", "upload");

      const response = await fetch("/api/documents?action=upload", {
        method: "POST",
        headers: {
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: formData,
      });
      console.log("Document upload response status:", response.status);
      const result = (await response.json().catch(() => ({}))) as DocumentUploadResponse;

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || "Unable to upload document.");
      }

      if (result.document) {
        setData((currentData) => ({
          ...currentData,
          documents: currentData.documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  doorScaleFileId:
                    result.document?.doorScaleFileId ||
                    result.document?.doorscale_file_id ||
                    result.document?.file_path ||
                    result.document?.filePath ||
                    document.doorScaleFileId,
                  fileName:
                    result.document?.fileName ||
                    result.document?.file_name ||
                    file.name,
                  filePath:
                    result.document?.filePath ||
                    result.document?.file_path ||
                    document.filePath,
                  fileUrl:
                    result.document?.fileUrl ||
                    result.document?.file_url ||
                    document.fileUrl,
                  templateId:
                    result.document?.templateId ||
                    result.document?.template_id ||
                    document.templateId,
                  status: normalizeDocumentStatusValue(
                    result.document?.status ?? "uploaded",
                  ),
                  uploadedAt:
                    result.document?.uploadedAt ||
                    result.document?.uploaded_at ||
                    new Date().toISOString(),
                }
              : document,
          ),
        }));
        return {
          message: result.message || "Document uploaded.",
          status: response.status,
        };
      }

      await refreshData();
      return {
        message: result.message || "Document uploaded.",
        status: response.status,
      };
    },
    [activeLocationId, refreshData],
  );

  const ensureTransactionDocuments = useCallback(
    async ({
      stage,
      transactionId,
      transactionType,
    }: EnsureTransactionDocumentsInput) => {
      if (isDemoMode()) return;

      const client = getSupabaseClient();

      if (!client) return;

      const locationId = activeLocationId || (await getActiveLocationId());

      if (!locationId || !transactionId) return;

      try {
        let documentsResult = await loadTransactionDocuments(
          client,
          locationId,
          transactionId,
        );

        if (documentsResult.error) {
          console.warn("DoorScale transaction documents unavailable:", {
            error: documentsResult.error,
            locationId,
            transactionId,
          });
          return;
        }

        await generateDocumentChecklist(
          client,
          locationId,
          transactionId,
          transactionType,
          stage,
        );
        documentsResult = await loadTransactionDocuments(
          client,
          locationId,
          transactionId,
        );

        if (documentsResult.error) {
          console.warn("DoorScale transaction documents reload unavailable:", {
            error: documentsResult.error,
            locationId,
            transactionId,
          });
          return;
        }

        const documents = ((documentsResult.data ?? []) as SupabaseTransactionDocument[])
          .map(mapSupabaseDocument);

        setData((currentData) => ({
          ...currentData,
          documents: [
            ...currentData.documents.filter(
              (document) =>
                !(
                  String(document.locationId) === String(locationId) &&
                  String(document.transactionId) === String(transactionId)
                ),
            ),
            ...documents,
          ],
        }));
      } catch (documentError) {
        console.warn("DoorScale document checklist is still preparing:", {
          error: documentError,
          locationId,
          transactionId,
        });
      }
    },
    [activeLocationId],
  );

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(
    () =>
      subscribeToActiveLocationChange(() => {
        void refreshData();
      }),
    [refreshData],
  );

  return useMemo(() => {
    const activeTransactions = data.transactions.filter(
      (transaction) => !["Closed", "Dead"].includes(transaction.stage),
    );

    const totalCommission = activeTransactions.reduce(
      (sum, transaction) => sum + transaction.commission,
      0,
    );
    const documentCounts = data.documents.reduce<DocumentStatusCounts>(
      (counts, document) => {
        counts[normalizeDocumentStatusValue(document.status)] += 1;
        return counts;
      },
      emptyDocumentCounts(),
    );

    const stageCounts = data.transactions.reduce<Record<TransactionStage, number>>(
      (counts, transaction) => ({
        ...counts,
        [transaction.stage]: counts[transaction.stage] + 1,
      }),
      {
        "Pre-listing": 0,
        Active: 0,
        "Under Contract": 0,
        Inspections: 0,
        Appraisal: 0,
        "Clear to Close": 0,
        Closed: 0,
        Dead: 0,
      },
    );

    return {
      ...data,
      activeTransactions,
      openTasks: data.tasks.filter(
        (task) => task.status.toLowerCase() === "pending",
      ).sort((firstTask, secondTask) => {
        const firstDate = new Date(
          firstTask.dueDateTime || firstTask.dueDate,
        ).getTime();
        const secondDate = new Date(
          secondTask.dueDateTime || secondTask.dueDate,
        ).getTime();

        return (Number.isNaN(firstDate) ? Infinity : firstDate) -
          (Number.isNaN(secondDate) ? Infinity : secondDate);
      }),
      totalCommission,
      documentCounts,
      stageCounts,
      loading,
      error,
      refreshData,
      createTask,
      createTransaction,
      updateTransactionDetails,
      updateTransactionStage,
      markTaskCompleted,
      updateTaskDueDateTime,
      retryTransactionSync,
      retryTaskSync,
      updateDocumentStatus,
      uploadTransactionDocument,
      ensureTransactionDocuments,
    };
  }, [
    createTask,
    createTransaction,
    data,
    error,
    ensureTransactionDocuments,
    loading,
    markTaskCompleted,
    refreshData,
    retryTaskSync,
    retryTransactionSync,
    updateDocumentStatus,
    uploadTransactionDocument,
    updateTransactionDetails,
    updateTaskDueDateTime,
    updateTransactionStage,
  ]);
}

export const useCRMData = useCrmData;
