import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from "recharts";
import { ShoppingCart, DollarSign, Package, Tag, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendentes",
  confirmed: "Confirmados",
  delivered: "Entregues",
  cancelled: "Cancelados",
};

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.getDashboard.useQuery();

  if (isLoading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const statusChartData = stats
    ? Object.entries(stats.statusCounts).map(([status, count]) => ({
        name: STATUS_LABELS[status] ?? status,
        count,
        fill: STATUS_COLORS[status] ?? "#888",
      }))
    : [];

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Dashboard
          </h2>
          <p className="text-muted-foreground text-sm">Visão geral da loja</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total de Pedidos",
              value: stats?.totalOrders ?? 0,
              sub: `${stats?.deliveredCount ?? 0} entregues`,
              icon: ShoppingCart,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Receita Total",
              value: `R$ ${(stats?.totalRevenue ?? 0).toFixed(2)}`,
              sub: "De todos os pedidos",
              icon: DollarSign,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              label: "Produtos",
              value: stats?.productCount ?? 0,
              sub: "Cadastrados",
              icon: Package,
              color: "text-purple-400",
              bg: "bg-purple-500/10",
            },
            {
              label: "Categorias",
              value: stats?.categoryCount ?? 0,
              sub: "Ativas",
              icon: Tag,
              color: "text-orange-400",
              bg: "bg-orange-500/10",
            },
          ].map(({ label, value, sub, icon: Icon, color, bg }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{label}</p>
                    <p
                      className="text-2xl font-bold text-foreground"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base">Pedidos por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.025 240)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "oklch(0.60 0.02 240)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.60 0.02 240)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.16 0.02 240)",
                      border: "1px solid oklch(0.28 0.025 240)",
                      borderRadius: "8px",
                      color: "oklch(0.95 0.01 240)",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((entry, index) => (
                      <rect key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trend chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base">Tendência de Vendas (7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats?.trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.025 240)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "oklch(0.60 0.02 240)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.60 0.02 240)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.16 0.02 240)",
                      border: "1px solid oklch(0.28 0.025 240)",
                      borderRadius: "8px",
                      color: "oklch(0.95 0.01 240)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: "oklch(0.60 0.02 240)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="confirmed"
                    name="Confirmados"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pending"
                    name="Pendentes"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="cancelled"
                    name="Cancelados"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
