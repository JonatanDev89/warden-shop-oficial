import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Webhook, Send, Trash2, Plus, Pencil, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const VARIABLES = [
  { var: "{nick}", desc: "Nick do jogador" },
  { var: "{pedido}", desc: "Número do pedido" },
  { var: "{total}", desc: "Valor total" },
  { var: "{email}", desc: "Email do comprador" },
  { var: "{data}", desc: "Data e hora" },
  { var: "{status}", desc: "Status do pedido" },
];

const EVENTS = [
  { key: "msgPendente", label: "📋 Pendente", color: "#FFA500" },
  { key: "msgAceito", label: "✅ Aceito", color: "#00FF00" },
  { key: "msgRecusado", label: "❌ Recusado", color: "#FF0000" },
  { key: "msgEntregue", label: "🎁 Entregue", color: "#0099FF" },
  { key: "msgDeletado", label: "🗑️ Deletado", color: "#888888" },
];

type WebhookMessages = {
  msgPendente: string;
  msgAceito: string;
  msgRecusado: string;
  msgEntregue: string;
  msgDeletado: string;
};

const emptyMessages = (): WebhookMessages => ({
  msgPendente: "", msgAceito: "", msgRecusado: "", msgEntregue: "", msgDeletado: "",
});

function applyPreview(template: string): string {
  return template
    .replace(/\{nick\}/g, "Steve123")
    .replace(/\{pedido\}/g, "#98765")
    .replace(/\{total\}/g, "R$ 29,90")
    .replace(/\{email\}/g, "jogador@email.com")
    .replace(/\{data\}/g, new Date().toLocaleString("pt-BR"))
    .replace(/\{status\}/g, "pendente");
}

function DiscordPreview({ message, eventKey }: { message: string; eventKey: string }) {
  const event = EVENTS.find((e) => e.key === eventKey);
  const previewText = message ? applyPreview(message) : `Mensagem padrão do evento ${event?.label}`;

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-sans">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0 text-white font-bold text-sm">W</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-semibold text-sm">Warden Shop</span>
            <span className="text-[10px] bg-[#5865F2] text-white px-1 rounded font-medium">BOT</span>
            <span className="text-[#949BA4] text-xs">Hoje às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div
            className="rounded border-l-4 bg-[#2B2D31] p-3"
            style={{ borderColor: event?.color ?? "#5865F2" }}
          >
            <p className="text-white font-semibold text-sm mb-1">{event?.label ?? "Evento"}</p>
            <p className="text-[#DBDEE1] text-sm whitespace-pre-wrap">{previewText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebhookForm({ webhook, onClose }: { webhook?: any; onClose: () => void }) {
  const utils = trpc.useUtils();
  const isEdit = !!webhook;

  const [url, setUrl] = useState(webhook?.url ?? "");
  const [type, setType] = useState<"notification" | "receipt">(webhook?.type ?? "notification");
  const [active, setActive] = useState(webhook?.active ?? true);
  const [messages, setMessages] = useState<WebhookMessages>({
    msgPendente: webhook?.msgPendente ?? "",
    msgAceito: webhook?.msgAceito ?? "",
    msgRecusado: webhook?.msgRecusado ?? "",
    msgEntregue: webhook?.msgEntregue ?? "",
    msgDeletado: webhook?.msgDeletado ?? "",
  });
  const [activeEvent, setActiveEvent] = useState("msgPendente");
  const [showPreview, setShowPreview] = useState(false);

  const create = trpc.admin.createWebhook.useMutation({
    onSuccess: () => { utils.admin.getWebhooks.invalidate(); toast.success("Webhook criado!"); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.admin.updateWebhook.useMutation({
    onSuccess: () => { utils.admin.getWebhooks.invalidate(); toast.success("Webhook atualizado!"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const isPending = create.isPending || update.isPending;

  const handleSave = () => {
    if (!url) return toast.error("URL obrigatória");
    if (isEdit) update.mutate({ id: webhook.id, url, active, ...messages });
    else create.mutate({ type, url, ...messages });
  };

  return (
    <div className="space-y-4">
      {!isEdit && (
        <div>
          <Label className="mb-1.5 block">Tipo</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={type === "notification" ? "default" : "outline"} onClick={() => setType("notification")} className="gap-2">
              <Webhook className="h-4 w-4" /> Notificação
            </Button>
            <Button size="sm" variant={type === "receipt" ? "default" : "outline"} onClick={() => setType("receipt")} className="gap-2">
              <Send className="h-4 w-4" /> Comprovante
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {type === "notification" ? "Notifica a equipe admin sobre eventos dos pedidos" : "Envia comprovante ao cliente quando o pedido é entregue"}
          </p>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">URL do Webhook Discord</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="bg-muted border-border font-mono text-sm" />
      </div>

      {isEdit && (
        <div className="flex items-center gap-3">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Webhook ativo</Label>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Mensagens por evento</Label>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-3 w-3" /> {showPreview ? "Ocultar" : "Preview"}
          </Button>
        </div>

        <Tabs value={activeEvent} onValueChange={setActiveEvent}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1 mb-3">
            {EVENTS.map((e) => (
              <TabsTrigger key={e.key} value={e.key} className="text-xs">{e.label}</TabsTrigger>
            ))}
          </TabsList>

          {EVENTS.map((e) => (
            <TabsContent key={e.key} value={e.key} className="space-y-3 mt-0">
              <Textarea
                value={messages[e.key as keyof WebhookMessages]}
                onChange={(ev) => setMessages((prev) => ({ ...prev, [e.key]: ev.target.value }))}
                placeholder={`Deixe vazio para usar a mensagem padrão.\nEx: Olá {nick}! Seu pedido {pedido} foi processado. Total: {total}`}
                className="bg-muted border-border text-sm min-h-[80px]"
              />
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button key={v.var} type="button" title={v.desc}
                    onClick={() => setMessages((prev) => ({ ...prev, [e.key]: prev[e.key as keyof WebhookMessages] + v.var }))}
                  >
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary/20 hover:border-primary font-mono text-xs">{v.var}</Badge>
                  </button>
                ))}
              </div>
              {showPreview && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <DiscordPreview message={messages[e.key as keyof WebhookMessages]} eventKey={e.key} />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={isPending} className="gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Criar webhook"}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function AdminWebhooks() {
  const utils = trpc.useUtils();
  const { data: webhooks, isLoading } = trpc.admin.getWebhooks.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editWebhook, setEditWebhook] = useState<any>(null);

  const deleteWebhook = trpc.admin.deleteWebhook.useMutation({
    onSuccess: () => { utils.admin.getWebhooks.invalidate(); toast.success("Webhook removido!"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <AdminLayout title="Webhooks Discord">
      <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Webhooks Discord">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Webhooks Discord</h2>
            <p className="text-muted-foreground text-sm mt-1">Envie notificações automáticas para o Discord quando pedidos forem criados ou atualizados.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Criar Webhook
          </Button>
        </div>

        {/* Lista de webhooks */}
        {webhooks && webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((w) => (
              <Card key={w.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${w.type === "notification" ? "bg-purple-500/10" : "bg-blue-500/10"}`}>
                      {w.type === "notification" ? <Webhook className="h-5 w-5 text-purple-400" /> : <Send className="h-5 w-5 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {w.type === "notification" ? "Notificação" : "Comprovante"}
                        </span>
                        <Badge variant={w.active ? "default" : "secondary"} className="text-xs">
                          {w.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{w.url}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditWebhook(w)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteWebhook.mutate({ id: w.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="p-8 text-center">
              <Webhook className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum webhook configurado ainda.</p>
              <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Criar primeiro webhook
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dialog criar */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Webhook</DialogTitle>
            </DialogHeader>
            <WebhookForm onClose={() => setShowCreate(false)} />
          </DialogContent>
        </Dialog>

        {/* Dialog editar */}
        <Dialog open={!!editWebhook} onOpenChange={(o) => !o && setEditWebhook(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Webhook</DialogTitle>
            </DialogHeader>
            {editWebhook && <WebhookForm webhook={editWebhook} onClose={() => setEditWebhook(null)} />}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
