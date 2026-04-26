import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Palette, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AdminCustomization() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.admin.getSettings.useQuery();

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroBgUrl, setHeroBgUrl] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementCoupon, setAnnouncementCoupon] = useState("");
  const [glowIntensity, setGlowIntensity] = useState("0.4");
  const [glowColor, setGlowColor] = useState("#00c8c8");
  const [wardenGifUrl, setWardenGifUrl] = useState("");
  const [discordTicketsUrl, setDiscordTicketsUrl] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<"cpf" | "email" | "phone" | "random">("cpf");
  const [monthlyGoalTarget, setMonthlyGoalTarget] = useState("");
  const [monthlyGoalLabel, setMonthlyGoalLabel] = useState("");

  useEffect(() => {
    if (settings) {
      setStoreName(settings.storeName ?? "");
      setStoreDescription(settings.storeDescription ?? "");
      setLogoUrl(settings.logoUrl ?? "");
      setHeroTitle(settings.heroTitle ?? "");
      setHeroSubtitle(settings.heroSubtitle ?? "");
      setHeroBgUrl(settings.heroBgUrl ?? "");
      setAnnouncementText(settings.announcementText ?? "");
      setAnnouncementCoupon(settings.announcementCoupon ?? "");
      setGlowIntensity(settings.glowIntensity ?? "0.4");
      setGlowColor(settings.glowColor ?? "#00c8c8");
      setWardenGifUrl(settings.wardenGifUrl ?? "");
      setDiscordTicketsUrl(settings.discordTicketsUrl ?? "");
      setMonthlyGoalTarget(settings.monthlyGoalTarget ?? "");
      setMonthlyGoalLabel(settings.monthlyGoalLabel ?? "Meta do mês");
      // Carregar dados de personalização da loja (PIX, etc)
    }
  }, [settings]);

  const { data: customization, isLoading: isLoadingCustomization } = trpc.admin.getStoreCustomization.useQuery();

  useEffect(() => {
    if (customization) {
      setPixKey(customization.pixKey ?? "");
      setPixKeyType(customization.pixKeyType ?? "cpf");
    }
  }, [customization]);

  const saveSettings = trpc.admin.saveSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSettings.invalidate();
      utils.shop.getSettings.invalidate();
      toast.success("Configurações salvas!");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveCustomization = trpc.admin.updateStoreCustomization.useMutation({
    onSuccess: () => {
      utils.admin.getStoreCustomization.invalidate();
      toast.success("Personalização da loja salva!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    saveSettings.mutate({
      storeName,
      storeDescription,
      logoUrl,
      heroTitle,
      heroSubtitle,
      heroBgUrl,
      announcementText,
      announcementCoupon,
      glowIntensity,
      glowColor,
      wardenGifUrl,
      discordTicketsUrl,
      monthlyGoalTarget,
      monthlyGoalLabel,
    });
    
    saveCustomization.mutate({
      pixKey: pixKey || undefined,
      pixKeyType,
    });
  };

  if (isLoading || isLoadingCustomization) {
    return (
      <AdminLayout title="Personalização">
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Personalização">
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Personalização do Site
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure o nome, logo, hero, anúncios, efeitos visuais e GIF do Warden.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saveSettings.isPending} className="gap-2">
            {saveSettings.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Tudo
          </Button>
        </div>

        {/* Identidade */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              Identidade da Loja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Nome da Loja</Label>
              <Input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="bg-muted border-border"
                placeholder="Warden Shop"
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Descrição da Loja</Label>
              <Textarea
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                className="bg-muted border-border resize-none"
                rows={2}
                placeholder="A loja oficial do servidor..."
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">URL do Logo</Label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="bg-muted border-border"
                placeholder="https://..."
              />
              {logoUrl && (
                <img src={logoUrl} alt="Logo preview" className="mt-2 h-12 w-12 object-contain rounded" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Hero */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Seção Hero (Banner Principal)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Título do Hero</Label>
              <Input
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                className="bg-muted border-border"
                placeholder="A Loja Oficial do Warden Craft"
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Subtítulo do Hero</Label>
              <Textarea
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                className="bg-muted border-border resize-none"
                rows={2}
                placeholder="Adquira kits, ranks e itens exclusivos..."
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">URL da Imagem de Fundo do Hero</Label>
              <Input
                value={heroBgUrl}
                onChange={(e) => setHeroBgUrl(e.target.value)}
                className="bg-muted border-border"
                placeholder="https://..."
              />
              {heroBgUrl && (
                <img
                  src={heroBgUrl}
                  alt="Hero preview"
                  className="mt-2 h-24 w-full object-cover rounded-lg"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Announcement */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Banner de Anúncio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Texto do Anúncio</Label>
              <Input
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="bg-muted border-border"
                placeholder="Use o cupom e ganhe desconto!"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deixe vazio para ocultar o banner.
              </p>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Código do Cupom (exibido no banner)</Label>
              <Input
                value={announcementCoupon}
                onChange={(e) => setAnnouncementCoupon(e.target.value.toUpperCase())}
                className="bg-muted border-border font-mono"
                placeholder="DESCONTO10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pagamento PIX */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              Configuração de Pagamento PIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Chave PIX</Label>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="bg-muted border-border"
                placeholder="Sua chave PIX (CPF, email, telefone ou aleatória)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Esta chave será exibida no checkout para que os clientes façam o pagamento.
              </p>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Tipo de Chave PIX</Label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value as "cpf" | "email" | "phone" | "random")}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground"
              >
                <option value="cpf">CPF</option>
                <option value="email">Email</option>
                <option value="phone">Telefone</option>
                <option value="random">Aleatória</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione o tipo de chave PIX que você está usando.
              </p>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Link do Canal de Tickets do Discord</Label>
              <Input
                value={discordTicketsUrl}
                onChange={(e) => setDiscordTicketsUrl(e.target.value)}
                className="bg-muted border-border"
                placeholder="https://discord.com/channels/..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Link exibido na página de confirmação de pedido para o cliente abrir um ticket com o comprovante.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Meta do Mês */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              🎯 Meta do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Título da Meta</Label>
              <Input
                value={monthlyGoalLabel}
                onChange={(e) => setMonthlyGoalLabel(e.target.value)}
                className="bg-muted border-border"
                placeholder="Meta do mês"
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Valor da Meta (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monthlyGoalTarget}
                onChange={(e) => setMonthlyGoalTarget(e.target.value)}
                className="bg-muted border-border"
                placeholder="500.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O progresso é calculado automaticamente com base nos pedidos entregues do mês atual. Deixe 0 para ocultar a barra.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Glow e Warden GIF */}        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Efeitos Visuais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Intensidade do Glow (0.0 - 1.0)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={glowIntensity}
                onChange={(e) => setGlowIntensity(e.target.value)}
                className="bg-muted border-border"
                placeholder="0.4"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Controla o brilho ao redor das imagens das categorias. 0.4 = padrão.
              </p>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Cor do Glow</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={glowColor}
                  onChange={(e) => setGlowColor(e.target.value)}
                  className="bg-muted border-border w-16 h-10"
                />
                <Input
                  type="text"
                  value={glowColor}
                  onChange={(e) => setGlowColor(e.target.value)}
                  className="bg-muted border-border flex-1"
                  placeholder="#00c8c8"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cor padrão do glow quando a cor da imagem não pode ser detectada.
              </p>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">URL do GIF do Warden (Hero)</Label>
              <Input
                value={wardenGifUrl}
                onChange={(e) => setWardenGifUrl(e.target.value)}
                className="bg-muted border-border"
                placeholder="https://..."
              />
              {wardenGifUrl && (
                <img
                  src={wardenGifUrl}
                  alt="Warden preview"
                  className="mt-2 h-32 w-32 object-contain rounded"
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                GIF que aparece no lado direito do banner principal (hero).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
