import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, UserMinus, Users, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminAdmins() {
  const utils = trpc.useUtils();
  const { user: currentUser } = useAuth();
  const { data: admins, isLoading } = trpc.admin.getAdmins.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const addAdmin = trpc.admin.addAdmin.useMutation({
    onSuccess: () => {
      utils.admin.getAdmins.invalidate();
      setDialogOpen(false);
      setEmailInput("");
      toast.success("Administrador adicionado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeAdmin = trpc.admin.removeAdmin.useMutation({
    onSuccess: () => {
      utils.admin.getAdmins.invalidate();
      toast.success("Administrador removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    addAdmin.mutate({ email: emailInput.trim() });
  };

  return (
    <AdminLayout title="Gerenciar Admins">
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Gerenciar Administradores
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Adicione ou remova usuários com acesso ao painel administrativo.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : admins?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum administrador encontrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {admins?.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border"
              >
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                  {admin.name?.charAt(0).toUpperCase() ?? "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{admin.name ?? "Sem nome"}</p>
                    <Badge
                      variant="outline"
                      className="text-xs text-primary border-primary/30 bg-primary/10"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                    {admin.openId === currentUser?.openId && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Você
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{admin.email ?? "Sem e-mail"}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{admin.openId}</p>
                </div>
                {admin.id !== currentUser?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive gap-1"
                    onClick={() => {
                      if (confirm(`Remover ${admin.name ?? "este usuário"} como admin?`)) {
                        removeAdmin.mutate({ userId: admin.id });
                      }
                    }}
                    disabled={removeAdmin.isPending}
                  >
                    <UserMinus className="h-3 w-3" />
                    Remover
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar Administrador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">E-mail do Usuário *</Label>
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="bg-muted border-border text-sm"
                placeholder="email@exemplo.com"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                O usuário precisa ter feito login na loja pelo menos uma vez para ser promovido.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={addAdmin.isPending}
                className="flex-1"
              >
                {addAdmin.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Adicionar Admin
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
