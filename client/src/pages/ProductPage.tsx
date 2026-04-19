import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShopLayout from "@/components/ShopLayout";
import { ChevronRight, Package, Shield, Truck, CreditCard, Check, Infinity } from "lucide-react";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id ?? "0");

  const { data: product, isLoading } = trpc.shop.getProduct.useQuery({ id: productId });
  const { data: categories } = trpc.shop.getCategories.useQuery();

  const category = categories?.find((c) => c.id === product?.categoryId);

  const formatPrice = (price: string | number) =>
    `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

  const kitItems: string[] = (() => {
    try {
      return product?.kitContents ? JSON.parse(product.kitContents) : [];
    } catch {
      return [];
    }
  })();

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="container py-8">
          <div className="h-96 rounded-lg bg-card animate-pulse" />
        </div>
      </ShopLayout>
    );
  }

  if (!product) {
    return (
      <ShopLayout>
        <div className="container py-20 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Produto não encontrado.</p>
          <Link href="/loja">
            <Button className="mt-4">Voltar à Loja</Button>
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="container py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Início</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/loja" className="hover:text-primary transition-colors">Loja</Link>
          {category && (
            <>
              <ChevronRight className="h-4 w-4" />
              <Link href={`/categoria/${category.id}`} className="hover:text-primary transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Product image */}
          <div className="h-80 lg:h-full min-h-[300px] rounded-xl bg-card border border-border flex items-center justify-center">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover rounded-xl"
              />
            ) : (
              <Package className="h-20 w-20 text-muted-foreground" />
            )}
          </div>

          {/* Product info */}
          <div>
            <Badge
              variant="outline"
              className="mb-3 border-primary/40 text-primary bg-primary/10 text-xs"
            >
              Disponível
            </Badge>
            <h1
              className="text-3xl font-bold text-foreground mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {product.name}
            </h1>

            <div className="mb-2">
              <span className="text-4xl font-bold text-primary">{formatPrice(product.price)}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              À vista — entrega manual pelo admin
            </p>

            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                {product.stock === -1 ? (
                  <span className="flex items-center gap-1">
                    <Infinity className="h-3 w-3" /> em estoque
                  </span>
                ) : (
                  `${product.stock} em estoque`
                )}
              </Badge>
            </div>

            <Link href={`/checkout?productId=${product.id}`}>
              <Button
                size="lg"
                className="w-full mt-4 font-semibold text-base"
                style={{ boxShadow: "0 0 20px oklch(0.65 0.22 145 / 0.3)" }}
              >
                Comprar Agora
              </Button>
            </Link>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { icon: Truck, label: "Entrega no Jogo" },
                { icon: Shield, label: "Compra Segura" },
                { icon: CreditCard, label: "Sem Pagamento Online" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted text-center"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-xs text-muted-foreground leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Description & Kit Contents */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2
              className="text-xl font-bold text-foreground mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Descrição do Produto
            </h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {product.description ?? "Sem descrição disponível."}
            </p>
          </div>

          {kitItems.length > 0 && (
            <div>
              <h2
                className="text-xl font-bold text-foreground mb-4"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Conteúdo do Kit
              </h2>
              <ul className="space-y-2">
                {kitItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </ShopLayout>
  );
}
