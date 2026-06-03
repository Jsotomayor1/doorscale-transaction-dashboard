import { type TransactionStage } from "@/hooks/use-crm-data";
import { Link } from "react-router-dom";
import { withActiveLocationPath } from "@/lib/active-location";

const stageOrder: TransactionStage[] = [
  "Pre-listing",
  "Active",
  "Under Contract",
  "Inspections",
  "Appraisal",
  "Clear to Close",
  "Closed",
  "Dead",
];

type OverviewChartProps = {
  stageCounts: Record<TransactionStage, number>;
};

export function OverviewChart({ stageCounts }: OverviewChartProps) {
  return (
    <div className="stage-card-grid">
      {stageOrder.map((stage) => {
        const count = stageCounts[stage];

        return (
          <Link
            className="stage-card"
            key={stage}
            to={withActiveLocationPath(`/transactions?stage=${encodeURIComponent(stage)}`)}
          >
            <strong>{count}</strong>
            <span>{stage}</span>
          </Link>
        );
      })}
    </div>
  );
}
