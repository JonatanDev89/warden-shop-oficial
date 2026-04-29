import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ShopLayout from "@/components/ShopLayout";
import { useCart } from "@/contexts/CartContext";
import { Trash2, Plus, Minus, ShoppingCart, ChevronRight, Package } from "lucide-react";

export default function CartPage() {
  const { items, removeItem, updateQty, clearCart, totalPrice } = useCart();
  const [, navigate] = useLocation();

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  if (items.length === 0) {
    return (
      <ShopLayout>
        <div className="container py-20 text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Seu carrinho está vazio</h2>
          <p className="text-muted-foreground mb-6">Adicione produtos para continuar.</p>
          <Link href="/loja">
            <Button>Ver Produtos</Button>
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="container py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary transition-colors">Início</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/loja" className="hover:text-primary transition-colors">Loja</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Carrinho</span>
        </nav>

        <h1 className="text-2xl font-bold text-foreground mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Carrinho ({items.length} {items.length === 1 ? "item" : "itens"})
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lista de itens */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <Card key={item.productId} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Imagem */}
                    <div className="h-16 w-16 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      <p className="text-sm text-primary font-medium">{fmt(item.price)} / un.</p>
                    </div>

                    {/* Quantidade */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => updateQty(item.productId, item.quantity - 1)}
                        className="h-8 w-8 rounded-lg border border-border bg-muted flex items-center justify-center hover:border-primary/50 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center font-semibold text-foreground text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.productId, item.quantity + 1)}
                        className="h-8 w-8 rounded-lg border border-border bg-muted flex items-center justify-center hover:border-primary/50 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right shrink-0 min-w-[80px]">
                      <p className="font-bold text-foreground">{fmt(item.price * item.quantity)}</p>
                    </div>

                    {/* Remover */}
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="h-8 w-8 rounded-lg border border-border bg-muted flex items-center justify-center hover:border-destructive/50 hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground gap-2">
                <Trash2 className="h-3.5 w-3.5" />
                Limpar carrinho
              </Button>
            </div>
          </div>

          {/* Resumo */}
          <div>
            <Card className="bg-card border-border sticky top-24">
              <CardHeader>
                <CardTitle className="text-foreground text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate flex-1 mr-2">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="text-foreground font-medium shrink-0">
                      {fmt(item.price * item.quantity)}
                    </span>
                  </div>
                ))}

                <Separator className="bg-border" />

                <div className="flex justify-between font-bold text-foreground text-lg">
                  <span>Total</span>
                  <span className="text-primary">{fmt(totalPrice)}</span>
                </div>

                <Button
                  size="lg"
                  className="w-full font-semibold gap-2"
                  onClick={() => navigate("/checkout")}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Finalizar Compra
                </Button>

                <Link href="/loja">
                  <Button variant="outline" size="sm" className="w-full">
                    Continuar comprando
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
