import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Converte uma cor hex (#rrggbb) para oklch aproximado.
 * Usado para injetar cores customizadas como CSS variables do Tailwind.
 */
function hexToOklch(hex: string): string {
  // Remove o #
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "";

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  // sRGB → linear
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // linear sRGB → XYZ D65
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  // XYZ → OKLab
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bOk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // OKLab → OKLCH
  const C = Math.sqrt(a * a + bOk * bOk);
  const H = (Math.atan2(bOk, a) * 180) / Math.PI;
  const hue = H < 0 ? H + 360 : H;

  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${hue.toFixed(1)})`;
}

/**
 * Gera um foreground claro ou escuro baseado na luminosidade da cor primária.
 */
function getForegroundForColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "oklch(0.1 0.01 0)";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "oklch(0.1 0.01 0)" : "oklch(0.98 0.005 0)";
}

/**
 * Hook que lê as configurações de tema do banco e injeta como CSS variables
 * no elemento <html>, sobrescrevendo os valores padrão do index.css.
 * Isso permite que cada loja tenha sua própria identidade visual sem
 * precisar alterar nenhum arquivo de código.
 */
export function useThemeInjector() {
  const { data: settings } = trpc.shop.getSettings.useQuery();

  useEffect(() => {
    if (!settings) return;

    const root = document.documentElement;

    // Cor primária (botões, links, destaques)
    const primaryHex = settings.primaryColor as string | undefined;
    if (primaryHex && /^#[0-9a-fA-F]{6}$/.test(primaryHex)) {
      const primaryOklch = hexToOklch(primaryHex);
      const fgOklch = getForegroundForColor(primaryHex);
      root.style.setProperty("--primary", primaryOklch);
      root.style.setProperty("--primary-foreground", fgOklch);
      root.style.setProperty("--accent", primaryOklch);
      root.style.setProperty("--accent-foreground", fgOklch);
      root.style.setProperty("--ring", primaryOklch);
      root.style.setProperty("--sidebar-primary", primaryOklch);
      root.style.setProperty("--sidebar-primary-foreground", fgOklch);
      root.style.setProperty("--sidebar-ring", primaryOklch);
      root.style.setProperty("--chart-1", primaryOklch);
    }

    // Cor de fundo
    const bgHex = settings.backgroundColor as string | undefined;
    if (bgHex && /^#[0-9a-fA-F]{6}$/.test(bgHex)) {
      const bgOklch = hexToOklch(bgHex);
      root.style.setProperty("--background", bgOklch);
    }

    // Cor dos cards
    const cardHex = settings.cardColor as string | undefined;
    if (cardHex && /^#[0-9a-fA-F]{6}$/.test(cardHex)) {
      const cardOklch = hexToOklch(cardHex);
      root.style.setProperty("--card", cardOklch);
      root.style.setProperty("--card-foreground", "oklch(0.95 0.01 240)");
      root.style.setProperty("--popover", cardOklch);
      root.style.setProperty("--sidebar", cardOklch);
    }

    // Border radius
    const radius = settings.borderRadius as string | undefined;
    if (radius) {
      root.style.setProperty("--radius", radius);
    }

    // Fonte customizada
    const fontFamily = settings.fontFamily as string | undefined;
    if (fontFamily) {
      document.body.style.fontFamily = fontFamily;

      // Carrega a fonte do Google Fonts se não for uma fonte do sistema
      const fontName = fontFamily.replace(/['"]/g, "").split(",")[0].trim();
      const systemFonts = ["Inter", "Roboto", "sans-serif", "serif", "monospace"];
      if (!systemFonts.includes(fontName)) {
        const linkId = "dynamic-google-font";
        let link = document.getElementById(linkId) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.id = linkId;
          link.rel = "stylesheet";
          document.head.appendChild(link);
        }
        const encoded = encodeURIComponent(fontName);
        link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
      }
    }

    // Favicon dinâmico
    const faviconUrl = settings.faviconUrl as string | undefined;
    if (faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }

    // Título da aba
    const storeName = settings.storeName as string | undefined;
    if (storeName) {
      document.title = storeName;
    }
  }, [settings]);
}
