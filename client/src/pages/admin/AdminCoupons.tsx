import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, Plus, Pencil, Trash2, Ticket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CouponForm = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  active: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  discountType: "percent",
  discountValue: "",
  active: true,
};

export default function AdminCoupons() {
  const utils = trpc.useUtils();
  const { data: coupons, isLoading } = trpc.admin.getCoupons.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const createCoupon = trpc.admin.createCoupon.useMutation({
    onSuccess: () => {
      utils.admin.getCoupons.invalidate();
      setDialogOpen(false);
      toast.success("Cupom criado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCoupon = trpc.admin.updateCoupon.useMutation({
    onSuccess: () => {
      utils.admin.getCoupons.invalidate();
      setDialogOpen(false);
      toast.success("Cupom atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCoupon = trpc.admin.deleteCoupon.useMutation({
    onSuccess: () => {
      utils.admin.getCoupons.invalidate();
      toast.success("Cupom removido.");
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: NonNullable<typeof coupons>[0]) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discountType: c.discountType as "percent" | "fixed",
      discountValue: String(c.discountValue),
        active: c.active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code.toUpperCase(),
      discountType: form.discountType,
      discountValue: form.discountValue,
      active: form.active,
    };
    if (editingId) {
      updateCoupon.mutate({ id: editingId, ...payload });
    } else {
      createCoupon.mutate(payload);
    }
  };

  return (
    <AdminLayout title="Cupons">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Cupons de Desconto
          </h2>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {coupons?.map((coupon) => (
              <div
                key={coupon.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Ticket className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-foreground">{coupon.code}</span>
                    <Badge
                      variant="outline"
                      className={coupon.active
                        ? "text-xs text-green-400 border-green-500/30 bg-green-500/10"
                        : "text-xs text-muted-foreground"}
                    >
                      {coupon.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {coupon.discountType === "percent"
                      ? `${coupon.discountValue}% de desconto`
                      : `R$ ${parseFloat(String(coupon.discountValue)).toFixed(2)} de desconto`}
                    {" · "}
                    {coupon.usageCount} uso{coupon.usageCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(coupon)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Remover cupom?")) deleteCoupon.mutate({ id: coupon.id });
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Cupom" : "Novo Cupom"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Código *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="bg-muted border-border font-mono"
                placeholder="DESCONTO10"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground mb-1.5 block">Tipo</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) => setForm({ ...form, discountType: v as "percent" | "fixed" })}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="percent">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">
                  Valor {form.discountType === "percent" ? "(%)" : "(R$)"} *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  className="bg-muted border-border"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label className="text-foreground">Cupom ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={createCoupon.isPending || updateCoupon.isPending}
                className="flex-1"
              >
                {editingId ? "Salvar" : "Criar Cupom"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
