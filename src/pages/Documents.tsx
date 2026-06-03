import { FileCheck2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCRMData } from "@/hooks/use-crm-data";
import { withActiveLocationPath } from "@/lib/active-location";

function statusVariant(status: string) {
  if (["uploaded", "approved", "completed"].includes(status)) return "success";
  if (["missing", "rejected"].includes(status)) return "danger";
  if (["pending_review", "sent", "viewed"].includes(status)) return "default";
  return "warning";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function Documents() {
  const { documents, error, loading, transactions } = useCRMData();

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Document readiness</p>
          <h2>Documents</h2>
          <p>Review transaction document checklists and outstanding items.</p>
          {loading ? <p className="dashboard__status">Loading DoorScale data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
        </div>
      </header>

      <section className="entity-grid" aria-label="Transaction documents">
        {transactions.map((transaction) => {
          const transactionDocuments = documents.filter(
            (document) => String(document.transactionId) === String(transaction.id),
          );

          return (
            <Card key={transaction.id}>
              <CardHeader>
                <div>
                  <CardTitle>{transaction.clientName}</CardTitle>
                  <CardDescription>{transaction.propertyAddress}</CardDescription>
                </div>
                <FileText size={20} />
              </CardHeader>
              <CardContent>
                <div className="document-page-list">
                  {transactionDocuments.map((document) => (
                    <div className="document-page-row" key={document.id}>
                      <span>{document.documentName || document.documentType}</span>
                      <Badge variant={statusVariant(document.status)}>
                        {statusLabel(document.status)}
                      </Badge>
                    </div>
                  ))}
                  {!transactionDocuments.length ? (
                    <p className="empty-state">Document checklist is still preparing.</p>
                  ) : null}
                </div>
                <Link
                  className="button button--secondary"
                  to={withActiveLocationPath(`/transactions/${transaction.id}`)}
                >
                  <FileCheck2 size={16} />
                  Open Checklist
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
