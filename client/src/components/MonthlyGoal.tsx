import { Target, TrendingUp, Link2 } from "lucide-react";

interface MonthlyGoalProps {
  /** Valor atual arrecadado no mês (R$) */
  current: number;
  /** Meta mensal (R$) */
  goal: number;
  /** Texto de apoio exibido abaixo do título */
  subtitle?: string;
}

export default function MonthlyGoal({
  current,
  goal,
  subtitle = "Sua ajuda nos mantém no ar!",
}: MonthlyGoalProps) {
  const pct = Math.min(100, Math.round((current / goal) * 100));

  return (
    <div className="w-full bg-card border border-border px-5 py-4">
      <div className="container">
        {/* Header */}
        <div className="flex items-center gap-2 mb-0.5">
          <Target className="h-4 w-4 text-orange-400" />
          <span
            className="font-semibold text-foreground text-sm"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Meta do mês
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>

        {/* Progress bar */}
        <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #f97316 0%, #fb923c 100%)",
              boxShadow: "0 0 8px rgba(249,115,22,0.6)",
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-1.5">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1 text-xs text-orange-400 font-medium">
            <TrendingUp className="h-3 w-3" />
            {pct}% completo
          </span>
        </div>
      </div>
    </div>
  );
}
