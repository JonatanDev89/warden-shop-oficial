import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import React from "react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pendente de Aprovação",
  game_pending: "Pendente no Jogo",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  game_pending: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  delivered: "bg-green-500/10 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function AdminOrders() {
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.admin.getOrders.useQuery();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { data: orderDetail } = trpc.admin.getOrder.useQuery(
    { id: selectedOrderId! },
    { enabled: selectedOrderId !== null }
  );

  const updateStatus = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => {
      utils.admin.getOrders.invalidate();
      utils.admin.getOrder.invalidate({ id: selectedOrderId! });
      toast.success("Status atualizado!");
    },
  });

  const updateNotes = trpc.admin.updateOrderNotes.useMutation({
    onSuccess: () => {
      utils.admin.getOrder.invalidate({ id: selectedOrderId! });
      toast.success("Notas salvas!");
    },
  });

  const deleteOrder = trpc.admin.deleteOrder.useMutation({
    onSuccess: () => {
      utils.admin.getOrders.invalidate();
      utils.admin.getDashboard.invalidate();
      setSelectedOrderId(null);
      toast.success("Pedido removido.");
    },
  });

  const acceptOrder = trpc.admin.acceptOrder.useMutation({
    onSuccess: () => {
      utils.admin.getOrders.invalidate();
      utils.admin.getOrder.invalidate({ id: selectedOrderId! });
      utils.admin.getDashboard.invalidate();
      toast.success("Pedido aceito! Agora esta pendente no jogo.");
    },
  });

  const rejectOrder = trpc.admin.rejectOrder.useMutation({
    onSuccess: () => {
      utils.admin.getOrders.invalidate();
      utils.admin.getOrder.invalidate({ id: selectedOrderId! });
      utils.admin.getDashboard.invalidate();
      toast.success("Pedido recusado.");
    },
  });

  const [notes, setNotes] = useState("");

  // Sincronizar notes com orderDetail quando ele muda
  React.useEffect(() => {
    if (orderDetail) {
      setNotes(orderDetail.notes || "");
    }
  }, [orderDetail]);

  const formatPrice = (v: string | number) =>
    `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;

  return (
    <AdminLayout title="Pedidos">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Pedidos
          </h2>
          <span className="text-sm text-muted-foreground">{orders?.length ?? 0} pedidos</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {orders?.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-border/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-foreground text-sm">
                      Pedido {order.orderNumber}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[order.status] ?? ""}`}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.minecraftNickname} — {formatPrice(order.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setNotes(order.notes ?? "");
                    }}
                  >
                    <Eye className="h-3 w-3" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Remover este pedido?")) deleteOrder.mutate({ id: order.id });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order detail dialog */}
      <Dialog open={selectedOrderId !== null} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Pedido {orderDetail?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          {orderDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Jogador</p>
                  <p className="text-foreground font-medium">{orderDetail.minecraftNickname}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">E-mail</p>
                  <p className="text-foreground font-medium">{orderDetail.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Total</p>
                  <p className="text-foreground font-bold">{formatPrice(orderDetail.total)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Cupom</p>
                  <p className="text-foreground">{orderDetail.couponCode ?? "—"}</p>
                </div>
              </div>

              {/* Items */}
              {orderDetail.items && orderDetail.items.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Itens do pedido</p>
                  <div className="space-y-1">
                    {orderDetail.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-foreground">
                          {item.quantity}x {item.productName}
                        </span>
                        <span className="text-muted-foreground">{formatPrice(item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <Select
                  value={orderDetail.status}
                  onValueChange={(val) =>
                    updateStatus.mutate({
                      id: orderDetail.id,
                      status: val as "pending_approval" | "game_pending" | "delivered" | "cancelled",
                    })
                  }
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="pending_approval">Pendente de Aprovação</SelectItem>
                    <SelectItem value="game_pending">Pendente no Jogo</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Approve/Reject Buttons for pending_approval orders */}
              {orderDetail.status === "pending_approval" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => acceptOrder.mutate({ id: orderDetail.id })}
                    disabled={acceptOrder.isPending}
                  >
                    {acceptOrder.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Aceitando...
                      </>
                    ) : (
                      "Aceitar Pedido"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={() => rejectOrder.mutate({ id: orderDetail.id })}
                    disabled={rejectOrder.isPending}
                  >
                    {rejectOrder.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Recusando...
                      </>
                    ) : (
                      "Recusar Pedido"
                    )}
                  </Button>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Notas internas</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações sobre o pedido..."
                  className="bg-muted border-border resize-none"
                  rows={3}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => updateNotes.mutate({ id: orderDetail.id, notes })}
                  disabled={updateNotes.isPending}
                >
                  Salvar Notas
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
