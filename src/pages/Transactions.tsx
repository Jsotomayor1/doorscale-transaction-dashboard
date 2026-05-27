import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, Filter, Home, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TRANSACTION_STAGES,
  type Transaction,
  type TransactionStage,
  useCRMData,
} from "@/hooks/use-crm-data";
import { withActiveLocationPath } from "@/lib/active-location";
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

function participantLine(transaction: Transaction) {
  const participants = [
    transaction.buyerName ? `Buyer: ${transaction.buyerName}` : "",
    transaction.sellerName ? `Seller: ${transaction.sellerName}` : "",
  ].filter(Boolean);

  return participants.length ? participants.join(" | ") : transaction.clientName;
}

export default function Transactions() {
  const { error, loading, transactions } = useCRMData();
  const [stageFilter, setStageFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const transactionTypes = useMemo(
    () =>
      Array.from(new Set(transactions.map((transaction) => transaction.type)))
        .filter(Boolean)
        .sort(),
    [transactions],
  );

  const filteredTransactions = transactions.filter((transaction) => {
    const stageMatches =
      stageFilter === "all" || transaction.stage === stageFilter;
    const typeMatches = typeFilter === "all" || transaction.type === typeFilter;

    return stageMatches && typeMatches;
  });

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Pipeline inventory</p>
          <h2>Transactions</h2>
          <p>Filter every DoorScale transaction by stage and type.</p>
          {loading ? <p className="dashboard__status">Loading DoorScale data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
        </div>
      </header>

      <section className="filter-bar" aria-label="Transaction filters">
        <label>
          <Filter size={16} />
          <span>Stage</span>
          <select
            onChange={(event) => setStageFilter(event.target.value)}
            value={stageFilter}
          >
            <option value="all">All stages</option>
            {TRANSACTION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Search size={16} />
          <span>Type</span>
          <select
            onChange={(event) => setTypeFilter(event.target.value)}
            value={typeFilter}
          >
            <option value="all">All types</option>
            {transactionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="entity-grid" aria-label="Transactions">
        {filteredTransactions.map((transaction) => (
          <Link
            aria-label={`Open transaction ${transaction.clientName}`}
            className="transaction-card-link"
            key={transaction.id}
            to={withActiveLocationPath(`/transactions/${transaction.id}`)}
          >
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{transaction.clientName}</CardTitle>
                  <CardDescription>
                    {transaction.propertyAddress || participantLine(transaction)}
                  </CardDescription>
                </div>
                <Badge variant={stageVariant(transaction.stage)}>
                  {transaction.stage}
                </Badge>
              </CardHeader>
              <CardContent>
                <dl className="detail-list">
                  <div>
                    <dt>Transaction Type</dt>
                    <dd>{transaction.type || "Not set"}</dd>
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
                  <div>
                    <dt>Needed Documents</dt>
                    <dd>{transaction.documentCounts?.needed ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Missing Documents</dt>
                    <dd>{transaction.documentCounts?.missing ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Uploaded Documents</dt>
                    <dd>{transaction.documentCounts?.uploaded ?? 0}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {!loading && filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="empty-state">
            <Home size={20} />
            No transactions match the current filters.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
