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
  ChevronRight,
  Zap,
} from "lucide-react";
import CategoryCard from "@/components/CategoryCard";
import MonthlyGoal from "@/components/MonthlyGoal";

export default function Home() {
  const { data: settings } = trpc.shop.getSettings.useQuery();
  const { data: categories, isLoading: loadingCats } = trpc.shop.getCategories.useQuery();
  const { data: topBuyers } = trpc.shop.getTopBuyers.useQuery();

  const heroTitle = settings?.heroTitle ?? "A Loja Oficial do Warden Craft";
  const heroSubtitle =
    settings?.heroSubtitle ??
    "Adquira kits, ranks e itens exclusivos para o servidor. Entrega automática direto no seu jogo!";
  const heroBgUrl = settings?.heroBgUrl ?? "";
  const wardenGifUrl = settings?.wardenGifUrl ?? "https://d2xsxph8kpxj0f.cloudfront.net/310519663566472418/WbWtksiE3ubnfkNsEuG3YS/minecraft-warden_7265c060.gif";

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
                <Link href="/api-docs">
                  <Button size="lg" variant="outline" className="gap-2 border-border/60 w-full">
                    <Zap className="h-5 w-5" />
                    API Docs
                  </Button>
                </Link>
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
              <Link href="/api-docs">
                <Button size="lg" variant="outline" className="gap-2 border-border/60">
                  <Zap className="h-5 w-5" />
                  API Docs
                </Button>
              </Link>
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

      {/* ── Monthly Goal ── */}
      <MonthlyGoal current={60} goal={100} />

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
      <section className="py-12 border-b border-border">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Package,
                title: "Entrega no Jogo",
                desc: "Itens entregues diretamente no seu personagem via addon.",
              },
              {
                icon: Shield,
                title: "Compra Segura",
                desc: "Seus dados são protegidos e o pedido é confirmado pelo admin.",
              },
              {
                icon: MessageCircle,
                title: "Suporte Discord",
                desc: "Equipe disponível no Discord para qualquer dúvida.",
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

      {/* ── Top Buyers ── */}
      {topBuyers && topBuyers.length > 0 && (
        <section className="py-16 bg-card/50 border-y border-border">
          <div className="container">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-3 border-primary/30 text-primary text-xs uppercase tracking-wider">
                Comunidade
              </Badge>
              <h2
                className="text-3xl font-bold text-foreground"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Top Compradores
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-4 max-w-2xl mx-auto">
              {topBuyers.map((buyer, idx) => (
                <div
                  key={buyer.nickname}
                  className="flex items-center gap-3 bg-card border border-border rounded-lg px-5 py-3 min-w-[200px]"
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx === 0
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                        : idx === 1
                        ? "bg-slate-400/20 text-slate-300 border border-slate-400/40"
                        : "bg-amber-700/20 text-amber-600 border border-amber-700/40"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{buyer.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {buyer.total.toFixed(2)}
                    </p>
                  </div>
                  <Trophy
                    className={`h-4 w-4 ml-auto ${
                      idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : "text-amber-600"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
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
                a: "Após a confirmação do pedido pelo administrador, os comandos são executados no servidor e os itens são entregues diretamente no seu personagem.",
              },
              {
                q: "Quanto tempo leva a entrega?",
                a: "A entrega é realizada manualmente pelo administrador. Normalmente ocorre em até 24 horas após a confirmação do pedido.",
              },
              {
                q: "Posso usar cupom de desconto?",
                a: "Sim! Durante o checkout você pode inserir um código de cupom válido para obter desconto no seu pedido.",
              },
              {
                q: "E se eu não receber meu item?",
                a: "Entre em contato com nossa equipe pelo Discord. Guardaremos o registro do seu pedido e resolveremos o problema rapidamente.",
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
    </ShopLayout>
  );
}
