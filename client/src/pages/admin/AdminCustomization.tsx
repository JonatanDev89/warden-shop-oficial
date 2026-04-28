import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Palette, Save, Store, Megaphone, Sparkles, Target, Paintbrush, Type } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// ─── Presets de tema prontos ───────────────────────────────────────────────────
const THEME_PRESETS = [
  {
    name: "Warden (Padrão)",
    emoji: "🟦",
    primaryColor: "#00c8c8",
    backgroundColor: "#1a1f2e",
    cardColor: "#222840",
    glowColor: "#00c8c8",
    borderRadius: "0.5rem",
  },
  {
    name: "Fogo",
    emoji: "🔴",
    primaryColor: "#ff4500",
    backgroundColor: "#1a0f0f",
    cardColor: "#2a1515",
    glowColor: "#ff4500",
    borderRadius: "0.5rem",
  },
  {
    name: "Floresta",
    emoji: "🟢",
    primaryColor: "#22c55e",
    backgroundColor: "#0f1a12",
    cardColor: "#152218",
    glowColor: "#22c55e",
    borderRadius: "0.5rem",
  },
  {
    name: "Roxo",
    emoji: "🟣",
    primaryColor: "#a855f7",
    backgroundColor: "#130f1a",
    cardColor: "#1e1528",
    glowColor: "#a855f7",
    borderRadius: "0.5rem",
  },
  {
    name: "Dourado",
    emoji: "🟡",
    primaryColor: "#f59e0b",
    backgroundColor: "#1a1500",
    cardColor: "#261e00",
    glowColor: "#f59e0b",
    borderRadius: "0.5rem",
  },
  {
    name: "Rosa",
    emoji: "🩷",
    primaryColor: "#ec4899",
    backgroundColor: "#1a0f15",
    cardColor: "#2a1520",
    glowColor: "#ec4899",
    borderRadius: "0.5rem",
  },
  {
    name: "Claro",
    emoji: "⬜",
    primaryColor: "#6366f1",
    backgroundColor: "#f8fafc",
    cardColor: "#ffffff",
    glowColor: "#6366f1",
    borderRadius: "0.75rem",
  },
];

const FONT_OPTIONS = [
  { label: "Inter (padrão)", value: "'Inter', sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Nunito", value: "'Nunito', sans-serif" },
  { label: "Rajdhani (gaming)", value: "'Rajdhani', sans-serif" },
  { label: "Orbitron (sci-fi)", value: "'Orbitron', sans-serif" },
];

const RADIUS_OPTIONS = [
  { label: "Sem arredondamento", value: "0rem" },
  { label: "Pequeno", value: "0.25rem" },
  { label: "Médio (padrão)", value: "0.5rem" },
  { label: "Grande", value: "0.75rem" },
  { label: "Muito grande", value: "1rem" },
  { label: "Pill", value: "9999px" },
];

// ─── Componente de seletor de cor com preview ──────────────────────────────────
function ColorPicker({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-foreground mb-1.5 block">{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-border bg-muted p-0.5"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-muted border-border flex-1 font-mono"
          placeholder="#000000"
          maxLength={7}
        />
        <div
          className="w-10 h-10 rounded border border-border flex-shrink-0"
          style={{ backgroundColor: value || "transparent" }}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function AdminCustomization() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.admin.getSettings.useQuery();

  // Identidade
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");

  // Hero
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroBgUrl, setHeroBgUrl] = useState("");
  const [wardenGifUrl, setWardenGifUrl] = useState("");

  // Anúncio
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementCoupon, setAnnouncementCoupon] = useState("");

  // Tema / Cores
  const [primaryColor, setPrimaryColor] = useState("#00c8c8");
  const [backgroundColor, setBackgroundColor] = useState("#1a1f2e");
  const [cardColor, setCardColor] = useState("#222840");
  const [glowColor, setGlowColor] = useState("#00c8c8");
  const [glowIntensity, setGlowIntensity] = useState("0.4");
  const [borderRadius, setBorderRadius] = useState("0.5rem");
  const [fontFamily, setFontFamily] = useState("'Inter', sans-serif");

  // Pagamento — removido da UI (gerenciado via .env / Mercado Pago)
  const [discordTicketsUrl, setDiscordTicketsUrl] = useState("");

  // Meta
  const [monthlyGoalTarget, setMonthlyGoalTarget] = useState("");
  const [monthlyGoalLabel, setMonthlyGoalLabel] = useState("");

  useEffect(() => {
    if (!settings) return;
    setStoreName(settings.storeName ?? "");
    setStoreDescription(settings.storeDescription ?? "");
    setLogoUrl(settings.logoUrl ?? "");
    setFaviconUrl(settings.faviconUrl ?? "");
    setHeroTitle(settings.heroTitle ?? "");
    setHeroSubtitle(settings.heroSubtitle ?? "");
    setHeroBgUrl(settings.heroBgUrl ?? "");
    setWardenGifUrl(settings.wardenGifUrl ?? "");
    setAnnouncementText(settings.announcementText ?? "");
    setAnnouncementCoupon(settings.announcementCoupon ?? "");
    setPrimaryColor(settings.primaryColor ?? "#00c8c8");
    setBackgroundColor(settings.backgroundColor ?? "#1a1f2e");
    setCardColor(settings.cardColor ?? "#222840");
    setGlowColor(settings.glowColor ?? "#00c8c8");
    setGlowIntensity(settings.glowIntensity ?? "0.4");
    setBorderRadius(settings.borderRadius ?? "0.5rem");
    setFontFamily(settings.fontFamily ?? "'Inter', sans-serif");
    setDiscordTicketsUrl(settings.discordTicketsUrl ?? "");
    setMonthlyGoalTarget(settings.monthlyGoalTarget ?? "");
    setMonthlyGoalLabel(settings.monthlyGoalLabel ?? "Meta do mês");
  }, [settings]);

  const saveSettings = trpc.admin.saveSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSettings.invalidate();
      utils.shop.getSettings.invalidate();
      toast.success("Configurações salvas!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    saveSettings.mutate({
      storeName,
      storeDescription,
      logoUrl,
      faviconUrl,
      heroTitle,
      heroSubtitle,
      heroBgUrl,
      wardenGifUrl,
      announcementText,
      announcementCoupon,
      primaryColor,
      backgroundColor,
      cardColor,
      glowColor,
      glowIntensity,
      borderRadius,
      fontFamily,
      discordTicketsUrl,
      monthlyGoalTarget,
      monthlyGoalLabel,
    });
  };

  const applyPreset = (preset: (typeof THEME_PRESETS)[0]) => {
    setPrimaryColor(preset.primaryColor);
    setBackgroundColor(preset.backgroundColor);
    setCardColor(preset.cardColor);
    setGlowColor(preset.glowColor);
    setBorderRadius(preset.borderRadius);
    toast.success(`Tema "${preset.name}" aplicado! Clique em Salvar para confirmar.`);
  };

  const isSaving = saveSettings.isPending;

  if (isLoading) {
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Personalização do Site
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure a identidade visual, cores, textos e conteúdo da sua loja.
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Tudo
          </Button>
        </div>

        {/* Presets de Tema */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-primary" />
              Presets de Tema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Clique em um preset para aplicar as cores automaticamente. Você ainda pode ajustar individualmente depois.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted hover:border-primary hover:bg-primary/10 transition-colors text-sm text-foreground text-left"
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 border border-border"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Identidade */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
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
                placeholder="Minha Loja"
              />
              <p className="text-xs text-muted-foreground mt-1">Aparece no navbar, rodapé e aba do navegador.</p>
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
                <img src={logoUrl} alt="Logo preview" className="mt-2 h-12 w-12 object-contain rounded border border-border" />
              )}
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">URL do Favicon</Label>
              <Input
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                className="bg-muted border-border"
                placeholder="https://... (.ico, .png, .svg)"
              />
              <p className="text-xs text-muted-foreground mt-1">Ícone exibido na aba do navegador.</p>
            </div>
          </CardContent>
        </Card>

        {/* Cores e Tema */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              Cores e Tema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorPicker
              label="Cor Primária (botões, links, destaques)"
              value={primaryColor}
              onChange={setPrimaryColor}
              hint="Cor principal da sua marca. Usada em botões, bordas ativas e ícones."
            />
            <ColorPicker
              label="Cor de Fundo"
              value={backgroundColor}
              onChange={setBackgroundColor}
              hint="Cor de fundo geral do site."
            />
            <ColorPicker
              label="Cor dos Cards"
              value={cardColor}
              onChange={setCardColor}
              hint="Cor de fundo dos cards, modais e painéis."
            />
            <ColorPicker
              label="Cor do Glow (efeito de brilho)"
              value={glowColor}
              onChange={setGlowColor}
              hint="Cor do brilho ao redor das imagens de categorias."
            />
            <div>
              <Label className="text-foreground mb-1.5 block">Intensidade do Glow (0.0 – 1.0)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={glowIntensity}
                onChange={(e) => setGlowIntensity(e.target.value)}
                className="bg-muted border-border"
                placeholder="0.4"
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Arredondamento dos Cantos</Label>
              <select
                value={borderRadius}
                onChange={(e) => setBorderRadius(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground"
              >
                {RADIUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Tipografia */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              Tipografia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Fonte Principal</Label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground"
                style={{ fontFamily }}
              >
                {FONT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ fontFamily: o.value }}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                A fonte é carregada do Google Fonts automaticamente se disponível no navegador.
              </p>
              <p
                className="mt-2 text-sm text-foreground bg-muted rounded px-3 py-2 border border-border"
                style={{ fontFamily }}
              >
                Preview: A loja mais completa do servidor. 0123456789
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hero */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Seção Hero (Banner Principal)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Título do Hero</Label>
              <Input
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                className="bg-muted border-border"
                placeholder="A Loja Oficial do Servidor"
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
                <img src={heroBgUrl} alt="Hero preview" className="mt-2 h-24 w-full object-cover rounded-lg border border-border" />
              )}
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">URL do GIF/Imagem Decorativa (lado direito do hero)</Label>
              <Input
                value={wardenGifUrl}
                onChange={(e) => setWardenGifUrl(e.target.value)}
                className="bg-muted border-border"
                placeholder="https://..."
              />
              {wardenGifUrl && (
                <img src={wardenGifUrl} alt="GIF preview" className="mt-2 h-32 w-32 object-contain rounded border border-border" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Anúncio */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              Banner de Anúncio
            </CardTitle>
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
              <p className="text-xs text-muted-foreground mt-1">Deixe vazio para ocultar o banner.</p>
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
            <div>
              <Label className="text-foreground mb-1.5 block">Link do Discord (tickets/suporte)</Label>
              <Input
                value={discordTicketsUrl}
                onChange={(e) => setDiscordTicketsUrl(e.target.value)}
                className="bg-muted border-border"
                placeholder="https://discord.com/channels/..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Exibido na página de confirmação de pedido para o cliente abrir um ticket.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Meta do Mês */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Meta do Mês
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
                O progresso é calculado automaticamente com base nos pedidos entregues do mês. Deixe 0 para ocultar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Botão salvar no final também */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={isSaving} size="lg" className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Tudo
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
