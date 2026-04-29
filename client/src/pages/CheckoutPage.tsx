import { trpc } from "@/lib/trpc";
import { Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ShopLayout from "@/components/ShopLayout";
import {
  ChevronRight, Tag, Loader2, ShieldCheck, Copy, Check,
  Zap, RefreshCw, Clock,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

// ─── PIX QR Code inline ───────────────────────────────────────────────────────
function PixPanel({
  qrCode,
  qrCodeBase64,
  expiresAt,
  orderNumber,
  total,
  onConfirmed,
}: {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  orderNumber: string;
  total: number;
  onConfirmed: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [checking, setChecking] = useState(false);
  const utils = trpc.useUtils();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
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

  // Polling de confirmação a cada 4s
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
    } catch {
      toast.error("Erro ao verificar pagamento.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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
          <Clock className="h-3 w-3" />
          <span>{timeLeft}</span>
        </div>
      </div>

      {/* QR Code */}
      {qrCodeBase64 && (
        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-xl border border-border">
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-48 h-48"
            />
          </div>
        </div>
      )}

      {/* Valor */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">Valor a pagar</p>
        <p className="text-2xl font-bold text-primary">
          R$ {total.toFixed(2).replace(".", ",")}
        </p>
      </div>

      {/* Copia e cola */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">PIX Copia e Cola</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
            {qrCode.slice(0, 40)}...
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      </div>

      {/* Instruções */}
      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside bg-muted/50 rounded-lg p-3 border border-border">
        <li>Abra o app do seu banco</li>
        <li>Escolha pagar via PIX</li>
        <li>Escaneie o QR code ou cole o código acima</li>
        <li>Confirme o pagamento de <strong className="text-foreground">R$ {total.toFixed(2).replace(".", ",")}</strong></li>
      </ol>

      {/* Verificar manualmente */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleCheckManual}
        disabled={checking}
      >
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {checking ? "Verificando..." : "Já paguei — verificar"}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        A confirmação é automática. Você será redirecionado assim que o pagamento for detectado.
      </p>
    </div>
  );
}

// ─── Checkout principal ───────────────────────────────────────────────────────
export default function CheckoutPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const productId = parseInt(params.get("productId") ?? "0");
  const [, navigate] = useLocation();

  const { data: product, isLoading: loadingProduct } = trpc.shop.getProduct.useQuery(
    { id: productId },
    { enabled: productId > 0 }
  );
  const { data: settings } = trpc.shop.getSettings.useQuery();
  const s = settings as Record<string, string> | undefined;
  const featureCoupons = (s?.featureCoupons ?? "true") !== "false";

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string; discountType: string; discountValue: string;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [agreed, setAgreed] = useState(false);

  // Estado do fluxo
  type Step = "form" | "generating" | "pix" | "confirmed";
  const [step, setStep] = useState<Step>("form");
  const [pixData, setPixData] = useState<{
    qrCode: string; qrCodeBase64: string; expiresAt: string; orderNumber: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const createOrder = trpc.shop.createOrder.useMutation({
    onError: (err) => { toast.error(err.message ?? "Erro ao criar pedido."); setStep("form"); },
  });

  const createPix = trpc.shop.createPixPayment.useMutation({
    onError: (err) => { toast.error(err.message ?? "Erro ao gerar PIX."); setStep("form"); },
  });

  const productPrice = product ? parseFloat(String(product.price)) : 0;
  const discount = !appliedCoupon ? 0 :
    appliedCoupon.discountType === "percent"
      ? productPrice * (parseFloat(appliedCoupon.discountValue) / 100)
      : Math.min(parseFloat(appliedCoupon.discountValue), productPrice);
  const total = Math.max(0, productPrice - discount);
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!couponInput.trim()) return;
    try {
      const result = await utils.shop.validateCoupon.fetch({ code: couponInput.trim() });
      setAppliedCoupon({ code: result.code, discountType: result.discountType, discountValue: String(result.discountValue) });
      toast.success(`Cupom "${result.code}" aplicado!`);
    } catch {
      setCouponError("Cupom inválido ou expirado.");
      setAppliedCoupon(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return toast.error("Informe seu nickname no Minecraft.");
    if (!email.trim()) return toast.error("Informe seu e-mail.");
    if (!agreed) return toast.error("Você precisa concordar com os termos.");
    if (!product) return;

    setStep("generating");

    const order = await createOrder.mutateAsync({
      minecraftNickname: nickname.trim(),
      email: email.trim(),
      couponCode: appliedCoupon?.code,
      items: [{ productId: product.id, quantity: 1 }],
    });

    if (!order?.orderNumber) { setStep("form"); return; }

    const pix = await createPix.mutateAsync({
      orderNumber: order.orderNumber,
      payerEmail: email.trim(),
      payerName: nickname.trim(),
    });

    setPixData({ ...pix, orderNumber: order.orderNumber });
    setStep("pix");
  };

  const handlePixConfirmed = () => {
    setStep("confirmed");
    setTimeout(() => {
      navigate(`/pedido-confirmado?orderNumber=${encodeURIComponent(pixData!.orderNumber)}&payment=success`);
    }, 1500);
  };

  const isGenerating = step === "generating" || createOrder.isPending || createPix.isPending;

  return (
    <ShopLayout>
      <div className="container py-8">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary transition-colors">Início</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Checkout</span>
        </nav>

        <h1 className="text-2xl font-bold text-foreground mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Finalizar Pedido
        </h1>

        {loadingProduct ? (
          <div className="h-64 rounded-lg bg-card animate-pulse" />
        ) : !product ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Produto não encontrado.</p>
            <Link href="/loja"><Button className="mt-4">Voltar à Loja</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Coluna principal */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── Confirmado ── */}
              {step === "confirmed" && (
                <Card className="bg-card border-green-500/30">
                  <CardContent className="pt-6 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                      <Check className="h-8 w-8 text-green-400" />
                    </div>
                    <p className="text-lg font-bold text-foreground">Pagamento confirmado!</p>
                    <p className="text-sm text-muted-foreground">Redirecionando...</p>
                    <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                  </CardContent>
                </Card>
              )}

              {/* ── PIX inline ── */}
              {step === "pix" && pixData && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg flex items-center gap-2">
                      <span className="text-xl">⚡</span> Pague com PIX
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PixPanel
                      qrCode={pixData.qrCode}
                      qrCodeBase64={pixData.qrCodeBase64}
                      expiresAt={pixData.expiresAt}
                      orderNumber={pixData.orderNumber}
                      total={total}
                      onConfirmed={handlePixConfirmed}
                    />
                  </CardContent>
                </Card>
              )}

              {/* ── Formulário ── */}
              {(step === "form" || step === "generating") && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Dados do jogador */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-lg">Informações do Jogador</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="nickname" className="text-foreground mb-1.5 block">
                          Nickname no Minecraft <span className="text-destructive">*</span>
                        </Label>
                        <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)}
                          placeholder="Seu nickname exato no jogo" className="bg-muted border-border"
                          required disabled={isGenerating} />
                        <p className="text-xs text-muted-foreground mt-1">Use exatamente como aparece no jogo.</p>
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-foreground mb-1.5 block">
                          E-mail <span className="text-destructive">*</span>
                        </Label>
                        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="seu@email.com" className="bg-muted border-border"
                          required disabled={isGenerating} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cupom */}
                  {featureCoupons && (
                    <Card className="bg-card border-border">
                      <CardHeader>
                        <CardTitle className="text-foreground text-lg flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary" /> Cupom de Desconto
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2">
                          <Input value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())}
                            placeholder="CÓDIGO DO CUPOM" className="bg-muted border-border font-mono"
                            disabled={!!appliedCoupon || isGenerating} />
                          {appliedCoupon ? (
                            <Button type="button" variant="outline" onClick={() => { setAppliedCoupon(null); setCouponInput(""); }} disabled={isGenerating}>Remover</Button>
                          ) : (
                            <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isGenerating}>Aplicar</Button>
                          )}
                        </div>
                        {couponError && <p className="text-destructive text-sm mt-2">{couponError}</p>}
                        {appliedCoupon && (
                          <p className="text-primary text-sm mt-2">
                            ✓ Cupom <strong>{appliedCoupon.code}</strong> aplicado —{" "}
                            {appliedCoupon.discountType === "percent"
                              ? `${appliedCoupon.discountValue}% de desconto`
                              : `R$ ${parseFloat(appliedCoupon.discountValue).toFixed(2)} de desconto`}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Termos */}
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                    <input type="checkbox" id="terms" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary" disabled={isGenerating} />
                    <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                      Eu li e concordo com os{" "}
                      <Link href="/termos" target="_blank" className="text-primary hover:underline font-medium">Termos de Uso</Link>.
                    </Label>
                  </div>

                  <Button type="submit" size="lg" className="w-full font-semibold gap-2" disabled={isGenerating || !agreed}>
                    {isGenerating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />{createOrder.isPending ? "Criando pedido..." : "Gerando PIX..."}</>
                    ) : (
                      <><span className="text-lg">⚡</span> Gerar PIX — {fmt(total)}</>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Pagamento processado com segurança pelo Mercado Pago.
                  </p>
                </form>
              )}
            </div>

            {/* Resumo */}
            <div>
              <Card className="bg-card border-border sticky top-24">
                <CardHeader>
                  <CardTitle className="text-foreground text-lg">Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><span className="text-xl">📦</span></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">Qtd: 1</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{fmt(productPrice)}</span>
                  </div>

                  <Separator className="bg-border" />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span>{fmt(productPrice)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>Desconto ({appliedCoupon?.code})</span><span>- {fmt(discount)}</span>
                      </div>
                    )}
                    <Separator className="bg-border" />
                    <div className="flex justify-between font-bold text-foreground text-base">
                      <span>Total</span><span>{fmt(total)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Pagamento 100% seguro via Mercado Pago</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
