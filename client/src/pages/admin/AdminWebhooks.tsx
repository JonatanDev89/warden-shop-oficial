import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Webhook, Send, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AdminWebhooks() {
  const utils = trpc.useUtils();
  const { data: webhooks, isLoading } = trpc.admin.getWebhooks.useQuery();

  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptActive, setReceiptActive] = useState(true);
  const [notifUrl, setNotifUrl] = useState("");
  const [notifActive, setNotifActive] = useState(true);

  useEffect(() => {
    if (webhooks) {
      const receipt = webhooks.find((w) => w.type === "receipt");
      const notif = webhooks.find((w) => w.type === "notification");
      if (receipt) {
        setReceiptUrl(receipt.url);
        setReceiptActive(receipt.active);
      }
      if (notif) {
        setNotifUrl(notif.url);
        setNotifActive(notif.active);
      }
    }
  }, [webhooks]);

  const createWebhook = trpc.admin.createWebhook.useMutation({
    onSuccess: () => {
      utils.admin.getWebhooks.invalidate();
      toast.success("Webhook salvo!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateWebhook = trpc.admin.updateWebhook.useMutation({
    onSuccess: () => {
      utils.admin.getWebhooks.invalidate();
      toast.success("Webhook atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveReceipt = () => {
    const existing = webhooks?.find((w) => w.type === "receipt");
    if (existing) {
      updateWebhook.mutate({ id: existing.id, url: receiptUrl, active: receiptActive });
    } else {
      createWebhook.mutate({ type: "receipt", url: receiptUrl });
    }
  };

  const handleSaveNotif = () => {
    const existing = webhooks?.find((w) => w.type === "notification");
    if (existing) {
      updateWebhook.mutate({ id: existing.id, url: notifUrl, active: notifActive });
    } else {
      createWebhook.mutate({ type: "notification", url: notifUrl });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Webhooks Discord">
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const receiptWebhook = webhooks?.find((w) => w.type === "receipt");
  const notifWebhook = webhooks?.find((w) => w.type === "notification");

  return (
    <AdminLayout title="Webhooks Discord">
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Webhooks Discord
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure os webhooks para receber notificações no Discord quando novos pedidos forem criados.
          </p>
        </div>

        {/* Receipt webhook */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-foreground text-base">Webhook de Comprovante</CardTitle>
                <CardDescription>
                  Enviado ao cliente via Discord quando o pedido é confirmado
                </CardDescription>
              </div>
              {receiptWebhook && (
                <div className="ml-auto">
                  {receiptWebhook.active ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">URL do Webhook</Label>
              <Input
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="bg-muted border-border font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={receiptActive}
                onCheckedChange={setReceiptActive}
              />
              <Label className="text-foreground">Webhook ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSaveReceipt}
                disabled={createWebhook.isPending || updateWebhook.isPending}
                className="gap-2"
              >
                {(createWebhook.isPending || updateWebhook.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification webhook */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Webhook className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-foreground text-base">Webhook de Notificação</CardTitle>
                <CardDescription>
                  Notifica a equipe admin sobre novos pedidos recebidos
                </CardDescription>
              </div>
              {notifWebhook && (
                <div className="ml-auto">
                  {notifWebhook.active ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">URL do Webhook</Label>
              <Input
                value={notifUrl}
                onChange={(e) => setNotifUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="bg-muted border-border font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={notifActive}
                onCheckedChange={setNotifActive}
              />
              <Label className="text-foreground">Webhook ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSaveNotif}
                disabled={createWebhook.isPending || updateWebhook.isPending}
                className="gap-2"
              >
                {(createWebhook.isPending || updateWebhook.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
