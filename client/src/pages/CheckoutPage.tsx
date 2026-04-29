import { trpc } from "@/lib/trpc";
import { Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ShopLayout from "@/components/ShopLayout";
import {
  ChevronRight, Loader2, ShieldCheck, Copy, Check,
  Zap, RefreshCw, Clock, ShoppingCart, Lock, Minus, Plus, X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";

// ─── Ícone PIX ────────────────────────────────────────────────────────────────
function PixIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor">
      <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H118.4C138.4 391.2 157.3 383.4 171.5 369.2L242.4 292.5zM262.5 219.5C257.1 224.9 247.8 224.9 242.4 219.5L171.5 142.5C157.3 128.3 138.4 120.5 118.4 120.5H103.3L200.7 23.4C231 -6.1 280.2 -6.1 310.5 23.4L407.6 120.5H392.5C372.5 120.5 353.6 128.3 339.4 142.5L262.5 219.5zM112 144.6C128 144.6 143.3 151.1 154.5 162.4L231.5 239.4C243.1 251 260.8 251 272.4 239.4L349.4 162.4C360.7 151.1 376 144.6 392 144.6H426.6L488.6 206.6C518.1 236.9 518.1 286.1 488.6 316.4L426.6 378.4H392C376 378.4 360.7 371.9 349.4 360.6L272.4 283.6C266.6 277.8 258.9 274.9 251.2 274.9C243.5 274.9 235.8 277.8 230 283.6L153 360.6C141.7 371.9 126.4 378.4 110.4 378.4H76.6L14.6 316.4C-14.9 286.1 -14.9 236.9 14.6 206.6L76.6 144.6H112z"/>
    </svg>
  );
}

// ─── PIX Panel ────────────────────────────────────────────────────────────────
function PixPanel({ qrCode, qrCodeBase64, expiresAt, orderNumber, total, onConfirmed }: {
  qrCode: string; qrCodeBase64: string; expiresAt: string;
  orderNumber: string; total: number; onConfirmed: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [checking, setChecking] = useState(false);
  const utils = trpc.useUtils();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expirado"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const status = await utils.shop.getOrderStatus.fetch({ orderNumber });
        if (status.paymentStatus === "approved" || status.status === "game_pending" || status.status === "delivered") {
          clearInterval(intervalRef.current!);
          onConfirmed();
        }
      } catch {}
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [orderNumber]);

  const handleCopy = () => {
    navigator.clipboard.writeText(qrCode).then(() => {
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleCheckManual = async () => {
    setChecking(true);
    try {
      const status = await utils.shop.getOrderStatus.fetch({ orderNumber });
      if (status.paymentStatus === "approved" || status.status === "game_pending" || status.status === "delivered") {
        onConfirmed();
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns segundos.");
      }
    } catch { toast.error("Erro ao verificar pagamento."); }
    finally { setChecking(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Zap className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">PIX gerado!</p>
            <p className="text-xs text-muted-foreground">Escaneie ou copie o código</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          <Clock className="h-3 w-3" /><span>{timeLeft}</span>
        </div>
      </div>

      {qrCodeBase64 && (
        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-xl">
            <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code PIX" className="w-48 h-48" />
          </div>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-muted-foreground">Valor a pagar</p>
        <p className="text-2xl font-bold text-primary">R$ {total.toFixed(2).replace(".", ",")}</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
          {qrCode.slice(0, 40)}...
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
      </div>

      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside bg-muted/50 rounded-lg p-3 border border-border">
        <li>Abra o app do seu banco</li>
        <li>Escolha pagar via PIX</li>
        <li>Escaneie o QR code ou cole o código acima</li>
        <li>Confirme o pagamento de <strong className="text-foreground">R$ {total.toFixed(2).replace(".", ",")}</strong></li>
      </ol>

      <Button type="button" variant="outline" className="w-full gap-2" onClick={handleCheckManual} disabled={checking}>
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {checking ? "Verificando..." : "Já paguei — verificar"}
      </Button>
    </div>
  );
}

// ─── Checkout ─────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const productId = parseInt(params.get("productId") ?? "0");
  const [, navigate] = useLocation();
  const { items: cartItems, clearCart, updateQty, removeItem, addItem } = useCart();

  const { data: settings } = trpc.shop.getSettings.useQuery();
  const s = settings as Record<string, string> | undefined;
  const featureCoupons = (s?.featureCoupons ?? "true") !== "false";

  const { data: singleProduct } = trpc.shop.getProduct.useQuery({ id: productId }, { enabled: productId > 0 });
  useEffect(() => {
    if (!singleProduct) return;
    if (!cartItems.find(i => i.productId === singleProduct.id)) {
      addItem({ productId: singleProduct.id, name: singleProduct.name, price: parseFloat(String(singleProduct.price)), imageUrl: singleProduct.imageUrl ?? undefined });
    }
  }, [singleProduct]);

  const items = cartItems;

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountType: string; discountValue: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [agreed, setAgreed] = useState(false);

  type Step = "form" | "generating" | "pix" | "confirmed";
  const [step, setStep] = useState<Step>("form");
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string; expiresAt: string; orderNumber: string } | null>(null);

  const utils = trpc.useUtils();
  const createOrder = trpc.shop.createOrder.useMutation({ onError: (err) => { toast.error(err.message ?? "Erro ao criar pedido."); setStep("form"); } });
  const createPix = trpc.shop.createPixPayment.useMutation({ onError: (err) => { toast.error(err.message ?? "Erro ao gerar PIX."); setStep("form"); } });

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = !appliedCoupon ? 0 :
    appliedCoupon.discountType === "percent"
      ? subtotal * (parseFloat(appliedCoupon.discountValue) / 100)
      : Math.min(parseFloat(appliedCoupon.discountValue), subtotal);
  const total = Math.max(0, subtotal - discount);
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!couponInput.trim()) return;
    try {
      const result = await utils.shop.validateCoupon.fetch({ code: couponInput.trim() });
      setAppliedCoupon({ code: result.code, discountType: result.discountType, discountValue: String(result.discountValue) });
      toast.success(`Cupom "${result.code}" aplicado!`);
    } catch { setCouponError("Cupom inválido ou expirado."); setAppliedCoupon(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return toast.error("Informe seu nickname no Minecraft.");
    if (!email.trim()) return toast.error("Informe seu e-mail.");
    if (!agreed) return toast.error("Você precisa concordar com os termos.");
    if (items.length === 0) return toast.error("Seu carrinho está vazio.");
    setStep("generating");
    const order = await createOrder.mutateAsync({
      minecraftNickname: nickname.trim(), email: email.trim(),
      couponCode: appliedCoupon?.code,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    });
    if (!order?.orderNumber) { setStep("form"); return; }
    const pix = await createPix.mutateAsync({ orderNumber: order.orderNumber, payerEmail: email.trim(), payerName: nickname.trim() });
    setPixData({ ...pix, orderNumber: order.orderNumber });
    setStep("pix");
  };

  const handlePixConfirmed = () => {
    setStep("confirmed");
    clearCart();
    setTimeout(() => navigate(`/pedido-confirmado?orderNumber=${encodeURIComponent(pixData!.orderNumber)}&payment=success`), 1500);
  };

  const isGenerating = step === "generating" || createOrder.isPending || createPix.isPending;

  if (items.length === 0 && step === "form") {
    return (
      <ShopLayout>
        <div className="container py-20 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Seu carrinho está vazio.</p>
          <Link href="/loja"><Button>Ver Produtos</Button></Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="container py-8 max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/" className="hover:text-primary transition-colors">Início</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Checkout</span>
        </nav>
        <h1 className="text-2xl font-bold text-foreground mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Checkout
        </h1>

        {/* ── PIX / Confirmado ── */}
        {(step === "pix" || step === "confirmed") && (
          <div className="max-w-md mx-auto">
            {step === "confirmed" ? (
              <div className="rounded-2xl bg-card border border-green-500/30 p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-green-400" />
                </div>
                <p className="text-lg font-bold text-foreground">Pagamento confirmado!</p>
                <p className="text-sm text-muted-foreground">Redirecionando...</p>
                <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
              </div>
            ) : pixData ? (
              <div className="rounded-2xl bg-card border border-border p-6">
                <PixPanel qrCode={pixData.qrCode} qrCodeBase64={pixData.qrCodeBase64}
                  expiresAt={pixData.expiresAt} orderNumber={pixData.orderNumber}
                  total={total} onConfirmed={handlePixConfirmed} />
              </div>
            ) : null}
          </div>
        )}

        {/* ── Formulário ── */}
        {(step === "form" || step === "generating") && (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

              {/* ── Coluna esquerda ── */}
              <div className="space-y-4">
                {/* Formas de pagamento */}
                <div className="rounded-2xl bg-card border border-border p-5">
                  <h2 className="font-semibold text-foreground mb-4">Formas de pagamento</h2>
                  {/* PIX — único método */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-primary bg-primary/5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <PixIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">Pix</span>
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                          <Zap className="h-2.5 w-2.5" /> Mais rápido
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Aprovação imediata</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  </div>
                </div>

                {/* Informações de contato */}
                <div className="rounded-2xl bg-card border border-border p-5">
                  <h2 className="font-semibold text-foreground mb-4">Informações de contato</h2>
                  <div className="space-y-3">
                    <Input
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Email" type="email" required disabled={isGenerating}
                      className="bg-muted/50 border-border rounded-xl h-11"
                      autoComplete="email"
                    />
                    <Input
                      value={nickname} onChange={e => setNickname(e.target.value)}
                      placeholder="Nickname (Minecraft)" required disabled={isGenerating}
                      className="bg-muted/50 border-border rounded-xl h-11"
                      autoComplete="username"
                    />
                    {/* Alerta de atenção ao nickname */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                      <span className="text-yellow-400 text-base shrink-0">⚠️</span>
                      <p className="text-xs text-yellow-300 leading-relaxed">
                        <strong>Atenção:</strong> Digite o nickname <strong>exatamente</strong> como aparece no jogo, incluindo letras maiúsculas e minúsculas. Um nick errado impedirá a entrega dos itens.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Termos + botão pagar */}
                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary" disabled={isGenerating} />
                    <span className="text-sm text-muted-foreground">
                      Eu aceito os{" "}
                      <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-foreground font-semibold hover:underline">termos e condições</a>
                      {" "}desta compra.
                    </span>
                  </label>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 text-lg font-bold rounded-xl gap-2"
                    disabled={isGenerating || !agreed}
                  >
                    {isGenerating ? (
                      <><Loader2 className="h-5 w-5 animate-spin" />{createOrder.isPending ? "Criando pedido..." : "Gerando PIX..."}</>
                    ) : (
                      <>Pagar {fmt(total)}</>
                    )}
                  </Button>
                </div>
              </div>

              {/* ── Coluna direita — Resumo ── */}
              <div className="rounded-2xl bg-card border border-border p-5 space-y-4 lg:sticky lg:top-24">
                {/* Header resumo */}
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Resumo do pedido</h2>
                  <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                    <Lock className="h-3 w-3" /> Pagamento seguro
                  </div>
                </div>

                {/* Itens com controles de quantidade */}
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          : <span className="text-lg">📦</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{fmt(item.price)}</p>
                      </div>
                      {/* Controles */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => updateQty(item.productId, item.quantity - 1)}
                          className="h-7 w-7 rounded-full border border-border bg-muted flex items-center justify-center hover:border-primary/50 transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-foreground">{item.quantity}</span>
                        <button type="button" onClick={() => updateQty(item.productId, item.quantity + 1)}
                          className="h-7 w-7 rounded-full border border-border bg-muted flex items-center justify-center hover:border-primary/50 transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => removeItem(item.productId)}
                          className="h-7 w-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0 min-w-[56px] text-right">
                        {fmt(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Cupom */}
                {featureCoupons && (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Input
                        value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Digite seu cupom de desconto"
                        className="bg-muted/50 border-border rounded-xl h-10 flex-1"
                        disabled={!!appliedCoupon || isGenerating}
                      />
                      {appliedCoupon ? (
                        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl px-4"
                          onClick={() => { setAppliedCoupon(null); setCouponInput(""); }} disabled={isGenerating}>
                          Remover
                        </Button>
                      ) : (
                        <Button type="button" size="sm" className="h-10 rounded-xl px-4 gap-1.5"
                          onClick={handleApplyCoupon} disabled={isGenerating}>
                          <span className="text-base">🎟</span> Aplicar
                        </Button>
                      )}
                    </div>
                    {couponError && <p className="text-destructive text-xs">{couponError}</p>}
                    {appliedCoupon && (
                      <p className="text-primary text-xs">✓ Cupom <strong>{appliedCoupon.code}</strong> aplicado</p>
                    )}
                  </div>
                )}

                {/* Divisor */}
                <div className="border-t border-border" />

                {/* Totais */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Descontos</span>
                    <span className={discount > 0 ? "text-primary" : ""}>
                      {discount > 0 ? `- ${fmt(discount)}` : fmt(0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground text-base pt-1 border-t border-border">
                    <span>Total</span><span>{fmt(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </ShopLayout>
  );
}
