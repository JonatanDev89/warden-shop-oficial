import { trpc } from "@/lib/trpc";
import { Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ShopLayout from "@/components/ShopLayout";
import {
  ChevronRight,
  Tag,
  Loader2,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Banknote,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
    code: string;
    discountType: string;
    discountValue: string;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState<"form" | "redirecting">("form");

  const utils = trpc.useUtils();

  // Passo 1: criar pedido
  const createOrder = trpc.shop.createOrder.useMutation({
    onError: (err) => {
      toast.error(err.message ?? "Erro ao criar pedido.");
      setStep("form");
    },
  });

  // Passo 2: criar preferência MP e redirecionar
  const createPayment = trpc.shop.createMpPayment.useMutation({
    onSuccess: (data) => {
      // Redireciona via página intermediária no nosso domínio.
      // O Android intercepta URLs do mercadopago.com e abre o app —
      // passando pelo /ir o browser já está aberto e não há interceptação.
      const redirectUrl = `/ir?url=${encodeURIComponent(data.checkoutUrl)}`;
      window.location.href = redirectUrl;
    },
    onError: (err) => {
      toast.error(err.message ?? "Erro ao iniciar pagamento. Tente novamente.");
      setStep("form");
    },
  });

  const productPrice = product ? parseFloat(String(product.price)) : 0;

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === "percent") {
      return productPrice * (parseFloat(appliedCoupon.discountValue) / 100);
    }
    return Math.min(parseFloat(appliedCoupon.discountValue), productPrice);
  };

  const discount = calculateDiscount();
  const total = Math.max(0, productPrice - discount);
  const formatPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!couponInput.trim()) return;
    try {
      const result = await utils.shop.validateCoupon.fetch({ code: couponInput.trim() });
      setAppliedCoupon({
        code: result.code,
        discountType: result.discountType,
        discountValue: String(result.discountValue),
      });
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

    setStep("redirecting");

    // 1. Criar pedido no banco
    const order = await createOrder.mutateAsync({
      minecraftNickname: nickname.trim(),
      email: email.trim(),
      couponCode: appliedCoupon?.code,
      items: [{ productId: product.id, quantity: 1 }],
    });

    if (!order?.orderNumber) {
      setStep("form");
      return;
    }

    // 2. Criar preferência no Mercado Pago e redirecionar
    createPayment.mutate({ orderNumber: order.orderNumber });
  };

  const isProcessing = step === "redirecting" || createOrder.isPending || createPayment.isPending;

  return (
    <ShopLayout>
      <div className="container py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary transition-colors">Início</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Checkout</span>
        </nav>

        <h1
          className="text-2xl font-bold text-foreground mb-8"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Finalizar Pedido
        </h1>

        {loadingProduct ? (
          <div className="h-64 rounded-lg bg-card animate-pulse" />
        ) : !product ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Produto não encontrado.</p>
            <Link href="/loja">
              <Button className="mt-4">Voltar à Loja</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Formulário */}
              <div className="lg:col-span-2 space-y-6">
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
                      <Input
                        id="nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Seu nickname exato no jogo"
                        className="bg-muted border-border"
                        required
                        disabled={isProcessing}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use exatamente como aparece no jogo — diferencia maiúsculas.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-foreground mb-1.5 block">
                        E-mail <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="bg-muted border-border"
                        required
                        disabled={isProcessing}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Usado para acompanhamento do pedido.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Cupom */}
                {featureCoupons && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      Cupom de Desconto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="CÓDIGO DO CUPOM"
                        className="bg-muted border-border font-mono"
                        disabled={!!appliedCoupon || isProcessing}
                      />
                      {appliedCoupon ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setAppliedCoupon(null); setCouponInput(""); }}
                          disabled={isProcessing}
                        >
                          Remover
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isProcessing}>
                          Aplicar
                        </Button>
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

                {/* Métodos de pagamento aceitos */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Formas de Pagamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted border border-border text-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <span className="text-xs text-muted-foreground">Cartão de Crédito</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted border border-border text-center">
                        <Banknote className="h-5 w-5 text-primary" />
                        <span className="text-xs text-muted-foreground">PIX</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted border border-border text-center">
                        <Smartphone className="h-5 w-5 text-primary" />
                        <span className="text-xs text-muted-foreground">Boleto</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Pagamento processado com segurança pelo Mercado Pago.
                    </p>
                  </CardContent>
                </Card>

                {/* Termos */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                    disabled={isProcessing}
                  />
                  <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                    Eu li e concordo com os{" "}
                    <Link href="/termos" target="_blank" className="text-primary hover:underline font-medium">
                      Termos de Uso
                    </Link>
                    .
                  </Label>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-semibold gap-2"
                  disabled={isProcessing || !agreed}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {createOrder.isPending ? "Criando pedido..." : "Redirecionando para pagamento..."}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Pagar {formatPrice(total)} com Mercado Pago
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Seus dados são protegidos pelo Mercado Pago. Não armazenamos dados de cartão.
                </p>
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
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xl">📦</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">Qtd: 1</p>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {formatPrice(productPrice)}
                      </span>
                    </div>

                    <Separator className="bg-border" />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatPrice(productPrice)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-primary">
                          <span>Desconto ({appliedCoupon?.code})</span>
                          <span>- {formatPrice(discount)}</span>
                        </div>
                      )}
                      <Separator className="bg-border" />
                      <div className="flex justify-between font-bold text-foreground text-base">
                        <span>Total</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    </div>

                    {/* Badge de segurança */}
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span>Pagamento 100% seguro via Mercado Pago</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        )}
      </div>
    </ShopLayout>
  );
}
