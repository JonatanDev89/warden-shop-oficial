import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import ShopLayout from "@/components/ShopLayout";
import {
  CheckCircle2,
  Clock,
  Package,
  MessageSquare,
  ExternalLink,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/contexts/CartContext";

// ─── Polling config ────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 4_000;   // verifica a cada 4s
const POLL_MAX_ATTEMPTS = 30;     // para de fazer polling após ~2 min
const POLL_STOP_STATUSES = new Set(["approved", "rejected", "cancelled", "refunded", "charged_back"]);

export default function OrderConfirmedPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderNumber = params.get("orderNumber") ?? "";
  const paymentHint = params.get("payment") ?? ""; // success | failure | pending (hint do redirect MP)

  const [pollCount, setPollCount] = useState(0);
  const [shouldPoll, setShouldPoll] = useState(true);
  const pollRef = useRef(0);
  const { clearCart } = useCart();

  // Limpa o carrinho quando chega na página de confirmação
  useEffect(() => {
    if (orderNumber) {
      clearCart();
      localStorage.removeItem("warden_cart");
    }
  }, [orderNumber]);

  // Endpoint dedicado de status — não expõe dados internos desnecessários
  const { data: orderStatus, isLoading, refetch } = trpc.shop.getOrderStatus.useQuery(
    { orderNumber },
    {
      enabled: !!orderNumber,
      refetchOnWindowFocus: false,
      // Polling controlado manualmente abaixo
      refetchInterval: false,
    }
  );

  const { data: settings } = trpc.shop.getSettings.useQuery();
  const discordTicketsUrl = settings?.discordTicketsUrl ?? "";

  // Polling manual com controle de tentativas e parada automática
  useEffect(() => {
    if (!orderNumber || !shouldPoll) return;

    const paymentStatus = orderStatus?.paymentStatus ?? "pending";

    // Para o polling se chegou em status final
    if (POLL_STOP_STATUSES.has(paymentStatus)) {
      setShouldPoll(false);
      return;
    }

    // Para o polling após max tentativas
    if (pollCount >= POLL_MAX_ATTEMPTS) {
      setShouldPoll(false);
      return;
    }

    const timer = setTimeout(() => {
      pollRef.current++;
      setPollCount(pollRef.current);
      refetch();
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [orderNumber, orderStatus, pollCount, shouldPoll, refetch]);

  const paymentStatus = orderStatus?.paymentStatus ?? "pending";
  const isPaid = paymentStatus === "approved";
  const isFailed = paymentStatus === "rejected" || paymentStatus === "cancelled"
    || paymentStatus === "refunded" || paymentStatus === "charged_back";
  const isPending = !isPaid && !isFailed;
  const isPolling = isPending && shouldPoll;

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="container py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Verificando status do pedido...</p>
        </div>
      </ShopLayout>
    );
  }

  if (!orderNumber || !orderStatus) {
    return (
      <ShopLayout>
        <div className="container py-20 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-foreground font-semibold mb-2">Pedido não encontrado</p>
          <p className="text-muted-foreground text-sm mb-6">
            Verifique o número do pedido ou entre em contato pelo Discord.
          </p>
          <Link href="/loja">
            <Button>Voltar à Loja</Button>
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="container py-20">
        <div className="max-w-lg mx-auto text-center">

          {/* Ícone de status */}
          {isPaid ? (
            <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-green-500/20">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
          ) : isFailed ? (
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-destructive/20">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-yellow-500/20">
              {isPolling ? (
                <Loader2 className="h-10 w-10 text-yellow-400 animate-spin" />
              ) : (
                <Clock className="h-10 w-10 text-yellow-400" />
              )}
            </div>
          )}

          {/* Título */}
          <h1
            className="text-3xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {isPaid
              ? "Pagamento Confirmado!"
              : isFailed
              ? "Pagamento não aprovado"
              : "Aguardando Pagamento"}
          </h1>

          <p className="text-muted-foreground mb-2 font-mono text-sm">
            Pedido <span className="text-foreground font-bold">{orderNumber}</span>
          </p>

          <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
            {isPaid
              ? "Seu pagamento foi aprovado. Seus itens serão entregues no jogo em breve."
              : isFailed
              ? "O pagamento não foi aprovado. Tente novamente ou entre em contato pelo Discord."
              : isPolling
              ? "Verificando o status do pagamento automaticamente..."
              : "Não foi possível confirmar o pagamento automaticamente. Verifique abaixo ou entre em contato."}
          </p>

          {/* Badge de status */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 ${
              isPaid
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : isFailed
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
            }`}
          >
            {isPaid ? (
              <><ShieldCheck className="h-4 w-4" /> Pago e confirmado</>
            ) : isFailed ? (
              <><XCircle className="h-4 w-4" /> Pagamento recusado</>
            ) : isPolling ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Verificando pagamento...</>
            ) : (
              <><Clock className="h-4 w-4" /> Aguardando confirmação</>
            )}
          </div>

          {/* Botão de verificar manualmente (quando polling parou) */}
          {isPending && !isPolling && (
            <div className="mb-8">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setShouldPoll(true);
                  setPollCount(0);
                  pollRef.current = 0;
                  refetch();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Verificar novamente
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Se você já pagou, aguarde alguns minutos e clique em verificar.
              </p>
            </div>
          )}

          {/* Passos */}
          {!isFailed && (
            <div className="space-y-3 text-left mb-10">
              <h2
                className="text-lg font-semibold text-foreground mb-4 text-center"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {isPaid ? "O que acontece agora?" : "Próximos passos"}
              </h2>

              {[
                isPaid
                  ? {
                      icon: CheckCircle2,
                      step: "1",
                      title: "Pagamento aprovado",
                      desc: "O Mercado Pago confirmou seu pagamento com sucesso.",
                      done: true,
                    }
                  : {
                      icon: Clock,
                      step: "1",
                      title: "Aguardando confirmação",
                      desc: "O Mercado Pago está processando. Pode levar alguns minutos.",
                      done: false,
                    },
                {
                  icon: Package,
                  step: "2",
                  title: "Entrega no jogo",
                  desc: "Após confirmação do pagamento, seus itens serão entregues no jogo.",
                  done: false,
                },
                {
                  icon: MessageSquare,
                  step: "3",
                  title: "Suporte via Discord",
                  desc: "Dúvidas? Abra um ticket com o número do pedido.",
                  done: false,
                },
              ].map(({ icon: Icon, step, title, desc, done }) => (
                <div
                  key={step}
                  className={`flex items-start gap-4 p-4 rounded-lg border ${
                    done ? "bg-green-500/5 border-green-500/20" : "bg-card border-border"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                      done ? "bg-green-500/20 text-green-400" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {done ? "✓" : step}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          )}

          {/* Discord */}
          {discordTicketsUrl && (
            <div className="p-5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 mb-8 text-left">
              <p className="text-sm font-semibold text-indigo-400 mb-1">🎫 Suporte via Discord</p>
              <p className="text-sm text-muted-foreground mb-4">
                Precisa de ajuda? Abra um ticket com o número{" "}
                <span className="text-foreground font-semibold font-mono">{orderNumber}</span>.
              </p>
              <a href={discordTicketsUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                  <MessageSquare className="h-4 w-4" />
                  Ir para o Canal de Tickets
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </a>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/loja">
              <Button size="lg" className="w-full sm:w-auto">
                {isFailed ? "Voltar à Loja" : "Continuar Comprando"}
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
