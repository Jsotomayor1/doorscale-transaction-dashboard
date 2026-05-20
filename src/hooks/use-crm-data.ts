import { useEffect, useMemo, useState } from "react";
import { addDays, subDays } from "date-fns";
import { createClient } from "@supabase/supabase-js";

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

export type TaskStatus = "Open" | "In Progress" | "Blocked" | "Done" | string;

export type TransactionTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
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
  createdAt: string;
  updatedAt: string;
  tasks: TransactionTask[];
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
    grossCommission: number;
    netCommission: number;
    agentPayout: number;
    missingDocuments: string[];
  };
};

export type DashboardTask = {
  id: string;
  title: string;
  dueDate: string;
  assignedTo: string;
  status: string;
  relatedOpportunityId: string;
  transactionId: string;
  propertyAddress: string;
  clientName: string;
};

type SupabaseTransaction = {
  id: string;
  location_id: string;
  property_address: string | null;
  transaction_type: string | null;
  stage: string | null;
  buyer_name: string | null;
  seller_name: string | null;
  closing_date: string | null;
  inspection_date: string | null;
  commission: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseTask = {
  id: string;
  location_id: string;
  transaction_id: string | null;
  title: string | null;
  due_date: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string | null;
};

type CrmDataState = {
  transactions: Transaction[];
  opportunities: Opportunity[];
  tasks: DashboardTask[];
};

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
        owner: "Transaction Coordinator",
      },
      {
        id: "task-2",
        title: "Upload earnest money receipt",
        status: "completed",
        dueDate: subDays(today, 1).toISOString(),
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
        owner: "Agent",
      },
      {
        id: "task-4",
        title: "Verify payoff statement request",
        status: "pending",
        dueDate: addDays(today, 5).toISOString(),
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
      grossCommission: commission,
      netCommission: commission,
      agentPayout: commission,
      missingDocuments: [],
    },
  };
}

function mapSupabaseData(
  supabaseTransactions: SupabaseTransaction[],
  supabaseTasks: SupabaseTask[],
): CrmDataState {
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
      createdAt: transaction.created_at ?? "",
      updatedAt: transaction.updated_at ?? transaction.created_at ?? "",
      tasks: relatedTasks.map((task) => ({
        id: task.id,
        title: task.title ?? "Untitled task",
        status: task.status ?? "pending",
        dueDate: task.due_date ?? "",
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
        assignedTo: task.assigned_to ?? "",
        status: task.status ?? "pending",
        relatedOpportunityId: task.transaction_id ?? "",
        transactionId: task.transaction_id ?? "",
        propertyAddress: transaction?.propertyAddress ?? "",
        clientName: transaction?.clientName ?? "",
      };
    }),
  };
}

function mapDemoData(): CrmDataState {
  const tasks = demoTransactions.flatMap((transaction) =>
    transaction.tasks.map((task) => ({
      ...task,
      dueDate: task.dueDate,
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
  };
}

const emptyData: CrmDataState = {
  transactions: [],
  opportunities: [],
  tasks: [],
};

export function useCrmData() {
  const [data, setData] = useState<CrmDataState>(() =>
    isDemoMode() ? mapDemoData() : emptyData,
  );
  const [loading, setLoading] = useState(!isDemoMode());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode()) {
      setData(mapDemoData());
      setLoading(false);
      setError(null);
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoading(false);
      setError("Supabase environment variables are not configured.");
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadCrmData() {
      setLoading(true);
      setError(null);

      const [transactionsResult, tasksResult] = await Promise.all([
        client
          .from("transactions")
          .select(
            "id, location_id, property_address, transaction_type, stage, buyer_name, seller_name, closing_date, inspection_date, commission, status, created_at, updated_at",
          )
          .eq("location_id", LOCATION_ID),
        client
          .from("tasks")
          .select(
            "id, location_id, transaction_id, title, due_date, status, assigned_to, created_at",
          )
          .eq("location_id", LOCATION_ID),
      ]);

      if (!isMounted) return;

      if (transactionsResult.error || tasksResult.error) {
        setLoading(false);
        setError(
          transactionsResult.error?.message ??
            tasksResult.error?.message ??
            "Unable to load CRM data.",
        );
        return;
      }

      setData(
        mapSupabaseData(
          transactionsResult.data ?? [],
          tasksResult.data ?? [],
        ),
      );
      setLoading(false);
    }

    void loadCrmData();

    return () => {
      isMounted = false;
    };
  }, []);

  return useMemo(() => {
    const activeTransactions = data.transactions.filter(
      (transaction) => !["Closed", "Dead"].includes(transaction.stage),
    );

    const totalCommission = activeTransactions.reduce(
      (sum, transaction) => sum + transaction.commission,
      0,
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
      ),
      totalCommission,
      stageCounts,
      loading,
      error,
    };
  }, [data, error, loading]);
}

export const useCRMData = useCrmData;
