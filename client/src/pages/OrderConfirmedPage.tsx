import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import ShopLayout from "@/components/ShopLayout";
import { CheckCircle2, Clock, MessageSquare, Package, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function OrderConfirmedPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderNumber = params.get("orderNumber") ?? "";

  const [copiedPix, setCopiedPix] = useState(false);

  const { data: customization } = trpc.shop.getStoreCustomization.useQuery();
  const { data: settings } = trpc.shop.getSettings.useQuery();

  const discordTicketsUrl = settings?.discordTicketsUrl ?? "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
    toast.success("Chave PIX copiada!");
  };

  return (
    <ShopLayout>
      <div className="container py-20">
        <div className="max-w-lg mx-auto text-center">
          {/* Success icon */}
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-primary/20">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>

          <h1
            className="text-3xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Pedido Recebido!
          </h1>

          {orderNumber && (
            <p className="text-muted-foreground mb-2 font-mono text-sm">
              Pedido <span className="text-foreground font-bold">{orderNumber}</span>
            </p>
          )}

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Seu pedido foi registrado. Agora siga os passos abaixo para concluir o pagamento e receber seus itens.
          </p>

          {/* PIX Key */}
          {customization?.pixKey && (
            <div className="p-5 rounded-xl bg-blue-500/10 border border-blue-500/30 mb-4 text-left">
              <p className="text-sm font-semibold text-blue-400 mb-1">💳 Chave PIX para Pagamento</p>
              <p className="text-xs text-muted-foreground mb-3">
                Copie a chave abaixo e realize o pagamento pelo valor do pedido.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-foreground font-mono font-bold text-base break-all bg-muted px-3 py-2 rounded-lg">
                  {customization.pixKey}
                </code>
                <button
                  onClick={() => copyToClipboard(customization.pixKey!)}
                  className="p-2.5 hover:bg-blue-500/20 rounded-lg transition-colors shrink-0 border border-blue-500/30"
                  title="Copiar chave PIX"
                >
                  {copiedPix ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-blue-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Discord Tickets */}
          <div className="p-5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 mb-8 text-left">
            <p className="text-sm font-semibold text-indigo-400 mb-1">🎫 Abra um Ticket no Discord</p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Após realizar o pagamento, vá até o nosso Discord e abra um ticket na aba{" "}
              <span className="text-foreground font-semibold">#tickets</span>. Envie o{" "}
              <span className="text-foreground font-semibold">comprovante do pagamento</span> e o{" "}
              <span className="text-foreground font-semibold">número do pedido ({orderNumber || "seu pedido"})</span>.
              Um administrador irá verificar e entregar seus itens no jogo.
            </p>
            {discordTicketsUrl ? (
              <a href={discordTicketsUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                  <MessageSquare className="h-4 w-4" />
                  Ir para o Canal de Tickets
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </a>
            ) : (
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-lg">
                Link do Discord não configurado — peça ao admin para configurar em Personalização.
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-3 text-left mb-10">
            <h2
              className="text-lg font-semibold text-foreground mb-4 text-center"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Resumo dos Passos
            </h2>
            {[
              {
                icon: Clock,
                step: "1",
                title: "Faça o Pagamento via PIX",
                desc: "Copie a chave PIX acima e realize o pagamento pelo valor exato do pedido.",
              },
              {
                icon: MessageSquare,
                step: "2",
                title: "Abra um Ticket no Discord",
                desc: "Acesse o Discord, vá na aba de tickets e envie o comprovante + número do pedido.",
              },
              {
                icon: Package,
                step: "3",
                title: "Receba seus Itens no Jogo",
                desc: "Após confirmação do pagamento, um admin entregará seus itens diretamente no jogo.",
              },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div
                key={step}
                className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                  {step}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/loja">
              <Button size="lg" className="w-full sm:w-auto">
                Continuar Comprando
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Voltar para Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
