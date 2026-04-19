import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import ShopLayout from "@/components/ShopLayout";
import { CheckCircle2, Clock, Terminal, Package, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function OrderConfirmedPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderNumber = params.get("orderNumber") ?? "";

  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Buscar dados da loja
  const { data: customization } = trpc.shop.getStoreCustomization.useQuery();

  const redemptionCommand = `!resgatar`;

  const copyToClipboard = (text: string, type: "pix" | "command") => {
    navigator.clipboard.writeText(text);
    if (type === "pix") {
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } else {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
    toast.success("Copiado para a área de transferência!");
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

          <p className="text-muted-foreground mb-10 leading-relaxed">
            Seu pedido foi registrado com sucesso. Abaixo estão as informações para pagamento e resgate dos itens.
          </p>

          {/* Payment and Redemption Section */}
          <div className="space-y-4 mb-10">
            {/* PIX Key */}
            {customization?.pixKey && (
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-muted-foreground mb-3 font-semibold">💳 Chave PIX para Pagamento:</p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="text-foreground font-mono font-bold text-lg break-all">
                    {customization.pixKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(customization.pixKey!, "pix")}
                    className="p-2 hover:bg-blue-500/20 rounded transition-colors shrink-0"
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

            {/* Redemption Command */}
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <p className="text-sm text-muted-foreground mb-3 font-semibold">🎮 Comando de Resgate no Jogo:</p>
              <div className="flex items-center gap-2 justify-center">
                <code className="text-foreground font-mono font-bold text-lg break-all">
                  {redemptionCommand}
                </code>
                <button
                  onClick={() => copyToClipboard(redemptionCommand, "command")}
                  className="p-2 hover:bg-purple-500/20 rounded transition-colors shrink-0"
                  title="Copiar comando"
                >
                  {copiedCommand ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-purple-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4 text-left mb-10">
            <h2
              className="text-lg font-semibold text-foreground mb-4 text-center"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Como Proceder
            </h2>
            {[
              {
                icon: Clock,
                step: "1",
                title: "Faça o Pagamento",
                desc: "Escaneie o QR Code ou copie a chave PIX acima e realize o pagamento",
              },
              {
                icon: Terminal,
                step: "2",
                title: "Copie o Comando",
                desc: "Copie o comando de resgate acima (clique no botão de copiar)",
              },
              {
                icon: Package,
                step: "3",
                title: "Execute no Jogo",
                desc: "Entre no jogo, abra o chat e cole o comando para receber seus itens",
              },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div
                key={step}
                className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                  {step}
                </div>
                <div>
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <Icon className="h-5 w-5 text-muted-foreground ml-auto shrink-0 mt-0.5" />
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
