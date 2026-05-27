import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCRMData } from "@/hooks/use-crm-data";
import { formatCurrency } from "@/lib/utils";

export default function Commissions() {
  const { activeTransactions, error, loadDebug, loading, totalCommission, transactions } =
    useCRMData();

  const closedCommission = transactions
    .filter((transaction) => transaction.stage === "Closed")
    .reduce((sum, transaction) => sum + transaction.commission, 0);
  const deadCommission = transactions
    .filter((transaction) => transaction.stage === "Dead")
    .reduce((sum, transaction) => sum + transaction.commission, 0);

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Revenue visibility</p>
          <h2>Commissions</h2>
          <p>Track projected, closed, and inactive commission totals.</p>
          {loading ? <p className="dashboard__status">Loading DoorScale data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
          <div className="debug-panel">
            <strong>Load debug</strong>
            <span>route called: {loadDebug.routeCalled}</span>
            <span>response status: {loadDebug.responseStatus}</span>
            <span>response body preview: {loadDebug.responseBodyPreview}</span>
            <span>parsed transactions: {loadDebug.parsedTransactionCount}</span>
            <span>parsed documents: {loadDebug.parsedDocumentCount}</span>
          </div>
        </div>
      </header>

      <section className="stats-grid" aria-label="Commission totals">
        <Card>
          <CardHeader>
            <CardDescription>Projected Commission</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{formatCurrency(totalCommission)}</strong>
            <span>from active transactions</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Closed Commission</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{formatCurrency(closedCommission)}</strong>
            <span>from closed transactions</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Inactive Commission</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{formatCurrency(deadCommission)}</strong>
            <span>from dead transactions</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active Deals</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{activeTransactions.length}</strong>
            <span>contributing to projection</span>
          </CardContent>
        </Card>
      </section>

      <section className="commission-list" aria-label="Commission by transaction">
        {transactions.map((transaction) => (
          <Card key={transaction.id}>
            <CardHeader>
              <div>
                <CardTitle>{transaction.clientName}</CardTitle>
                <CardDescription>
                  {transaction.propertyAddress || transaction.type || "Transaction type not set"}
                </CardDescription>
              </div>
              <Badge
                variant={
                  transaction.stage === "Closed"
                    ? "success"
                    : transaction.stage === "Dead"
                      ? "danger"
                      : "default"
                }
              >
                {transaction.stage}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="commission-row">
                <span>{transaction.type || "Transaction type not set"}</span>
                <strong>{formatCurrency(transaction.commission)}</strong>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
