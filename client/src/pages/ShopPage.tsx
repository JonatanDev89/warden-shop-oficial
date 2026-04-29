import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ShopLayout from "@/components/ShopLayout";
import { Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { parseProductImages } from "@/lib/productImages";

function PixIcon() {
  return (
    <svg className="w-4 h-4 text-primary" viewBox="0 0 512 512" fill="currentColor">
      <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H118.4C138.4 391.2 157.3 383.4 171.5 369.2L242.4 292.5zM262.5 219.5C257.1 224.9 247.8 224.9 242.4 219.5L171.5 142.5C157.3 128.3 138.4 120.5 118.4 120.5H103.3L200.7 23.4C231 -6.1 280.2 -6.1 310.5 23.4L407.6 120.5H392.5C372.5 120.5 353.6 128.3 339.4 142.5L262.5 219.5zM112 144.6C128 144.6 143.3 151.1 154.5 162.4L231.5 239.4C243.1 251 260.8 251 272.4 239.4L349.4 162.4C360.7 151.1 376 144.6 392 144.6H426.6L488.6 206.6C518.1 236.9 518.1 286.1 488.6 316.4L426.6 378.4H392C376 378.4 360.7 371.9 349.4 360.6L272.4 283.6C266.6 277.8 258.9 274.9 251.2 274.9C243.5 274.9 235.8 277.8 230 283.6L153 360.6C141.7 371.9 126.4 378.4 110.4 378.4H76.6L14.6 316.4C-14.9 286.1 -14.9 236.9 14.6 206.6L76.6 144.6H112z"/>
    </svg>
  );
}

export default function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const { data: categories } = trpc.shop.getCategories.useQuery();
  const { data: products, isLoading } = trpc.shop.getProducts.useQuery({
    categoryId: selectedCategory,
  });

  const formatPrice = (price: string | number) =>
    `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

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
                  {/* Imagem clicável → detalhes */}
                  <Link href={`/produto/${product.id}`}>
                    <div className="aspect-square w-full rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/5 transition-colors overflow-hidden cursor-pointer">
                      {(() => {
                        const { main } = parseProductImages(product.imageUrl);
                        return main ? (
                          <img src={main} alt={product.name} className="h-full w-full object-cover rounded-lg" />
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
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <PixIcon />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mb-3">À vista no Pix</div>

                  {/* Botão único → página de detalhes */}
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
