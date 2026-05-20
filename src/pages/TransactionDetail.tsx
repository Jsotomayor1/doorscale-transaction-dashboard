import { format } from "date-fns";
import { ArrowLeft, CalendarClock, CheckSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type TransactionStage, useCRMData } from "@/hooks/use-crm-data";
import { formatCurrency } from "@/lib/utils";

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (!dateValue || Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return format(date, "MMM d, yyyy");
}

function stageVariant(stage: string) {
  if (stage === "Clear to Close") return "success";
  if (stage === "Inspections" || stage === "Appraisal") return "warning";
  if (stage === "Closed") return "muted";
  if (stage === "Dead") return "danger";
  return "default";
}

function taskVariant(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "pending") return "warning";
  if (normalizedStatus === "completed" || normalizedStatus === "done") {
    return "success";
  }
  if (normalizedStatus === "blocked") return "danger";

  return "muted";
}

export default function TransactionDetail() {
  const { id } = useParams();
  const data = useCRMData();
  const transaction = data.opportunities.find(
    (opp) => String(opp.id) === String(id),
  );

  if (data.loading) {
    return (
      <div className="dashboard">
        <p className="dashboard__status">Loading Supabase data...</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="dashboard">
        <p className="dashboard__error">{data.error}</p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="dashboard">
        <Link className="back-link" to="/transactions">
          <ArrowLeft size={16} />
          Transactions
        </Link>
        <Card>
          <CardContent>
            <div className="empty-state">Transaction not found.</div>
            <div className="debug-panel">
              <strong>Debug</strong>
              <span>URL id: {id ?? "missing"}</span>
              <span>
                Available opportunity ids:{" "}
                {data.opportunities.length
                  ? data.opportunities.map((opp) => String(opp.id)).join(", ")
                  : "none"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fields = transaction.customFields;
  const relatedTasks = data.tasks.filter(
    (task) =>
      String(task.relatedOpportunityId) === String(transaction.id) ||
      String(task.transactionId) === String(transaction.id),
  );

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <Link className="back-link" to="/transactions">
            <ArrowLeft size={16} />
            Transactions
          </Link>
          <p className="dashboard__eyebrow">Transaction record</p>
          <h2>{fields.propertyAddress || transaction.name}</h2>
          <p>{fields.transactionType || "Transaction type not set"}</p>
        </div>
        <Badge variant={stageVariant(transaction.stage)}>
          {transaction.stage as TransactionStage}
        </Badge>
      </header>

      <section className="dashboard-grid">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Transaction Details</CardTitle>
              <CardDescription>Supabase transaction fields.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="detail-list">
              <div>
                <dt>Property Address</dt>
                <dd>{fields.propertyAddress || transaction.name}</dd>
              </div>
              <div>
                <dt>Transaction Type</dt>
                <dd>{fields.transactionType || "Not set"}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{transaction.stage || "Not set"}</dd>
              </div>
              <div>
                <dt>Buyer Name</dt>
                <dd>{fields.buyerName || "Not set"}</dd>
              </div>
              <div>
                <dt>Seller Name</dt>
                <dd>{fields.sellerName || "Not set"}</dd>
              </div>
              <div>
                <dt>Closing Date</dt>
                <dd>
                  <CalendarClock size={15} />
                  {formatDate(fields.closingDate)}
                </dd>
              </div>
              <div>
                <dt>Inspection Date</dt>
                <dd>{formatDate(fields.inspectionDeadline)}</dd>
              </div>
              <div>
                <dt>Commission</dt>
                <dd>{formatCurrency(transaction.value)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{transaction.status || "Not set"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Related Tasks</CardTitle>
              <CardDescription>Tasks tied to this transaction id.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {relatedTasks.length ? (
              <div className="task-list">
                {relatedTasks.map((task) => (
                  <article className="task-row" key={task.id}>
                    <div>
                      <h3>{task.title}</h3>
                      <p>{task.assignedTo || "Unassigned"}</p>
                    </div>
                    <Badge variant={taskVariant(task.status)}>{task.status}</Badge>
                    <span className="task-row__due">
                      <CheckSquare size={15} />
                      {formatDate(task.dueDate)}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No related tasks found.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
