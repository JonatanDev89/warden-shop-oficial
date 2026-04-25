import { trpc } from "@/lib/trpc";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ShopLayout from "@/components/ShopLayout";
import { Package, ShoppingCart, Infinity, Search } from "lucide-react";
import { parseProductImages } from "@/lib/productImages";

export default function SearchPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const query = params.get("q") ?? "";

  const { data: products, isLoading } = trpc.shop.searchProducts.useQuery(
    { query },
    { enabled: query.length > 0 }
  );

  const formatPrice = (price: string | number) =>
    `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

  return (
    <ShopLayout>
      <div className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Resultados da busca
            </h1>
          </div>
          {query && (
            <p className="text-muted-foreground">
              Mostrando resultados para{" "}
              <span className="text-foreground font-medium">"{query}"</span>
            </p>
          )}
        </div>

        {!query ? (
          <div className="text-center py-20">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Digite algo para buscar produtos.</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-lg bg-card animate-pulse" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto encontrado para "{query}".</p>
            <Link href="/loja">
              <Button className="mt-4">Ver todos os produtos</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {products?.map((product) => (
              <Card
                key={product.id}
                className="group border-border hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 bg-card overflow-hidden"
              >
                <CardContent className="p-3 sm:p-5">
                  <div className="aspect-square w-full rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/5 transition-colors overflow-hidden">
                    {(() => {
                      const { main } = parseProductImages(product.imageUrl);
                      return main ? (
                        <img src={main} alt={product.name} className="h-full w-full object-cover rounded-lg" />
                      ) : (
                        <Package className="h-10 w-10 text-muted-foreground" />
                      );
                    })()}
                  </div>
                  <h3
                    className="font-bold text-foreground mb-1 truncate"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {product.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold text-primary">
                      {formatPrice(product.price)}
                    </span>
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
                  <div className="flex gap-2">
                    <Link href={`/produto/${product.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Ver detalhes
                      </Button>
                    </Link>
                    <Link href={`/checkout?productId=${product.id}`}>
                      <Button size="sm" className="gap-1 text-xs">
                        <ShoppingCart className="h-3 w-3" />
                        Comprar
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
