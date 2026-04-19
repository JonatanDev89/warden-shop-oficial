import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ShopLayout from "@/components/ShopLayout";
import { ChevronRight, Package, ShoppingCart, Infinity } from "lucide-react";

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products?.map((product) => (
              <Card
                key={product.id}
                className="group border-border hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 bg-card overflow-hidden"
              >
                <CardContent className="p-5">
                  {/* Product image placeholder */}
                  <div className="h-32 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/5 transition-colors">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground" />
                    )}
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

                  <div className="text-xs text-muted-foreground mb-3">À vista</div>

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
