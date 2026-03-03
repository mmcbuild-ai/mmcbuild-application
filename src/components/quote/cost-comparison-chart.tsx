"use client";

import { getCostCategoryLabel } from "@/lib/ai/types";

interface CostComparisonChartProps {
  lineItems: {
    cost_category: string;
    traditional_total: number | null;
    mmc_total: number | null;
  }[];
}

export function CostComparisonChart({ lineItems }: CostComparisonChartProps) {
  // Aggregate by category
  const categoryMap = new Map<
    string,
    { traditional: number; mmc: number }
  >();

  for (const li of lineItems) {
    const existing = categoryMap.get(li.cost_category) ?? {
      traditional: 0,
      mmc: 0,
    };
    existing.traditional += li.traditional_total ?? 0;
    existing.mmc += li.mmc_total ?? li.traditional_total ?? 0;
    categoryMap.set(li.cost_category, existing);
  }

  const categories = [...categoryMap.entries()]
    .sort((a, b) => b[1].traditional - a[1].traditional);

  const maxValue = Math.max(
    ...categories.map(([, v]) => Math.max(v.traditional, v.mmc))
  );

  if (categories.length === 0 || maxValue === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Cost Comparison by Category</h3>
      <div className="space-y-2">
        {categories.map(([cat, values]) => {
          const tradPct = (values.traditional / maxValue) * 100;
          const mmcPct = (values.mmc / maxValue) * 100;
          const savings = values.traditional > 0
            ? Math.round(((values.traditional - values.mmc) / values.traditional) * 100)
            : 0;

          return (
            <div key={cat} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium truncate mr-2">
                  {getCostCategoryLabel(cat)}
                </span>
                {savings > 0 && (
                  <span className="text-green-600 shrink-0">-{savings}%</span>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="h-3 rounded-sm bg-gray-300" style={{ width: `${tradPct}%` }} />
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ${Math.round(values.traditional).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 rounded-sm bg-violet-500" style={{ width: `${mmcPct}%` }} />
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ${Math.round(values.mmc).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-2 w-4 rounded-sm bg-gray-300" />
          Traditional
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-4 rounded-sm bg-violet-500" />
          MMC
        </div>
      </div>
    </div>
  );
}
