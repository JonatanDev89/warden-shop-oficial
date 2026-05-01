import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Loader2, Palette, Save, Store, Megaphone, Sparkles, Target,
  Paintbrush, Type, Wand2, Eye, Image, Link2, Trophy, MessageSquare,
  ToggleLeft,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// ─── Presets ──────────────────────────────────────────────────────────────────
const THEME_PRESETS = [
  { name: "Warden",   primaryColor: "#00c8c8", backgroundColor: "#1a1f2e", cardColor: "#222840", glowColor: "#00c8c8", borderRadius: "0.5rem" },
  { name: "Fogo",     primaryColor: "#ff4500", backgroundColor: "#1a0f0f", cardColor: "#2a1515", glowColor: "#ff4500", borderRadius: "0.5rem" },
  { name: "Floresta", primaryColor: "#22c55e", backgroundColor: "#0f1a12", cardColor: "#152218", glowColor: "#22c55e", borderRadius: "0.5rem" },
  { name: "Roxo",     primaryColor: "#a855f7", backgroundColor: "#130f1a", cardColor: "#1e1528", glowColor: "#a855f7", borderRadius: "0.5rem" },
  { name: "Dourado",  primaryColor: "#f59e0b", backgroundColor: "#1a1500", cardColor: "#261e00", glowColor: "#f59e0b", borderRadius: "0.5rem" },
  { name: "Rosa",     primaryColor: "#ec4899", backgroundColor: "#1a0f15", cardColor: "#2a1520", glowColor: "#ec4899", borderRadius: "0.5rem" },
  { name: "Oceano",   primaryColor: "#0ea5e9", backgroundColor: "#0a1628", cardColor: "#0f1e38", glowColor: "#0ea5e9", borderRadius: "0.5rem" },
  { name: "Neon",     primaryColor: "#84cc16", backgroundColor: "#0d1117", cardColor: "#161b22", glowColor: "#84cc16", borderRadius: "0.25rem" },
  { name: "Claro",    primaryColor: "#6366f1", backgroundColor: "#f8fafc", cardColor: "#ffffff", glowColor: "#6366f1", borderRadius: "0.75rem" },
];

const FONT_OPTIONS = [
  { label: "Inter (padrão)",    value: "'Inter', sans-serif" },
  { label: "Space Grotesk",     value: "'Space Grotesk', sans-serif" },
  { label: "Roboto",            value: "'Roboto', sans-serif" },
  { label: "Poppins",           value: "'Poppins', sans-serif" },
  { label: "Montserrat",        value: "'Montserrat', sans-serif" },
  { label: "Nunito",            value: "'Nunito', sans-serif" },
  { label: "Rajdhani (gaming)", value: "'Rajdhani', sans-serif" },
  { label: "Orbitron (sci-fi)", value: "'Orbitron', sans-serif" },
];

const RADIUS_OPTIONS = [
  { label: "Nenhum",  value: "0rem",    preview: "0px" },
  { label: "Pequeno", value: "0.25rem", preview: "4px" },
  { label: "Médio",   value: "0.5rem",  preview: "8px" },
  { label: "Grande",  value: "0.75rem", preview: "12px" },
  { label: "Extra",   value: "1rem",    preview: "16px" },
  { label: "Pill",    value: "9999px",  preview: "9999px" },
];

const QUICK_COLORS = [
  "#00c8c8","#ff4500","#22c55e","#a855f7","#f59e0b",
  "#ec4899","#3b82f6","#ef4444","#14b8a6","#f97316",
  "#8b5cf6","#06b6d4","#84cc16","#e11d48","#0ea5e9",
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = "aparencia" | "identidade" | "conteudo" | "funcionalidades" | "avancado";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "aparencia",       label: "Aparência",        icon: <Palette className="h-4 w-4" /> },
  { id: "identidade",      label: "Identidade",       icon: <Store className="h-4 w-4" /> },
  { id: "conteudo",        label: "Conteúdo",         icon: <Sparkles className="h-4 w-4" /> },
  { id: "funcionalidades", label: "Funcionalidades",  icon: <ToggleLeft className="h-4 w-4" /> },
  { id: "avancado",        label: "Avançado",         icon: <Target className="h-4 w-4" /> },
];

// ─── Utilitários de cor ────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
}
function hexToHsl(hex: string) {
  const rgb = hexToRgb(hex); if (!rgb) return null;
  const r=rgb.r/255, g=rgb.g/255, b=rgb.b/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0; const l=(max+min)/2;
  if (max!==min) {
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}
  }
  return { h:h*360, s:s*100, l:l*100 };
}
function hslToHex(h: number, s: number, l: number) {
  const hn=h/360, sn=s/100, ln=l/100;
  const hue2rgb=(p:number,q:number,t:number)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  if(sn===0){const v=Math.round(ln*255);return rgbToHex(v,v,v);}
  const q=ln<0.5?ln*(1+sn):ln+sn-ln*sn, p=2*ln-q;
  return rgbToHex(Math.round(hue2rgb(p,q,hn+1/3)*255),Math.round(hue2rgb(p,q,hn)*255),Math.round(hue2rgb(p,q,hn-1/3)*255));
}
function getLuminance(hex: string) {
  const rgb=hexToRgb(hex); if(!rgb) return 0;
  const tl=(c:number)=>{const v=c/255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  return 0.2126*tl(rgb.r)+0.7152*tl(rgb.g)+0.0722*tl(rgb.b);
}
function getContrastColor(hex: string) { return getLuminance(hex)>0.179?"#000000":"#ffffff"; }
function deriveCardColor(bgHex: string) {
  const hsl=hexToHsl(bgHex); if(!hsl) return "#222840";
  return hslToHex(hsl.h,Math.min(hsl.s+5,100),Math.min(hsl.l+4,95));
}
function deriveBgColor(primaryHex: string) {
  const hsl=hexToHsl(primaryHex); if(!hsl) return "#1a1f2e";
  return hslToHex(hsl.h,Math.min(hsl.s*0.3,40),10);
}

// ─── ColorPicker ──────────────────────────────────────────────────────────────
function ColorPicker({ label, value, onChange, hint, showQuickColors=false }: {
  label: string; value: string; onChange:(v:string)=>void; hint?:string; showQuickColors?:boolean;
}) {
  const [hexInput, setHexInput] = useState(value);
  const isValid = /^#[0-9a-fA-F]{6}$/.test(value);
  const contrast = isValid ? getContrastColor(value) : "#fff";

  useEffect(() => { setHexInput(value); }, [value]);

  const handleHex = (raw: string) => {
    const v = raw.startsWith("#") ? raw : "#"+raw;
    setHexInput(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex gap-2 items-center">
        <label
          className="relative w-10 h-10 rounded-lg border-2 border-border cursor-pointer flex-shrink-0 overflow-hidden transition-all hover:border-primary hover:scale-105"
          style={{ backgroundColor: isValid ? value : "#000" }}
          title="Abrir seletor de cor"
        >
          <input type="color" value={isValid?value:"#000000"} onChange={e=>onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </label>
        <div className="relative flex-1">
          <Input type="text" value={hexInput} onChange={e=>handleHex(e.target.value)}
            className={`font-mono text-sm pr-8 ${!isValid&&hexInput.length>1?"border-destructive":""}`}
            placeholder="#000000" maxLength={7} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-border"
            style={{ backgroundColor: isValid?value:"transparent" }} />
        </div>
        {isValid && (
          <div className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: value, color: contrast }} title="Contraste do texto">
            Aa
          </div>
        )}
      </div>
      {showQuickColors && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_COLORS.map(c => (
            <button key={c} onClick={()=>onChange(c)} title={c}
              className={`w-5 h-5 rounded border-2 transition-all hover:scale-110 ${value===c?"border-white scale-110":"border-transparent"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── ThemePreview ─────────────────────────────────────────────────────────────
function ThemePreview({ primaryColor, backgroundColor, cardColor, glowColor }: {
  primaryColor:string; backgroundColor:string; cardColor:string; glowColor:string;
}) {
  const pc = getContrastColor(primaryColor);
  const cc = getContrastColor(cardColor);

  return (
    <div className="rounded-xl border border-border overflow-hidden text-[11px] select-none" style={{ backgroundColor }}>
      {/* Navbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ backgroundColor: cardColor, borderColor: primaryColor+"33" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="font-bold" style={{ color: cc }}>Warden Shop</span>
        </div>
        <div className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: primaryColor, color: pc }}>Entrar</div>
      </div>
      {/* Anúncio */}
      <div className="px-3 py-1 text-center font-medium" style={{ backgroundColor: primaryColor, color: pc }}>
        🎉 Cupom DESCONTO10 — 10% off!
      </div>
      {/* Cards */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {[{name:"Kit Iniciante",price:"R$ 9,90",icon:"⚔️",glow:true},{name:"Rank VIP",price:"R$ 29,90",icon:"👑",glow:false}].map(item=>(
          <div key={item.name} className="rounded-lg p-2.5 border" style={{
            backgroundColor: cardColor,
            borderColor: item.glow ? primaryColor+"66" : "transparent",
            boxShadow: item.glow ? `0 0 14px 3px ${glowColor}44` : "none",
          }}>
            <div className="w-full h-8 rounded mb-1.5 flex items-center justify-center text-base" style={{ backgroundColor: primaryColor+"22" }}>{item.icon}</div>
            <p className="font-semibold truncate" style={{ color: cc }}>{item.name}</p>
            <p style={{ color: cc+"88" }}>{item.price}</p>
            <div className="mt-1.5 rounded py-0.5 text-center font-medium" style={{ backgroundColor: primaryColor, color: pc }}>Comprar</div>
          </div>
        ))}
      </div>
      {/* Progress */}
      <div className="px-3 pb-3">
        <div className="rounded-lg p-2" style={{ backgroundColor: cardColor }}>
          <div className="flex justify-between mb-1" style={{ color: cc+"99" }}>
            <span>Meta do mês</span><span style={{ color: primaryColor }}>60%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: primaryColor+"22" }}>
            <div className="h-1.5 rounded-full w-3/5" style={{ backgroundColor: primaryColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FeatureToggle ────────────────────────────────────────────────────────────
function FeatureToggle({
  label, description, enabled, onChange,
}: {
  label: string; description: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-border mb-5">
      <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">{icon}</div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ─── FieldGroup ───────────────────────────────────────────────────────────────
function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function AdminCustomization() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.admin.getSettings.useQuery();
  const [activeTab, setActiveTab] = useState<Tab>("aparencia");

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
  const [discordUrl, setDiscordUrl] = useState("");
  const [discordTicketsUrl, setDiscordTicketsUrl] = useState("");

  // Tema
  const [primaryColor, setPrimaryColor] = useState("#00c8c8");
  const [backgroundColor, setBackgroundColor] = useState("#1a1f2e");
  const [cardColor, setCardColor] = useState("#222840");
  const [glowColor, setGlowColor] = useState("#00c8c8");
  const [glowIntensity, setGlowIntensity] = useState("0.4");
  const [borderRadius, setBorderRadius] = useState("0.5rem");
  const [fontFamily, setFontFamily] = useState("'Inter', sans-serif");

  // Meta
  const [monthlyGoalTarget, setMonthlyGoalTarget] = useState("");
  const [monthlyGoalLabel, setMonthlyGoalLabel] = useState("");

  // Feature flags
  const [featureSearch, setFeatureSearch]           = useState(true);
  const [featureAnnouncement, setFeatureAnnouncement] = useState(true);
  const [featureCoupons, setFeatureCoupons]           = useState(true);
  const [featureTopBuyers, setFeatureTopBuyers]       = useState(true);
  const [featureMonthlyGoal, setFeatureMonthlyGoal]   = useState(true);
  const [featureKitBuilder, setFeatureKitBuilder]     = useState(true);
  const [featureFaq, setFeatureFaq]                   = useState(true);
  const [featureHighlights, setFeatureHighlights]     = useState(true);

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
    setDiscordUrl(settings.discordUrl ?? "");
    setDiscordTicketsUrl(settings.discordTicketsUrl ?? "");
    setMonthlyGoalTarget(settings.monthlyGoalTarget ?? "");
    setMonthlyGoalLabel(settings.monthlyGoalLabel ?? "Meta do mês");
    // Feature flags (stored as "true"/"false" strings)
    const flag = (key: string, def = true) => (settings[key] ?? String(def)) !== "false";
    setFeatureSearch(flag("featureSearch"));
    setFeatureAnnouncement(flag("featureAnnouncement"));
    setFeatureCoupons(flag("featureCoupons"));
    setFeatureTopBuyers(flag("featureTopBuyers"));
    setFeatureMonthlyGoal(flag("featureMonthlyGoal"));
    setFeatureKitBuilder(flag("featureKitBuilder"));
    setFeatureFaq(flag("featureFaq"));
    setFeatureHighlights(flag("featureHighlights"));
  }, [settings]);

  const saveSettings = trpc.admin.saveSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSettings.invalidate();
      utils.shop.getSettings.invalidate();
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    saveSettings.mutate({
      storeName, storeDescription, logoUrl, faviconUrl,
      heroTitle, heroSubtitle, heroBgUrl, wardenGifUrl,
      announcementText, announcementCoupon,
      primaryColor, backgroundColor, cardColor, glowColor,
      glowIntensity, borderRadius, fontFamily,
      discordUrl, discordTicketsUrl, monthlyGoalTarget, monthlyGoalLabel,
      // Feature flags
      featureSearch: String(featureSearch),
      featureAnnouncement: String(featureAnnouncement),
      featureCoupons: String(featureCoupons),
      featureTopBuyers: String(featureTopBuyers),
      featureMonthlyGoal: String(featureMonthlyGoal),
      featureKitBuilder: String(featureKitBuilder),
      featureFaq: String(featureFaq),
      featureHighlights: String(featureHighlights),
    });
  };

  const applyPreset = (preset: (typeof THEME_PRESETS)[0]) => {
    setPrimaryColor(preset.primaryColor);
    setBackgroundColor(preset.backgroundColor);
    setCardColor(preset.cardColor);
    setGlowColor(preset.glowColor);
    setBorderRadius(preset.borderRadius);
    toast.success(`Tema "${preset.name}" aplicado!`);
  };

  const autoDerive = useCallback(() => {
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) return;
    const newBg = deriveBgColor(primaryColor);
    const newCard = deriveCardColor(newBg);
    setBackgroundColor(newBg);
    setCardColor(newCard);
    setGlowColor(primaryColor);
    toast.success("Cores derivadas da cor primária!");
  }, [primaryColor]);

  const isSaving = saveSettings.isPending;

  if (isLoading) {
    return (
      <AdminLayout title="Personalização">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Personalização">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personalização</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controle total sobre a aparência e conteúdo da sua loja.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="lg" className="gap-2 min-w-[130px]">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {/* ── Tab nav ── */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Aparência ── */}
      {activeTab === "aparencia" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Coluna esquerda — controles */}
          <div className="space-y-6">

            {/* Presets */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paintbrush className="h-4 w-4 text-primary" /> Presets de Tema
                </CardTitle>
                <CardDescription>Ponto de partida rápido. Ajuste as cores individualmente depois.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {THEME_PRESETS.map(preset => {
                    const active = primaryColor===preset.primaryColor && backgroundColor===preset.backgroundColor;
                    return (
                      <button key={preset.name} onClick={()=>applyPreset(preset)}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                          active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-muted/50 hover:border-primary/50 hover:bg-muted"
                        }`}>
                        {/* 3 swatches */}
                        <div className="flex gap-0.5">
                          {[preset.backgroundColor, preset.cardColor, preset.primaryColor].map((c,i) => (
                            <span key={i} className="w-4 h-4 rounded-full border border-white/10"
                              style={{ backgroundColor: c, boxShadow: i===2?`0 0 5px 1px ${c}88`:"none" }} />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-foreground leading-none">{preset.name}</span>
                        {active && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Cores */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" /> Paleta de Cores
                </CardTitle>
                <CardDescription>Defina as cores base da sua loja.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ColorPicker label="Cor Primária" value={primaryColor} onChange={setPrimaryColor}
                  hint="Botões, links, bordas ativas e destaques." showQuickColors />

                <Button type="button" variant="outline" size="sm" onClick={autoDerive} className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground">
                  <Wand2 className="h-3.5 w-3.5" />
                  Gerar fundo e card automaticamente a partir da cor primária
                </Button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ColorPicker label="Cor de Fundo" value={backgroundColor} onChange={setBackgroundColor}
                    hint="Fundo geral do site." />
                  <ColorPicker label="Cor dos Cards" value={cardColor} onChange={setCardColor}
                    hint="Cards, modais e painéis." />
                </div>

                <ColorPicker label="Cor do Glow" value={glowColor} onChange={setGlowColor}
                  hint="Brilho ao redor das imagens de categorias." />
              </CardContent>
            </Card>

            {/* Glow + Radius */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Intensidade do glow */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" /> Intensidade do Glow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sem brilho</span>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                      {parseFloat(glowIntensity).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">Máximo</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={glowIntensity}
                    onChange={e=>setGlowIntensity(e.target.value)}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${glowColor}33, ${glowColor}) 0% / ${parseFloat(glowIntensity)*100}% 100%, var(--muted) ${parseFloat(glowIntensity)*100}% 100%`,
                    }} />
                  {/* Preview do glow */}
                  <div className="flex justify-center pt-1">
                    <div className="w-14 h-14 rounded-xl border border-border flex items-center justify-center text-2xl"
                      style={{
                        backgroundColor: cardColor,
                        boxShadow: `0 0 ${Math.round(parseFloat(glowIntensity)*40)}px ${Math.round(parseFloat(glowIntensity)*15)}px ${glowColor}${Math.round(parseFloat(glowIntensity)*255).toString(16).padStart(2,"0")}`,
                      }}>⚔️</div>
                  </div>
                </CardContent>
              </Card>

              {/* Arredondamento */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Arredondamento dos Cantos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {RADIUS_OPTIONS.map(o => (
                      <button key={o.value} onClick={()=>setBorderRadius(o.value)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                          borderRadius===o.value ? "border-primary bg-primary/10" : "border-border bg-muted/50 hover:border-primary/40"
                        }`}>
                        <div className="w-7 h-7 border-2"
                          style={{
                            borderRadius: o.preview,
                            borderColor: borderRadius===o.value ? primaryColor : "currentColor",
                            backgroundColor: borderRadius===o.value ? primaryColor+"22" : "transparent",
                          }} />
                        <span className="text-[10px] text-muted-foreground leading-tight text-center">{o.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tipografia */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" /> Tipografia
                </CardTitle>
                <CardDescription>Fonte carregada automaticamente do Google Fonts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {FONT_OPTIONS.map(o => (
                    <button key={o.value} onClick={()=>setFontFamily(o.value)}
                      className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
                        fontFamily===o.value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      style={{ fontFamily: o.value }}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-border bg-muted/50 px-4 py-3" style={{ fontFamily }}>
                  <p className="text-sm text-foreground">A loja mais completa do servidor.</p>
                  <p className="text-xs text-muted-foreground mt-0.5">0123456789 — ABCDEFGHIJ</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna direita — preview fixo */}
          <div className="xl:sticky xl:top-6 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Eye className="h-3.5 w-3.5" /> Preview em tempo real
            </div>
            <ThemePreview primaryColor={primaryColor} backgroundColor={backgroundColor} cardColor={cardColor} glowColor={glowColor} />
            <p className="text-xs text-muted-foreground text-center">As alterações são aplicadas ao salvar.</p>
          </div>
        </div>
      )}

      {/* ── Tab: Identidade ── */}
      {activeTab === "identidade" && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" /> Informações da Loja
              </CardTitle>
              <CardDescription>Nome e descrição exibidos no site e nas abas do navegador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="Nome da Loja" hint="Aparece no navbar, rodapé e aba do navegador.">
                <Input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Minha Loja" />
              </FieldGroup>
              <FieldGroup label="Descrição da Loja">
                <Textarea value={storeDescription} onChange={e=>setStoreDescription(e.target.value)}
                  className="resize-none" rows={3} placeholder="A loja oficial do servidor..." />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" /> Imagens da Marca
              </CardTitle>
              <CardDescription>Logo e favicon da sua loja.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="URL do Logo" hint="Recomendado: PNG ou SVG com fundo transparente.">
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Input value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded border border-border flex-shrink-0" />
                  )}
                </div>
              </FieldGroup>
              <FieldGroup label="URL do Favicon" hint="Ícone exibido na aba do navegador (.ico, .png, .svg).">
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Input value={faviconUrl} onChange={e=>setFaviconUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  {faviconUrl && (
                    <img src={faviconUrl} alt="Favicon" className="h-10 w-10 object-contain rounded border border-border flex-shrink-0" />
                  )}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Conteúdo ── */}
      {activeTab === "conteudo" && (
        <div className="max-w-2xl space-y-6">
          {/* Hero */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Banner Principal (Hero)
              </CardTitle>
              <CardDescription>Seção de destaque no topo da página inicial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="Título">
                <Input value={heroTitle} onChange={e=>setHeroTitle(e.target.value)} placeholder="A Loja Oficial do Servidor" />
              </FieldGroup>
              <FieldGroup label="Subtítulo">
                <Textarea value={heroSubtitle} onChange={e=>setHeroSubtitle(e.target.value)}
                  className="resize-none" rows={2} placeholder="Adquira kits, ranks e itens exclusivos..." />
              </FieldGroup>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Imagem de Fundo" hint="URL de uma imagem para o fundo do hero.">
                  <Input value={heroBgUrl} onChange={e=>setHeroBgUrl(e.target.value)} placeholder="https://..." />
                  {heroBgUrl && (
                    <img src={heroBgUrl} alt="Hero bg" className="mt-2 h-20 w-full object-cover rounded-lg border border-border" />
                  )}
                </FieldGroup>
                <FieldGroup label="GIF / Imagem Decorativa" hint="Exibida no lado direito do hero.">
                  <Input value={wardenGifUrl} onChange={e=>setWardenGifUrl(e.target.value)} placeholder="https://..." />
                  {wardenGifUrl && (
                    <img src={wardenGifUrl} alt="GIF" className="mt-2 h-20 w-20 object-contain rounded border border-border" />
                  )}
                </FieldGroup>
              </div>
            </CardContent>
          </Card>

          {/* Anúncio */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" /> Banner de Anúncio
              </CardTitle>
              <CardDescription>Faixa no topo do site. Deixe o texto vazio para ocultar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="Texto do Anúncio">
                <Input value={announcementText} onChange={e=>setAnnouncementText(e.target.value)}
                  placeholder="Use o cupom e ganhe desconto!" />
              </FieldGroup>
              <FieldGroup label="Código do Cupom" hint="Exibido em destaque ao lado do texto.">
                <Input value={announcementCoupon} onChange={e=>setAnnouncementCoupon(e.target.value.toUpperCase())}
                  className="font-mono" placeholder="DESCONTO10" />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Suporte
              </CardTitle>
              <CardDescription>Links do Discord exibidos na loja.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="Link do Discord (navbar)" hint="Botão Discord no cabeçalho e rodapé da loja.">
                <div className="flex gap-2 items-center">
                  <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input value={discordUrl} onChange={e=>setDiscordUrl(e.target.value)}
                    placeholder="https://discord.gg/..." />
                </div>
              </FieldGroup>
              <FieldGroup label="Link do Discord (tickets)" hint="Canal ou categoria de tickets — exibido na página de confirmação de pedido.">
                <div className="flex gap-2 items-center">
                  <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input value={discordTicketsUrl} onChange={e=>setDiscordTicketsUrl(e.target.value)}
                    placeholder="https://discord.com/channels/..." />
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Funcionalidades ── */}
      {activeTab === "funcionalidades" && (
        <div className="max-w-2xl space-y-6">
          <p className="text-sm text-muted-foreground">
            Ative ou desative seções e recursos da loja. As alterações entram em vigor após salvar.
          </p>

          {/* Navbar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" /> Navegação
              </CardTitle>
              <CardDescription>Itens e recursos exibidos no cabeçalho da loja.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <FeatureToggle
                label="Busca de Produtos"
                description="Campo de busca na barra de navegação e página /busca."
                enabled={featureSearch}
                onChange={setFeatureSearch}
              />
              <FeatureToggle
                label="Monte seu Kit"
                description="Link para a página de montagem de kit personalizado no menu."
                enabled={featureKitBuilder}
                onChange={setFeatureKitBuilder}
              />
            </CardContent>
          </Card>

          {/* Home */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Página Inicial
              </CardTitle>
              <CardDescription>Seções exibidas na home da loja.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <FeatureToggle
                label="Destaques (Entrega / Segurança / Suporte)"
                description="Faixa com os três cards de benefícios abaixo das categorias."
                enabled={featureHighlights}
                onChange={setFeatureHighlights}
              />
              <FeatureToggle
                label="Ranking de Compradores"
                description="Pódio com os maiores compradores do mês na página inicial."
                enabled={featureTopBuyers}
                onChange={setFeatureTopBuyers}
              />
              <FeatureToggle
                label="FAQ (Perguntas Frequentes)"
                description="Seção de perguntas e respostas no final da home."
                enabled={featureFaq}
                onChange={setFeatureFaq}
              />
            </CardContent>
          </Card>

          {/* Checkout */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Checkout
              </CardTitle>
              <CardDescription>Recursos disponíveis durante a finalização de compra.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <FeatureToggle
                label="Cupons de Desconto"
                description="Campo para inserir código de cupom na página de checkout."
                enabled={featureCoupons}
                onChange={setFeatureCoupons}
              />
            </CardContent>
          </Card>

          {/* Widgets */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Widgets
              </CardTitle>
              <CardDescription>Elementos flutuantes e banners da loja.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <FeatureToggle
                label="Banner de Anúncio"
                description="Faixa no topo da loja com texto e cupom em destaque."
                enabled={featureAnnouncement}
                onChange={setFeatureAnnouncement}
              />
              <FeatureToggle
                label="Meta do Mês"
                description="Barra de progresso de faturamento exibida no rodapé da loja."
                enabled={featureMonthlyGoal}
                onChange={setFeatureMonthlyGoal}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Avançado ── */}
      {activeTab === "avancado" && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Meta do Mês
              </CardTitle>
              <CardDescription>
                Barra de progresso exibida na loja. O progresso é calculado automaticamente com base nos pedidos entregues.
                Deixe o valor em 0 para ocultar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="Título da Meta">
                <Input value={monthlyGoalLabel} onChange={e=>setMonthlyGoalLabel(e.target.value)} placeholder="Meta do mês" />
              </FieldGroup>
              <FieldGroup label="Valor da Meta (R$)">
                <Input type="number" min="0" step="0.01" value={monthlyGoalTarget}
                  onChange={e=>setMonthlyGoalTarget(e.target.value)} placeholder="500.00" />
              </FieldGroup>
              {/* Preview da barra */}
              {parseFloat(monthlyGoalTarget) > 0 && (
                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{monthlyGoalLabel || "Meta do mês"}</span>
                    <span className="text-primary font-mono">R$ {parseFloat(monthlyGoalTarget).toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full w-2/5 transition-all" style={{ backgroundColor: primaryColor }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Preview — progresso real calculado automaticamente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Salvar (rodapé) ── */}
      <div className="mt-8 pt-6 border-t border-border flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg" className="gap-2 min-w-[140px]">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Salvando…" : "Salvar Tudo"}
        </Button>
      </div>
    </AdminLayout>
  );
}
