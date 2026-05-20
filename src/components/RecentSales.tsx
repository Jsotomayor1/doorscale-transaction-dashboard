import { format, formatDistanceToNowStrict } from "date-fns";
import { CalendarClock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Transaction } from "@/hooks/use-crm-data";
import { formatCurrency } from "@/lib/utils";

type RecentSalesProps = {
  transactions: Transaction[];
};

function stageVariant(stage: Transaction["stage"]) {
  if (stage === "Closing") return "success";
  if (stage === "Inspection" || stage === "Appraisal") return "warning";
  return "default";
}

function formatCloseDate(closeDate: string) {
  const date = new Date(closeDate);

  if (!closeDate || Number.isNaN(date.getTime())) {
    return "Closing date pending";
  }

  return `${format(date, "MMM d")} closes in ${formatDistanceToNowStrict(date)}`;
}

export function RecentSales({ transactions }: RecentSalesProps) {
  return (
    <div className="transaction-list">
      {transactions.map((transaction) => (
        <article className="transaction-row" key={transaction.id}>
          <div className="transaction-row__main">
            <div>
              <h3>{transaction.clientName}</h3>
              <p>
                <MapPin size={15} />
                {transaction.propertyAddress}
              </p>
            </div>
            <Badge variant={stageVariant(transaction.stage)}>
              {transaction.stage}
            </Badge>
          </div>
          <div className="transaction-row__meta">
            <span>{transaction.type}</span>
            <span>{formatCurrency(transaction.contractValue)}</span>
            <span>
              <CalendarClock size={15} />
              {formatCloseDate(transaction.closeDate)}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
