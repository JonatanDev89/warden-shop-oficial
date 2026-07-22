import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ShopLayout from "@/components/ShopLayout";
import { Package, ShoppingCart, Plus, Minus, TrendingDown, Infinity } from "lucide-react";
import { useState } from "react";
import { parseProductImages } from "@/lib/productImages";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

function PixIcon() {
  return (
    <svg className="w-4 h-4 text-primary" viewBox="0 0 512 512" fill="currentColor">
      <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H118.4C138.4 391.2 157.3 383.4 171.5 369.2L242.4 292.5zM262.5 219.5C257.1 224.9 247.8 224.9 242.4 219.5L171.5 142.5C157.3 128.3 138.4 120.5 118.4 120.5H103.3L200.7 23.4C231 -6.1 280.2 -6.1 310.5 23.4L407.6 120.5H392.5C372.5 120.5 353.6 128.3 339.4 142.5L262.5 219.5zM112 144.6C128 144.6 143.3 151.1 154.5 162.4L231.5 239.4C243.1 251 260.8 251 272.4 239.4L349.4 162.4C360.7 151.1 376 144.6 392 144.6H426.6L488.6 206.6C518.1 236.9 518.1 286.1 488.6 316.4L426.6 378.4H392C376 378.4 360.7 371.9 349.4 360.6L272.4 283.6C266.6 277.8 258.9 274.9 251.2 274.9C243.5 274.9 235.8 277.8 230 283.6L153 360.6C141.7 371.9 126.4 378.4 110.4 378.4H76.6L14.6 316.4C-14.9 286.1 -14.9 236.9 14.6 206.6L76.6 144.6H112z"/>
    </svg>
  );
}

export default function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [, navigate] = useLocation();
  const { addItem, clearCart } = useCart();
  const { data: settings } = trpc.shop.getSettings.useQuery();
  const { data: categories } = trpc.shop.getCategories.useQuery();
  const { data: products, isLoading } = trpc.shop.getProducts.useQuery({
    categoryId: selectedCategory,
  });
  // Buscar cupons para lógica de desconto automático
  const { data: coupons } = trpc.admin.getCoupons.useQuery();

  const [quantities, setQuantities] = useState<Record<number, number>>({});

  // Função para pegar o melhor cupom de uma categoria
  const getCategoryCoupon = (catId: number) => {
    return coupons?.filter(c => 
      c.active && (c.categoryId === null || c.categoryId === catId)
    ).sort((a, b) => {
      const valA = a.discountType === "percent" ? parseFloat(String(a.discountValue)) : 0;
      const valB = b.discountType === "percent" ? parseFloat(String(b.discountValue)) : 0;
      return valB - valA;
    })[0];
  };

  const formatPrice = (price: string | number) =>
    `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

  const handleQtyChange = (productId: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] ?? 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const getEffectivePrice = (product: any) => {
    const cat = categories?.find(c => c.id === product.categoryId);
    if (cat?.overridePriceEnabled && cat.overridePrice) {
      return parseFloat(String(cat.overridePrice));
    }
    return parseFloat(String(product.price));
  };

  const handleAddToCart = (product: any) => {
    const qty = quantities[product.id] ?? 1;
    const { main } = parseProductImages(product.imageUrl);
    addItem({
      productId: product.id,
      name: product.name,
      price: getEffectivePrice(product),
      imageUrl: main ?? undefined,
      stock: product.stock,
    }, qty);
    toast.success(`${qty}x ${product.name} adicionado ao carrinho!`);
  };

  const handleBuyNow = (product: any) => {
    const qty = quantities[product.id] ?? 1;
    const { main } = parseProductImages(product.imageUrl);
    // Limpar o carrinho antes de "Comprar Agora" garante que os dados (como o estoque) sejam os mais recentes
    clearCart();
    
    addItem({
      productId: product.id,
      name: product.name,
      price: getEffectivePrice(product),
      imageUrl: main ?? undefined,
      stock: product.stock,
    }, qty);
    navigate("/checkout");
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

                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground font-medium">
                      {product.stock === -1 ? (
                        <span className="flex items-center gap-1">
                          <Infinity className="h-3 w-3" /> em estoque
                        </span>
                      ) : (
                        `${product.stock} em estoque`
                      )}
                    </Badge>
                  </div>

                  <div className="flex flex-col mb-3">
                    {/* Preço original riscado e Badge de desconto */}
                    {(() => {
                      const cat = categories?.find(c => c.id === product.categoryId);
                      const catCoupon = cat?.showCouponDiscount ? getCategoryCoupon(product.categoryId) : null;
                      const hasDiscount = product.originalPrice || catCoupon;
                      const hasBadge = product.discountBadge || (catCoupon?.discountType === "percent");

                      return (
                        <>
                          <div className="flex items-center gap-2 mb-1 min-h-[20px]">
                            {hasDiscount && (
                              <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">
                                {formatPrice(product.originalPrice || product.price)}
                              </span>
                            )}
                            
                            {hasBadge && (
                              <div 
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold"
                                style={{ 
                                  backgroundColor: `${settings?.priceColor || '#f97316'}1a`, 
                                  borderColor: `${settings?.priceColor || '#f97316'}33`,
                                  color: settings?.priceColor || '#f97316' 
                                }}
                              >
                                <TrendingDown className="h-3 w-3" />
                                {product.discountBadge || `-${parseFloat(String(catCoupon?.discountValue))}%`}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <div className="flex flex-col">
                              <span 
                                className="text-xl sm:text-2xl font-bold whitespace-nowrap leading-none"
                                style={{ color: settings?.priceColor || '#f97316' }}
                              >
                                {formatPrice(getEffectivePrice(product))}
                              </span>
                              {product.showPixPrice !== false && (
                                <span className="text-[10px] sm:text-xs text-muted-foreground mt-1">À vista no Pix</span>
                              )}
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <PixIcon />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Seletor de Quantidade */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1 border border-border rounded-md bg-muted/50 p-1 shrink-0">
                      <button 
                        onClick={() => handleQtyChange(product.id, -1)}
                        className="h-6 w-6 flex items-center justify-center hover:text-primary transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-foreground">
                        {quantities[product.id] ?? 1}
                      </span>
                      <button 
                        onClick={() => handleQtyChange(product.id, 1)}
                        className="h-6 w-6 flex items-center justify-center hover:text-primary transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-8 text-[10px] sm:text-xs gap-1 px-1"
                      onClick={() => handleAddToCart(product)}
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Carrinho
                    </Button>
                  </div>

                  {/* Botão Comprar Agora */}
                  <Button 
                    size="sm" 
                    className="w-full gap-2 font-bold"
                    onClick={() => handleBuyNow(product)}
                  >
                    Comprar agora
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
