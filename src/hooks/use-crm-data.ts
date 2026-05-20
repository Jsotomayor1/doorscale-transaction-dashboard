import { addDays, subDays } from "date-fns";

export type TransactionStage =
  | "Lead"
  | "Under Contract"
  | "Inspection"
  | "Appraisal"
  | "Closing"
  | "Closed";

export type TransactionType = "Buyer" | "Seller" | "Dual Agency";

export type TaskStatus = "Open" | "In Progress" | "Blocked" | "Done";

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
  contractValue: number;
  commission: number;
  tasks: TransactionTask[];
};

const today = new Date();

const transactions: Transaction[] = [
  {
    id: "txn-1001",
    clientName: "Avery Johnson",
    propertyAddress: "1842 Harbor View Dr, Tampa, FL",
    type: "Buyer",
    stage: "Inspection",
    closeDate: addDays(today, 18).toISOString(),
    contractValue: 645000,
    commission: 19350,
    tasks: [
      {
        id: "task-1",
        title: "Confirm inspection repair response",
        status: "In Progress",
        dueDate: addDays(today, 1).toISOString(),
        owner: "Transaction Coordinator",
      },
      {
        id: "task-2",
        title: "Upload earnest money receipt",
        status: "Done",
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
    stage: "Appraisal",
    closeDate: addDays(today, 27).toISOString(),
    contractValue: 785000,
    commission: 23550,
    tasks: [
      {
        id: "task-3",
        title: "Send appraisal access instructions",
        status: "Open",
        dueDate: addDays(today, 2).toISOString(),
        owner: "Agent",
      },
      {
        id: "task-4",
        title: "Verify payoff statement request",
        status: "Open",
        dueDate: addDays(today, 5).toISOString(),
        owner: "Closing Team",
      },
    ],
  },
  {
    id: "txn-1003",
    clientName: "Priya Shah",
    propertyAddress: "77 Magnolia Park Ln, Raleigh, NC",
    type: "Dual Agency",
    stage: "Closing",
    closeDate: addDays(today, 7).toISOString(),
    contractValue: 532000,
    commission: 31920,
    tasks: [
      {
        id: "task-5",
        title: "Review final CD with client",
        status: "Blocked",
        dueDate: addDays(today, 0).toISOString(),
        owner: "Agent",
      },
      {
        id: "task-6",
        title: "Confirm wire instructions were received",
        status: "Open",
        dueDate: addDays(today, 1).toISOString(),
        owner: "Closing Team",
      },
    ],
  },
  {
    id: "txn-1004",
    clientName: "Elliot Brooks",
    propertyAddress: "304 W Stonebridge Ct, Denver, CO",
    type: "Buyer",
    stage: "Under Contract",
    closeDate: addDays(today, 34).toISOString(),
    contractValue: 710000,
    commission: 21300,
    tasks: [
      {
        id: "task-7",
        title: "Schedule home inspection",
        status: "Open",
        dueDate: addDays(today, 3).toISOString(),
        owner: "Transaction Coordinator",
      },
    ],
  },
];

export function useCrmData() {
  const tasks = transactions.flatMap((transaction) =>
    transaction.tasks.map((task) => ({
      ...task,
      transactionId: transaction.id,
      propertyAddress: transaction.propertyAddress,
      clientName: transaction.clientName,
    })),
  );

  const totalCommission = transactions.reduce(
    (sum, transaction) => sum + transaction.commission,
    0,
  );

  const activeTransactions = transactions.filter(
    (transaction) => transaction.stage !== "Closed",
  );

  const stageCounts = transactions.reduce<Record<TransactionStage, number>>(
    (counts, transaction) => ({
      ...counts,
      [transaction.stage]: counts[transaction.stage] + 1,
    }),
    {
      Lead: 0,
      "Under Contract": 0,
      Inspection: 0,
      Appraisal: 0,
      Closing: 0,
      Closed: 0,
    },
  );

  return {
    transactions,
    activeTransactions,
    tasks,
    openTasks: tasks.filter((task) => task.status !== "Done"),
    totalCommission,
    stageCounts,
  };
}
