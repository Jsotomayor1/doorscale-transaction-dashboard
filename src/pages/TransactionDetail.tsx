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

function stageVariant(stage: TransactionStage) {
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
  const { error, loading, tasks, transactions } = useCRMData();
  const transaction = transactions.find((item) => item.id === id);

  if (loading) {
    return (
      <div className="dashboard">
        <p className="dashboard__status">Loading Supabase data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <p className="dashboard__error">{error}</p>
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
          <CardContent className="empty-state">Transaction not found.</CardContent>
        </Card>
      </div>
    );
  }

  const relatedTasks = tasks.filter(
    (task) =>
      task.relatedOpportunityId === transaction.id ||
      task.transactionId === transaction.id,
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
          <h2>{transaction.propertyAddress}</h2>
          <p>{transaction.type || "Transaction type not set"}</p>
        </div>
        <Badge variant={stageVariant(transaction.stage)}>{transaction.stage}</Badge>
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
                <dd>{transaction.propertyAddress}</dd>
              </div>
              <div>
                <dt>Transaction Type</dt>
                <dd>{transaction.type || "Not set"}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{transaction.stage}</dd>
              </div>
              <div>
                <dt>Buyer Name</dt>
                <dd>{transaction.buyerName || "Not set"}</dd>
              </div>
              <div>
                <dt>Seller Name</dt>
                <dd>{transaction.sellerName || "Not set"}</dd>
              </div>
              <div>
                <dt>Closing Date</dt>
                <dd>
                  <CalendarClock size={15} />
                  {formatDate(transaction.closeDate)}
                </dd>
              </div>
              <div>
                <dt>Inspection Date</dt>
                <dd>{formatDate(transaction.inspectionDate)}</dd>
              </div>
              <div>
                <dt>Commission</dt>
                <dd>{formatCurrency(transaction.commission)}</dd>
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
              <CardDescription>
                Tasks tied to this transaction id.
              </CardDescription>
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
