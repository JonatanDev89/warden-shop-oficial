import { trpc } from "@/lib/trpc";
import { Target, TrendingUp } from "lucide-react";

export default function MonthlyGoal() {
  const { data } = trpc.shop.getMonthlyGoal.useQuery();

  if (!data || data.target <= 0) return null;

  const pct = Math.min(100, Math.round((data.current / data.target) * 100));

  return (
    <div className="w-full bg-card border-t border-border">
      <div className="container mx-auto max-w-4xl py-5 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-primary shrink-0" />
          <span
            className="font-semibold text-foreground text-sm"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {data.label}
          </span>
          <span className="text-xs text-muted-foreground ml-1">
            — Sua ajuda nos mantém no ar!
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-end mt-1.5">
          <span className="flex items-center gap-1 text-xs text-primary font-medium">
            <TrendingUp className="h-3 w-3" />
            {pct}% completo
          </span>
        </div>
      </div>
    </div>
  );
}
