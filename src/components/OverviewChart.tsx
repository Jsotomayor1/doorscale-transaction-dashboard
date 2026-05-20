import { type TransactionStage } from "@/hooks/use-crm-data";

const stageOrder: TransactionStage[] = [
  "Lead",
  "Under Contract",
  "Inspection",
  "Appraisal",
  "Closing",
  "Closed",
];

type OverviewChartProps = {
  stageCounts: Record<TransactionStage, number>;
};

export function OverviewChart({ stageCounts }: OverviewChartProps) {
  const max = Math.max(...Object.values(stageCounts), 1);

  return (
    <div className="stage-chart">
      {stageOrder.map((stage) => {
        const count = stageCounts[stage];
        const height = `${Math.max((count / max) * 100, count ? 18 : 8)}%`;

        return (
          <div className="stage-chart__item" key={stage}>
            <div className="stage-chart__bar-track" aria-hidden="true">
              <div className="stage-chart__bar" style={{ height }} />
            </div>
            <strong>{count}</strong>
            <span>{stage}</span>
          </div>
        );
      })}
    </div>
  );
}
