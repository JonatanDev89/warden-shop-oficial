import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ShopLayout from "@/components/ShopLayout";
import { ChevronRight, Package, ShoppingCart, Infinity } from "lucide-react";
import { parseProductImages } from "@/lib/productImages";

export default function CategoryPage() {
  const params = useParams<{ id: string }>();
  const categoryId = parseInt(params.id ?? "0");

  const { data: categories } = trpc.shop.getCategories.useQuery();
  const { data: products, isLoading } = trpc.shop.getProducts.useQuery({ categoryId });

  const category = categories?.find((c) => c.id === categoryId);

  const formatPrice = (price: string | number) =>
    `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

  return (
    <ShopLayout>
      <div className="container py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary transition-colors">Início</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{category?.name ?? "Categoria"}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {category?.name ?? "Produtos"}
          </h1>
          <p className="text-muted-foreground">
            {category?.description ?? "Veja os itens disponíveis desta categoria."}
          </p>
        </div>

        {/* Products grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 rounded-lg bg-card animate-pulse" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto disponível nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {products?.map((product) => (
              <Card
                key={product.id}
                className="group border-border hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 bg-card overflow-hidden"
              >
                <CardContent className="p-3 sm:p-5">
                  {/* Imagem clicável → detalhes */}
                  <Link href={`/produto/${product.id}`}>
                    <div className="aspect-square w-full rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/5 transition-colors overflow-hidden cursor-pointer">
                      {(() => {
                        const { main } = parseProductImages(product.imageUrl);
                        return main ? (
                          <img src={main} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-10 w-10 text-muted-foreground" />
                        );
                      })()}
                    </div>
                  </Link>

                  {/* Nome clicável → detalhes */}
                  <Link href={`/produto/${product.id}`}>
                    <h3
                      className="font-bold text-foreground mb-1 truncate hover:text-primary transition-colors cursor-pointer"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {product.name}
                    </h3>
                  </Link>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {product.description}
                  </p>

                  <div className="flex items-center justify-between mb-1 gap-1">
                    <span className="text-base sm:text-xl font-bold text-primary whitespace-nowrap">
                      {formatPrice(product.price)}
                    </span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs border-border text-muted-foreground shrink-0 px-1.5 py-0.5">
                      {product.stock === -1 ? (
                        <span className="flex items-center gap-0.5">
                          <Infinity className="h-2.5 w-2.5" /> estoque
                        </span>
                      ) : (
                        `${product.stock} estoque`
                      )}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground mb-3">À vista no Pix</div>

                  {/* Botão único → detalhes */}
                  <Link href={`/produto/${product.id}`} className="block">
                    <Button size="sm" className="w-full gap-2 font-semibold">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Comprar agora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
