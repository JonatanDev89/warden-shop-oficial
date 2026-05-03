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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Webhook, Send, Trash2, Plus, Pencil, Eye, HelpCircle, CheckCircle2, Copy, ChevronDown, Sparkles, TestTube } from "lucide-react";
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

const MESSAGE_TEMPLATES = {
  msgPendente: "🔔 Novo pedido {pedido} de {nick}\nValor: {total}\nAguardando aprovação!",
  msgAceito: "✅ Pedido {pedido} aprovado!\nJogador: {nick}\nValor: {total}\nPronto para entrega no jogo.",
  msgRecusado: "❌ Pedido {pedido} foi recusado\nJogador: {nick}\nMotivo: Verificar com o administrador",
  msgEntregue: "🎁 Pedido {pedido} entregue com sucesso!\nJogador: {nick}\nValor: {total}\nItens já estão disponíveis no jogo!",
  msgDeletado: "🗑️ Pedido {pedido} foi removido\nJogador: {nick}\nData: {data}",
};

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

function SetupGuide() {
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Collapsible open={showGuide} onOpenChange={setShowGuide}>
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-400" />
              <span className="font-semibold text-foreground">Como configurar webhooks do Discord?</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showGuide ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-xs">1</div>
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">Abra as configurações do seu servidor Discord</p>
                  <p className="text-muted-foreground text-xs">Clique com o botão direito no nome do servidor → Configurações do Servidor</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-xs">2</div>
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">Vá para Integrações → Webhooks</p>
                  <p className="text-muted-foreground text-xs">Clique em "Novo Webhook" ou "Criar Webhook"</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-xs">3</div>
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">Configure o webhook</p>
                  <p className="text-muted-foreground text-xs mb-2">Escolha um nome (ex: "Warden Shop") e o canal onde as mensagens serão enviadas</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-xs">4</div>
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">Copie a URL do Webhook</p>
                  <p className="text-muted-foreground text-xs">Clique em "Copiar URL do Webhook" e cole aqui embaixo</p>
                </div>
              </div>
            </div>

            <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <AlertDescription className="text-xs text-yellow-300">
                <strong>⚠️ Importante:</strong> Nunca compartilhe a URL do webhook publicamente! Qualquer pessoa com acesso pode enviar mensagens para o seu servidor Discord.
              </AlertDescription>
            </Alert>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
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
  const [testing, setTesting] = useState(false);

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
    if (!url.startsWith("https://discord.com/api/webhooks/") && !url.startsWith("https://discordapp.com/api/webhooks/")) {
      return toast.error("URL inválida. Use uma URL de webhook do Discord.");
    }
    if (isEdit) update.mutate({ id: webhook.id, url, active, ...messages });
    else create.mutate({ type, url, ...messages });
  };

  const handleTest = async () => {
    if (!url) return toast.error("Informe a URL do webhook primeiro");
    if (!url.startsWith("https://discord.com/api/webhooks/") && !url.startsWith("https://discordapp.com/api/webhooks/")) {
      return toast.error("URL inválida. Use uma URL de webhook do Discord.");
    }

    setTesting(true);
    try {
      const testMessage = {
        embeds: [{
          title: "🧪 Teste de Webhook",
          description: "Este é um teste de conexão do Warden Shop!\n\nSe você está vendo esta mensagem, o webhook está funcionando corretamente. ✅",
          color: 0x5865F2,
          fields: [
            { name: "Status", value: "Conectado", inline: true },
            { name: "Data", value: new Date().toLocaleString("pt-BR"), inline: true },
          ],
          timestamp: new Date().toISOString(),
        }]
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testMessage),
      });

      if (response.ok) {
        toast.success("Teste enviado! Verifique o canal do Discord.");
      } else {
        const error = await response.text();
        toast.error(`Erro ao enviar teste: ${response.status}`);
        console.error("Webhook test error:", error);
      }
    } catch (error) {
      toast.error("Erro ao conectar com o Discord. Verifique a URL.");
      console.error("Webhook test error:", error);
    } finally {
      setTesting(false);
    }
  };

  const applyTemplate = (eventKey: string) => {
    const template = MESSAGE_TEMPLATES[eventKey as keyof typeof MESSAGE_TEMPLATES];
    if (template) {
      setMessages((prev) => ({ ...prev, [eventKey]: template }));
      toast.success("Template aplicado!");
    }
  };

  return (
    <div className="space-y-4">
      {!isEdit && <SetupGuide />}

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
        <div className="flex gap-2">
          <Input 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            placeholder="https://discord.com/api/webhooks/..." 
            className="bg-muted border-border font-mono text-sm flex-1" 
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleTest} 
            disabled={testing || !url}
            className="gap-2 shrink-0"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            Testar
          </Button>
        </div>
        {url && !url.startsWith("https://discord.com/api/webhooks/") && !url.startsWith("https://discordapp.com/api/webhooks/") && (
          <p className="text-destructive text-xs mt-1">⚠️ URL inválida. Deve começar com https://discord.com/api/webhooks/</p>
        )}
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
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Personalize a mensagem ou deixe vazio para usar o padrão</p>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="gap-1 text-xs h-7"
                  onClick={() => applyTemplate(e.key)}
                >
                  <Sparkles className="h-3 w-3" /> Usar template
                </Button>
              </div>
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

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Webhook className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm mb-1">Webhook de Notificação</p>
                  <p className="text-xs text-muted-foreground">Notifica a equipe admin sobre todos os eventos dos pedidos (pendente, aceito, recusado, entregue, deletado)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Send className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm mb-1">Webhook de Comprovante</p>
                  <p className="text-xs text-muted-foreground">Envia comprovante de entrega para um canal público quando o pedido é entregue no jogo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de webhooks */}
        {webhooks && webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((w) => (
              <Card key={w.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${w.type === "notification" ? "bg-purple-500/10" : "bg-blue-500/10"}`}>
                      {w.type === "notification" ? <Webhook className="h-5 w-5 text-purple-400" /> : <Send className="h-5 w-5 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground text-sm">
                          {w.type === "notification" ? "Webhook de Notificação" : "Webhook de Comprovante"}
                        </span>
                        <Badge variant={w.active ? "default" : "secondary"} className="text-xs">
                          {w.active ? "✓ Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate mb-2">{w.url}</p>
                      <div className="flex flex-wrap gap-1">
                        {w.type === "notification" && (
                          <>
                            {w.msgPendente && <Badge variant="outline" className="text-[10px] px-1.5 py-0">📋 Pendente</Badge>}
                            {w.msgAceito && <Badge variant="outline" className="text-[10px] px-1.5 py-0">✅ Aceito</Badge>}
                            {w.msgRecusado && <Badge variant="outline" className="text-[10px] px-1.5 py-0">❌ Recusado</Badge>}
                            {w.msgEntregue && <Badge variant="outline" className="text-[10px] px-1.5 py-0">🎁 Entregue</Badge>}
                            {w.msgDeletado && <Badge variant="outline" className="text-[10px] px-1.5 py-0">🗑️ Deletado</Badge>}
                            {!w.msgPendente && !w.msgAceito && !w.msgRecusado && !w.msgEntregue && !w.msgDeletado && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Usando mensagens padrão</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditWebhook(w)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => {
                          if (confirm("Tem certeza que deseja remover este webhook?")) {
                            deleteWebhook.mutate({ id: w.id });
                          }
                        }}
                        title="Remover"
                      >
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
              <p className="text-foreground font-semibold mb-1">Nenhum webhook configurado</p>
              <p className="text-muted-foreground text-sm mb-4">Configure webhooks para receber notificações automáticas no Discord</p>
              <Button className="mt-2 gap-2" onClick={() => setShowCreate(true)}>
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
