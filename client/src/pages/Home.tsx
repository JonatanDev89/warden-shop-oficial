import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ShopLayout from "@/components/ShopLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Package,
  Shield,
  MessageCircle,
  Trophy,
  Sword,
  Zap,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import CategoryCard from "@/components/CategoryCard";

export default function Home() {
  const { data: settings } = trpc.shop.getSettings.useQuery();
  const { data: categories, isLoading: loadingCats } = trpc.shop.getCategories.useQuery();
  const { data: topBuyers } = trpc.shop.getTopBuyers.useQuery();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const s = settings as Record<string, string> | undefined;
  const heroTitle = s?.heroTitle ?? "A Loja Oficial do Warden Craft";
  const heroSubtitle =
    s?.heroSubtitle ??
    "Adquira kits, ranks e itens exclusivos para o servidor. Entrega automática direto no seu jogo!";
  const heroBgUrl = s?.heroBgUrl ?? "";
  const wardenGifUrl = s?.wardenGifUrl ?? "https://d2xsxph8kpxj0f.cloudfront.net/310519663566472418/WbWtksiE3ubnfkNsEuG3YS/minecraft-warden_7265c060.gif";

  // Feature flags
  const flag = (key: string) => (s?.[key] ?? "true") !== "false";
  const featureTopBuyers   = flag("featureTopBuyers");
  const featureFaq         = flag("featureFaq");
  const featureHighlights  = flag("featureHighlights");

  return (
    <ShopLayout>
      {/* ── Hero ── */}
      <section
        className="relative min-h-[520px] flex items-center overflow-hidden"
        style={
          heroBgUrl
            ? {
                backgroundImage: `url(${heroBgUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}
        }
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: heroBgUrl
              ? "linear-gradient(135deg, rgba(10,14,20,0.92) 0%, rgba(10,14,20,0.7) 100%)"
              : "linear-gradient(135deg, oklch(0.10 0.02 240) 0%, oklch(0.14 0.04 200) 50%, oklch(0.10 0.03 145) 100%)",
          }}
        />
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.65 0.22 145) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.22 145) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="container relative z-10 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <Badge
              variant="outline"
              className="mb-4 border-primary/50 text-primary bg-primary/10 text-xs tracking-widest uppercase"
            >
              ⚔️ Servidor Minecraft Bedrock
            </Badge>
            <h1
              className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {heroTitle}
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{heroSubtitle}</p>

            {/* Mobile: warden à direita + botões empilhados */}
            <div className="lg:hidden flex items-center gap-4 mb-6">
              <div className="flex flex-col gap-3 flex-1">
                <Link href="/loja">
                  <Button size="lg" className="gap-2 font-semibold w-full" style={{ boxShadow: "0 0 20px oklch(0.65 0.22 200 / 0.4)" }}>
                    <Sword className="h-5 w-5" />
                    Ver Produtos
                  </Button>
                </Link>
                {isAdmin && (
                  <Link href="/api-docs">
                    <Button size="lg" variant="outline" className="gap-2 border-border/60 w-full">
                      <Zap className="h-5 w-5" />
                      API Docs
                    </Button>
                  </Link>
                )}
              </div>
              <img
                src={wardenGifUrl}
                alt="Warden Minecraft"
                className="w-32 h-32 object-contain drop-shadow-2xl shrink-0"
              />
            </div>

            {/* Desktop: botões lado a lado */}
            <div className="hidden lg:flex flex-wrap gap-3">
              <Link href="/loja">
                <Button size="lg" className="gap-2 font-semibold" style={{ boxShadow: "0 0 20px oklch(0.65 0.22 200 / 0.4)" }}>
                  <Sword className="h-5 w-5" />
                  Ver Produtos
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/api-docs">
                  <Button size="lg" variant="outline" className="gap-2 border-border/60">
                    <Zap className="h-5 w-5" />
                    API Docs
                  </Button>
                </Link>
              )}
            </div>
            </div>
            {/* Warden GIF desktop */}
            <div className="hidden lg:flex items-center justify-center">
              <img
                src={wardenGifUrl}
                alt="Warden Minecraft"
                className="w-full max-w-sm drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary text-xs uppercase tracking-wider">
              Nossa Loja
            </Badge>
            <h2
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Categorias
            </h2>
            <p className="text-muted-foreground mt-2">
              Escolha a categoria e encontre o item ideal para o seu personagem
            </p>
          </div>

          {loadingCats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 rounded-3xl bg-card/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {categories?.map((cat) => {
                const categoryImages = [
                  "https://cdn.discordapp.com/attachments/1483220774897717351/1494775922723655781/image.png",
                  "https://cdn.discordapp.com/attachments/1483220774897717351/1494790103640445111/image_2.png",
                  "https://cdn.discordapp.com/attachments/1483220774897717351/1494786968272506930/image_1.png",
                ];
                const fallbackImg = categoryImages[cat.id % categoryImages.length];
                return (
                  <CategoryCard
                    key={cat.id}
                    id={cat.id}
                    title={cat.name}
                    description={cat.description ?? "Veja os itens disponíveis desta categoria."}
                    image={cat.imageUrl || fallbackImg}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      {featureHighlights && (
      <section className="py-12 border-b border-border">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Package,
                title: "Entrega Automática",
                desc: "Use !resgatar no servidor e receba seus itens instantaneamente no inventário.",
              },
              {
                icon: Shield,
                title: "Compra Segura",
                desc: "Pagamento via PIX processado pelo Mercado Pago. Rápido e seguro.",
              },
              {
                icon: MessageCircle,
                title: "Suporte Discord",
                desc: "Equipe disponível no Discord para qualquer dúvida ou problema.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-4 p-5 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Top Buyers ── */}
      {featureTopBuyers && topBuyers && topBuyers.length > 0 && (
        <section className="py-16 bg-card/50 border-y border-border">
          <div className="container">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 border-primary/30 text-primary text-xs uppercase tracking-wider">
                Comunidade
              </Badge>
              <h2
                className="text-3xl font-bold text-foreground mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Top Compradores
              </h2>
              <p className="text-muted-foreground text-sm">
                Nossos campeões de compras estão aqui — confira o ranking mensal
              </p>
            </div>

            {/* Podium — order: 2nd, 1st, 3rd */}
            <div className="flex items-end justify-center gap-4 max-w-2xl mx-auto">
              {([1, 0, 2] as const).map((idx) => {
                const buyer = topBuyers[idx];
                if (!buyer) return null;
                const rank = idx + 1;
                const isFirst = idx === 0;

                // Medal colors
                const medal =
                  rank === 1
                    ? { border: "border-yellow-500/70", avatarBg: "bg-yellow-900/30 border-yellow-500", badge: "bg-yellow-400 text-yellow-900", value: "text-yellow-400", star: "text-yellow-400", crown: "bg-yellow-500" }
                    : rank === 2
                    ? { border: "border-slate-400/50", avatarBg: "bg-slate-700/30 border-slate-400", badge: "bg-slate-400 text-slate-900", value: "text-slate-300", star: "text-slate-400", crown: "" }
                    : { border: "border-amber-700/50", avatarBg: "bg-amber-900/20 border-amber-700", badge: "bg-amber-700 text-amber-100", value: "text-amber-600", star: "text-amber-700", crown: "" };

                const stars = rank === 1 ? 3 : rank === 2 ? 2 : 1;

                return (
                  <div
                    key={buyer.nickname}
                    className={`relative flex flex-col items-center bg-card border ${medal.border} rounded-2xl px-5 py-6 transition-all ${
                      isFirst ? "w-52 shadow-lg shadow-yellow-500/10" : "w-44 mb-4"
                    }`}
                  >
                    {/* Crown for 1st */}
                    {isFirst && (
                      <div className={`absolute -top-5 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full ${medal.crown} flex items-center justify-center shadow-lg`}>
                        <Trophy className="h-5 w-5 text-yellow-900" />
                      </div>
                    )}

                    {/* Avatar */}
                    <div className={`relative h-16 w-16 rounded-full border-2 ${medal.avatarBg} flex items-center justify-center mb-3 ${isFirst ? "mt-4" : ""}`}>
                      <svg viewBox="0 0 24 24" className="h-8 w-8 text-orange-400" fill="currentColor">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                      </svg>
                      <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${medal.badge}`}>
                        {rank}
                      </span>
                    </div>

                    {/* Name */}
                    <p
                      className={`font-bold text-foreground text-center truncate w-full ${isFirst ? "text-base" : "text-sm"}`}
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {buyer.nickname}
                    </p>

                    {/* Value */}
                    <div className={`flex items-center gap-1 mt-1 ${medal.value} text-sm font-semibold`}>
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="5" width="20" height="14" rx="2"/>
                        <path d="M2 10h20"/>
                      </svg>
                      R$ {parseFloat(String(buyer.total)).toFixed(2).replace(".", ",")}
                    </div>

                    {/* Stars */}
                    <div className={`flex gap-0.5 mt-3 ${medal.star}`}>
                      {Array.from({ length: stars }).map((_, i) => (
                        <svg key={i} viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      {featureFaq && (
      <section className="py-16">
        <div className="container max-w-2xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary text-xs uppercase tracking-wider">
              FAQ
            </Badge>
            <h2
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Perguntas Frequentes
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {[
              {
                q: "Como recebo meu item?",
                a: "Após o pagamento via PIX ser confirmado, seu pedido entra na fila de entrega automática. Quando você entrar no servidor, use o comando !resgatar no chat para receber seus itens diretamente no inventário.",
              },
              {
                q: "Quanto tempo leva a entrega?",
                a: "A entrega é automática e instantânea assim que você usar !resgatar no servidor. O pedido fica disponível por tempo indeterminado — você pode resgatar quando quiser após a confirmação do pagamento.",
              },
              {
                q: "Como uso o comando de resgate?",
                a: "Entre no servidor Warden Craft e digite !resgatar no chat. O addon irá verificar seus pedidos pendentes e entregar os itens automaticamente no seu inventário.",
              },
              {
                q: "Posso usar cupom de desconto?",
                a: "Sim! Durante o checkout você pode inserir um código de cupom válido para obter desconto no seu pedido.",
              },
              {
                q: "E se eu não receber meu item após usar !resgatar?",
                a: "Verifique se seu inventário tem espaço disponível. Se o problema persistir, entre em contato com nossa equipe pelo Discord com o número do seu pedido.",
              },
              {
                q: "O pagamento é seguro?",
                a: "Sim! O pagamento é processado via PIX pelo Mercado Pago, uma das plataformas de pagamento mais seguras do Brasil. Não armazenamos dados bancários.",
              },
            ].map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-border rounded-lg bg-card px-4"
              >
                <AccordionTrigger className="text-foreground font-medium hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      )}
    </ShopLayout>
  );
}
