import { trpc } from "@/lib/trpc";
import { Target, TrendingUp } from "lucide-react";

export default function MonthlyGoal() {
  const { data } = trpc.shop.getMonthlyGoal.useQuery();

  // Don't render if no target is set
  if (!data || data.target <= 0) return null;

  const pct = Math.min(100, Math.round((data.current / data.target) * 100));

  const fmt = (v: number) =>
    `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div className="w-full bg-card border-t border-border px-4 py-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-0.5">
          <Target className="h-4 w-4 text-primary" />
          <span
            className="font-semibold text-foreground text-sm"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {data.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Sua ajuda nos mantém no ar! {fmt(data.current)} de {fmt(data.target)}
        </p>

        {/* Progress bar */}
        <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Footer */}
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
