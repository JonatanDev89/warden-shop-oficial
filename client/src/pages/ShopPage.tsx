import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ShopLayout from "@/components/ShopLayout";
import { Package, ShoppingCart, Infinity, Plus, Check } from "lucide-react";
import { useState } from "react";
import { parseProductImages } from "@/lib/productImages";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

export default function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const { data: categories } = trpc.shop.getCategories.useQuery();
  const { data: products, isLoading } = trpc.shop.getProducts.useQuery({
    categoryId: selectedCategory,
  });
  const { addItem, items } = useCart();
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const formatPrice = (price: string | number) =>
    `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

  const handleAddToCart = (product: { id: number; name: string; price: string | number; imageUrl?: string | null }) => {
    const { main } = parseProductImages(product.imageUrl);
    addItem({
      productId: product.id,
      name: product.name,
      price: parseFloat(String(product.price)),
      imageUrl: main ?? undefined,
    });
    toast.success(`${product.name} adicionado ao carrinho!`);
    setAddedIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => setAddedIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; }), 1500);
  };
  return (
    <ShopLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1
            className="text-3xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Loja
          </h1>
          <p className="text-muted-foreground">Todos os produtos disponíveis no servidor</p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={selectedCategory === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(undefined)}
          >
            Todos
          </Button>
          {categories?.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 rounded-lg bg-card animate-pulse" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto disponível.</p>
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
                  <div className="text-xs text-muted-foreground mb-3">À vista</div>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-2">
                    <Link href={`/produto/${product.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Ver detalhes
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="flex-1 gap-1 text-xs"
                      onClick={() => handleAddToCart(product)}
                    >
                      {addedIds.has(product.id) ? (
                        <><Check className="h-3 w-3" /> Adicionado!</>
                      ) : (
                        <><Plus className="h-3 w-3" /> Carrinho</>
                      )}
                    </Button>
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
