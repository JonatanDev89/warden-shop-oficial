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
import { Loader2, Plus, Trash2, Key, Copy, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminApiKeys() {
  const utils = trpc.useUtils();
  const { data: apiKeys, isLoading } = trpc.admin.getApiKeys.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const createApiKey = trpc.admin.createApiKey.useMutation({
    onSuccess: (res) => {
      utils.admin.getApiKeys.invalidate();
      setCreatedKey(res.key);
      setNewKeyName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeApiKey = trpc.admin.revokeApiKey.useMutation({
    onSuccess: () => {
      utils.admin.getApiKeys.invalidate();
      toast.success("API Key revogada.");
    },
  });

  const deleteApiKey = trpc.admin.deleteApiKey.useMutation({
    onSuccess: () => {
      utils.admin.getApiKeys.invalidate();
      toast.success("API Key removida.");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createApiKey.mutate({ name: newKeyName.trim() });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <AdminLayout title="API Keys">
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              API Keys
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie as chaves de API para integração com sistemas externos.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Key
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : apiKeys?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Key className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma API Key criada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys?.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Key className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{key.name}</p>
                    <Badge
                      variant="outline"
                      className={key.active
                        ? "text-xs text-green-400 border-green-500/30 bg-green-500/10"
                        : "text-xs text-muted-foreground"}
                    >
                      {key.active ? "Ativa" : "Revogada"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {key.keyPrefix}••••••••••••••••
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Criada em {new Date(key.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {key.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Revogar esta API Key?")) revokeApiKey.mutate({ id: key.id });
                      }}
                    >
                      Revogar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Remover esta API Key?")) deleteApiKey.mutate({ id: key.id });
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

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setCreatedKey(null);
      }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova API Key</DialogTitle>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-300">
                  Copie a chave agora! Ela não será exibida novamente por segurança.
                </p>
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Sua API Key</Label>
                <div className="flex gap-2">
                  <Input
                    value={showKey ? createdKey : "•".repeat(createdKey.length)}
                    readOnly
                    className="bg-muted border-border font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setDialogOpen(false);
                  setCreatedKey(null);
                  setShowKey(false);
                }}
              >
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label className="text-foreground mb-1.5 block">Nome da Key *</Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="bg-muted border-border"
                  placeholder="Ex: Integração Discord Bot"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createApiKey.isPending}
                  className="flex-1"
                >
                  {createApiKey.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar API Key
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
