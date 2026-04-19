import { trpc } from "@/lib/trpc";
import { Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ShopLayout from "@/components/ShopLayout";
import { ChevronRight, Tag, AlertTriangle, Loader2 } from "lucide-react";
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

  const { data: customization, isLoading: loadingCustomization } = trpc.shop.getStoreCustomization.useQuery();

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

  const utils = trpc.useUtils();

  const createOrder = trpc.shop.createOrder.useMutation({
    onSuccess: (order) => {
      navigate(`/pedido-confirmado?orderNumber=${order?.orderNumber ?? ""}`);
    },
    onError: (err) => {
      toast.error(err.message ?? "Erro ao criar pedido.");
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

    createOrder.mutate({
      minecraftNickname: nickname.trim(),
      email: email.trim(),
      couponCode: appliedCoupon?.code,
      items: [{ productId: product.id, quantity: 1 }],
    });
  };

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
              {/* Form */}
              <div className="lg:col-span-2 space-y-6">
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
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Para acompanhamento do pedido.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Coupon */}
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
                        disabled={!!appliedCoupon}
                      />
                      {appliedCoupon ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponInput("");
                          }}
                        >
                          Remover
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" onClick={handleApplyCoupon}>
                          Aplicar
                        </Button>
                      )}
                    </div>
                    {couponError && (
                      <p className="text-destructive text-sm mt-2">{couponError}</p>
                    )}
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

                {/* Terms Agreement */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                    Eu li e concordo com os{" "}
                    <Link href="/termos" target="_blank" className="text-primary hover:underline font-medium">
                      Termos de Uso
                    </Link>
                    {" "}da Warden Shop.
                  </Label>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-semibold"
                  disabled={createOrder.isPending || !agreed}
                  style={{ boxShadow: "0 0 20px oklch(0.65 0.22 145 / 0.3)" }}
                >
                  {createOrder.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...</>
                  ) : (
                    `Confirmar Pedido — ${formatPrice(total)}`
                  )}
                </Button>
              </div>

              {/* Order summary */}
              <div>
                <Card className="bg-card border-border sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg">Resumo do Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xl">📦</span>
                      </div>
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

                    {!loadingCustomization && customization?.pixKey && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                        <span className="font-mono">
                          <strong>Chave PIX:</strong> {customization.pixKey}
                          {customization.pixKeyType && (
                            <span className="ml-2 text-blue-300">({customization.pixKeyType.toUpperCase()})</span>
                          )}
                        </span>
                      </div>
                    )}
                    {loadingCustomization && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin mt-0.5" />
                        <span>Carregando informações de pagamento...</span>
                      </div>
                    )}

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Sem pagamento online. O pedido entra em fila e será confirmado pelo admin. Você receberá os itens no jogo após a confirmação.
                      </span>
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
