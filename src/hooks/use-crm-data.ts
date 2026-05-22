import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, subDays } from "date-fns";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LOCATION_ID = "demo-location";

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
};

export type CreateTaskInput = {
  assignedTo: string;
  dueDate: string;
  dueTime: string;
  title: string;
  transactionId: string;
};

export type UpdateTransactionDetailsInput = {
  transactionId: string;
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
  ghlOpportunityId?: string;
};

export type DashboardTask = {
  id: string;
  title: string;
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
  transactionId: string;
  documentType: string;
  documentName: string;
  doorScaleFileId: string;
  doorScaleContactId: string;
  status: string;
  uploadedAt: string;
  createdAt: string;
};

export type DocumentStatus = "needed" | "uploaded" | "missing";

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
  closing_date: string | null;
  inspection_date: string | null;
  commission: number | null;
  status: string | null;
  sync_status: string | null;
  last_sync_error: string | null;
  last_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  ghl_opportunity_id?: string | null;
};

type SupabaseTask = {
  id: string;
  location_id: string;
  transaction_id: string | null;
  title: string | null;
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
  transaction_id: string | null;
  document_type: string | null;
  document_name: string | null;
  doorscale_file_id: string | null;
  doorscale_contact_id: string | null;
  status: string | null;
  uploaded_at: string | null;
  created_at: string | null;
};

type SupabaseTaskTemplate = {
  id: string;
  title: string | null;
  days_offset: number | null;
  assigned_role: string | null;
  sort_order: number | null;
};

type SupabaseDocumentTemplate = {
  id: string;
  document_type: string | null;
  document_name: string | null;
  sort_order: number | null;
};

type SupabaseTaskTitle = {
  title: string | null;
};

type SupabaseDocumentType = {
  document_type: string | null;
};

type CrmDataState = {
  transactions: Transaction[];
  opportunities: Opportunity[];
  tasks: DashboardTask[];
  documents: TransactionDocument[];
};

function normalizeDocumentStatusValue(status = "needed"): DocumentStatus {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === "uploaded") return "uploaded";
  if (normalizedStatus === "missing") return "missing";
  return "needed";
}

function emptyDocumentCounts(): DocumentStatusCounts {
  return {
    needed: 0,
    uploaded: 0,
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
  return (
    transaction.buyer_name ||
    transaction.seller_name ||
    transaction.property_address ||
    "Unknown Client"
  );
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
      assignedAgent: transaction.assigned_to ?? "",
      contactName: transaction.contact_name ?? "",
      contactEmail: transaction.contact_email ?? "",
      contactPhone: transaction.contact_phone ?? "",
      grossCommission: commission,
      netCommission: commission,
      agentPayout: commission,
      missingDocuments: [],
    },
    syncStatus: transaction.sync_status ?? "synced",
    lastSyncError: transaction.last_sync_error ?? "",
    lastSyncedAt: transaction.last_synced_at ?? "",
    ghlOpportunityId: transaction.ghl_opportunity_id ?? "",
  };
}

function mapSupabaseData(
  supabaseTransactions: SupabaseTransaction[],
  supabaseTasks: SupabaseTask[],
  supabaseDocuments: SupabaseTransactionDocument[],
): CrmDataState {
  const documents = supabaseDocuments.map<TransactionDocument>((document) => ({
    id: document.id,
    transactionId: document.transaction_id ?? "",
    documentType: document.document_type ?? "",
    documentName: document.document_name ?? "",
    doorScaleFileId: document.doorscale_file_id ?? "",
    doorScaleContactId: document.doorscale_contact_id ?? "",
    status: normalizeDocumentStatusValue(document.status ?? undefined),
    uploadedAt: document.uploaded_at ?? "",
    createdAt: document.created_at ?? "",
  }));
  const documentCountsByTransaction = documents.reduce<
    Record<string, DocumentStatusCounts>
  >((counts, document) => {
    const transactionId = document.transactionId;

    if (!transactionId) return counts;

    counts[transactionId] ??= emptyDocumentCounts();
    counts[transactionId][document.status as DocumentStatus] += 1;
    return counts;
  }, {});
  const transactions = supabaseTransactions.map<Transaction>((transaction) => {
    const relatedTasks = supabaseTasks.filter(
      (task) => task.transaction_id === transaction.id,
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
      assignedTo: transaction.assigned_to ?? "",
      contactName: transaction.contact_name ?? "",
      contactEmail: transaction.contact_email ?? "",
      contactPhone: transaction.contact_phone ?? "",
      createdAt: transaction.created_at ?? "",
      updatedAt: transaction.updated_at ?? transaction.created_at ?? "",
      syncStatus: transaction.sync_status ?? "synced",
      lastSyncError: transaction.last_sync_error ?? "",
      lastSyncedAt: transaction.last_synced_at ?? "",
      ghlOpportunityId: transaction.ghl_opportunity_id ?? "",
      documentCounts: documentCountsByTransaction[transaction.id] ?? emptyDocumentCounts(),
      tasks: relatedTasks.map((task) => ({
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
    transactions.map((transaction) => [transaction.id, transaction]),
  );

  return {
    transactions,
    opportunities: supabaseTransactions.map((transaction) =>
      toOpportunity(
        transaction,
        supabaseTasks.filter((task) => task.transaction_id === transaction.id),
      ),
    ),
    tasks: supabaseTasks.map((task) => {
      const transaction = transactionById.get(task.transaction_id ?? "");

      return {
        id: task.id,
        title: task.title ?? "Untitled task",
        dueDate: task.due_date ?? "",
        dueDateTime: task.due_datetime ?? task.due_date ?? "",
        assignedTo: task.assigned_to ?? "",
        status: task.status ?? "pending",
        relatedOpportunityId: task.transaction_id ?? "",
        transactionId: task.transaction_id ?? "",
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

function mapDemoData(): CrmDataState {
  const tasks = demoTransactions.flatMap((transaction) =>
    transaction.tasks.map((task) => ({
      ...task,
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

async function fetchCrmData(client: SupabaseClient): Promise<CrmDataState> {
  const [transactionsResult, tasksResult, documentsResult] = await Promise.all([
    client
      .from("transactions")
      .select(
        "id, location_id, property_address, transaction_type, stage, buyer_name, seller_name, assigned_to, contact_name, contact_email, contact_phone, closing_date, inspection_date, commission, status, sync_status, last_sync_error, last_synced_at, ghl_opportunity_id, created_at, updated_at",
      )
      .eq("location_id", LOCATION_ID),
    client
      .from("tasks")
      .select(
        "id, location_id, transaction_id, title, due_date, due_datetime, status, assigned_to, sync_status, last_sync_error, last_synced_at, ghl_task_id, created_at",
      )
      .eq("location_id", LOCATION_ID),
    client
      .from("transaction_documents")
      .select(
        "id, transaction_id, document_type, document_name, doorscale_file_id, doorscale_contact_id, status, uploaded_at, created_at",
      )
      .eq("location_id", LOCATION_ID),
  ]);

  if (transactionsResult.error || tasksResult.error || documentsResult.error) {
    console.error("DoorScale transaction query failed:", {
      transactionsError: transactionsResult.error,
      tasksError: tasksResult.error,
      documentsError: documentsResult.error,
    });
    throw new Error("Unable to load transaction data.");
  }

  return mapSupabaseData(
    transactionsResult.data ?? [],
    tasksResult.data ?? [],
    documentsResult.data ?? [],
  );
}

async function generateChecklistTasks(
  client: SupabaseClient,
  transactionId: string,
  transactionType: string,
  stage: TransactionStage,
) {
  const { data: templates, error: templateError } = await client
    .from("task_templates")
    .select("id, title, days_offset, assigned_role, sort_order")
    .eq("location_id", LOCATION_ID)
    .eq("transaction_type", transactionType)
    .eq("stage", stage)
    .order("sort_order", { ascending: true });

  if (templateError) {
    throw new Error("Unable to generate checklist tasks.");
  }

  const taskTemplates = (templates ?? []) as SupabaseTaskTemplate[];

  if (!taskTemplates.length) return;

  const { data: existingTasks, error: existingTasksError } = await client
    .from("tasks")
    .select("title")
    .eq("location_id", LOCATION_ID)
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
        location_id: LOCATION_ID,
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
  transactionId: string,
  transactionType: string,
  stage: string,
) {
  const { data: templates, error: templateError } = await client
    .from("document_templates")
    .select("id, document_type, document_name, sort_order")
    .eq("location_id", LOCATION_ID)
    .eq("transaction_type", transactionType)
    .eq("stage", stage)
    .order("sort_order", { ascending: true });

  if (templateError) {
    throw new Error("Unable to generate document checklist.");
  }

  const documentTemplates = (templates ?? []) as SupabaseDocumentTemplate[];

  if (!documentTemplates.length) return;

  const { data: existingDocuments, error: existingDocumentsError } = await client
    .from("transaction_documents")
    .select("document_type")
    .eq("location_id", LOCATION_ID)
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

      return documentType ? !existingTypes.has(documentType) : false;
    })
    .map((template) => ({
      location_id: LOCATION_ID,
      transaction_id: transactionId,
      document_type: template.document_type,
      document_name: template.document_name || template.document_type,
      status: "Needed",
    }));

  if (!documentRows.length) return;

  const { error: insertError } = await client
    .from("transaction_documents")
    .insert(documentRows);

  if (insertError) {
    throw new Error("Unable to create document checklist.");
  }
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
      setData(await fetchCrmData(client));
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
            input.buyerName ||
            input.sellerName ||
            input.propertyAddress ||
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

      const response = await fetch("/api/ghl/transactions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...input,
          status: "active",
        }),
      });
      const result = await parseTransactionWriteResponse(response);

      if (!result.transactionId) {
        throw new Error("Transaction was created, but no id was returned.");
      }

      await generateChecklistTasks(
        client,
        result.transactionId,
        input.transactionType,
        input.stage,
      );
      await generateDocumentChecklist(
        client,
        result.transactionId,
        input.transactionType,
        input.stage,
      );

      await refreshData();

      return result.ok === false
        ? result.message || "Transaction saved locally. DoorScale sync will retry later."
        : undefined;
    },
    [refreshData],
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

      const response = await fetch("/api/ghl/transactions/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: input.stage,
          transactionId: input.transactionId,
        }),
      });
      const result = await parseTransactionWriteResponse(response);

      await generateChecklistTasks(
        client,
        input.transactionId,
        input.transactionType,
        input.stage,
      );
      await generateDocumentChecklist(
        client,
        input.transactionId,
        input.transactionType,
        input.stage,
      );

      await refreshData();

      return result.ok === false
        ? result.message || "Transaction saved locally. DoorScale sync will retry later."
        : undefined;
    },
    [refreshData],
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
                    input.buyerName ||
                    input.sellerName ||
                    input.propertyAddress ||
                    transaction.clientName,
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

      const response = await fetch("/api/ghl/transactions/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const result = await parseTransactionWriteResponse(response);

      await refreshData();

      return result.ok === false
        ? result.message || "Transaction saved locally. DoorScale sync will retry later."
        : undefined;
    },
    [refreshData],
  );

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      const dueDateTime = getDueDateTime(input.dueDate, input.dueTime);

      if (isDemoMode()) {
        const createdTask: DashboardTask = {
          id: `task-${Date.now()}`,
          assignedTo: input.assignedTo,
          clientName: "",
          dueDate: input.dueDate,
          dueDateTime: dueDateTime ?? "",
          propertyAddress: "",
          relatedOpportunityId: input.transactionId,
          status: "pending",
          title: input.title,
          transactionId: input.transactionId,
        };

        setData((currentData) => ({
          ...currentData,
          tasks: [...currentData.tasks, createdTask],
        }));
        return;
      }

      const response = await fetch("/api/ghl/tasks/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedTo: input.assignedTo,
          dueDate: input.dueDate || null,
          dueDateTime,
          status: "pending",
          title: input.title,
          transactionId: input.transactionId,
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
    [refreshData],
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

      const response = await fetch("/api/ghl/tasks/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
    [refreshData],
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

      const response = await fetch("/api/ghl/tasks/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dueDate: dueDate || null,
          dueDateTime,
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
    [refreshData],
  );

  const retryTransactionSync = useCallback(
    async (transactionId: string) => {
      const transaction = data.opportunities.find(
        (opportunity) => String(opportunity.id) === String(transactionId),
      );

      if (!transaction) {
        throw new Error("Transaction not found.");
      }

      const fields = transaction.customFields;
      const endpoint = transaction.ghlOpportunityId
        ? "/api/ghl/transactions/update"
        : "/api/ghl/transactions/create";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyerName: fields.buyerName,
          closingDate: fields.closingDate,
          commission: String(transaction.value || 0),
          inspectionDate: fields.inspectionDeadline,
          propertyAddress: fields.propertyAddress || transaction.name,
          sellerName: fields.sellerName,
          stage: transaction.stage,
          status: transaction.status,
          transactionId,
          transactionType: fields.transactionType,
        }),
      });
      const result = await parseTransactionWriteResponse(response);

      await refreshData();

      return result.ok === false
        ? result.message || "Transaction saved locally. DoorScale sync will retry later."
        : "Transaction synced.";
    },
    [data.opportunities, refreshData],
  );

  const retryTaskSync = useCallback(
    async (taskId: string) => {
      const task = data.tasks.find((currentTask) => currentTask.id === taskId);

      if (!task) {
        throw new Error("Task not found.");
      }

      const endpoint = task.ghlTaskId
        ? "/api/ghl/tasks/update"
        : "/api/ghl/tasks/create";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedTo: task.assignedTo,
          dueDate: task.dueDate || null,
          dueDateTime: task.dueDateTime || null,
          status: task.status,
          taskId,
          title: task.title,
          transactionId: task.transactionId,
        }),
      });
      const result = await parseTaskWriteResponse(response);

      await refreshData();

      return result.ok === false
        ? result.message || "Task saved locally. DoorScale sync will retry later."
        : "Task synced.";
    },
    [data.tasks, refreshData],
  );

  const updateDocumentStatus = useCallback(
    async ({ documentId, status }: UpdateDocumentStatusInput) => {
      if (isDemoMode()) {
        setData((currentData) => ({
          ...currentData,
          documents: currentData.documents.map((document) =>
            document.id === documentId ? { ...document, status } : document,
          ),
        }));
        return;
      }

      const client = getSupabaseClient();

      if (!client) {
        throw new Error("DoorScale connection is not configured.");
      }

      const { error: updateError } = await client
        .from("transaction_documents")
        .update({ status })
        .eq("id", documentId);

      if (updateError) {
        throw new Error("Unable to update document status.");
      }

      await refreshData();
    },
    [refreshData],
  );

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

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
    };
  }, [
    createTask,
    createTransaction,
    data,
    error,
    loading,
    markTaskCompleted,
    refreshData,
    retryTaskSync,
    retryTransactionSync,
    updateDocumentStatus,
    updateTransactionDetails,
    updateTaskDueDateTime,
    updateTransactionStage,
  ]);
}

export const useCRMData = useCrmData;
