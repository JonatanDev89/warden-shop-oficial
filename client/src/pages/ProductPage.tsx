import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShopLayout from "@/components/ShopLayout";
import { ChevronRight, Package, Shield, Truck, Zap, Check, Infinity, Plus, ShoppingCart, TrendingDown } from "lucide-react";
import { useState } from "react";
import { parseProductImages } from "@/lib/productImages";
import { getItemTexture, getItemTextureFallback } from "@/lib/minecraftTextures";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

// Ícone SVG do PIX
function PixIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.9999 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 11.9999 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 11.9999 2ZM8.58787 8.58787C9.36892 7.80682 10.6311 7.80682 11.4121 8.58787L12 9.17578L12.5879 8.58787C13.3689 7.80682 14.6311 7.80682 15.4121 8.58787C16.1932 9.36892 16.1932 10.6311 15.4121 11.4121L14.8242 12L15.4121 12.5879C16.1932 13.3689 16.1932 14.6311 15.4121 15.4121C14.6311 16.1932 13.3689 16.1932 12.5879 15.4121L12 14.8242L11.4121 15.4121C10.6311 16.1932 9.36892 16.1932 8.58787 15.4121C7.80682 14.6311 7.80682 13.3689 8.58787 12.5879L9.17578 12L8.58787 11.4121C7.80682 10.6311 7.80682 9.36892 8.58787 8.58787Z"/>
    </svg>
  );
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: product, isLoading } = trpc.shop.getProduct.useQuery({ id: productId });
  const { data: categories } = trpc.shop.getCategories.useQuery();
  // Buscar cupons para lógica de desconto automático
  const { data: coupons } = trpc.admin.getCoupons.useQuery(undefined, {
    enabled: !!categories?.find(c => c.id === product?.categoryId)?.showCouponDiscount
  });

  const category = categories?.find((c) => c.id === product?.categoryId);

  // Lógica para encontrar o melhor desconto de cupom para esta categoria
  const categoryCoupon = coupons?.filter(c => 
    c.active && (c.categoryId === null || c.categoryId === product?.categoryId)
  ).sort((a, b) => {
    const valA = a.discountType === "percent" ? parseFloat(String(a.discountValue)) : 0;
    const valB = b.discountType === "percent" ? parseFloat(String(b.discountValue)) : 0;
    return valB - valA;
  })[0];

  const handleAddToCart = () => {
    if (!product) return;
    const { main } = parseProductImages(product.imageUrl);
    addItem({
      productId: product.id,
      name: product.name,
      price: parseFloat(String(product.price)),
      imageUrl: main ?? undefined,
    }, qty);
    toast.success(`${product.name} adicionado ao carrinho!`);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBuyNow = () => {
    if (!product) return;
    const { main } = parseProductImages(product.imageUrl);
    addItem({
      productId: product.id,
      name: product.name,
      price: parseFloat(String(product.price)),
      imageUrl: main ?? undefined,
    }, qty);
    navigate("/checkout");
  };

  const formatPrice = (price: string | number) =>
    `R$ ${parseFloat(String(price)).toFixed(2).replace(".", ",")}`;

  const kitItems: string[] = (() => {
    try {
      return product?.kitContents ? JSON.parse(product.kitContents) : [];
    } catch {
      return [];
    }
  })();

  const { main: mainImage, kitImages } = parseProductImages(product?.imageUrl);

  // active kit image index (right side selector)
  const [activeKitIndex, setActiveKitIndex] = useState(0);

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
          {/* Product main image */}
          <div className="flex flex-col gap-3">
            <div className="aspect-square rounded-xl bg-card border border-border flex items-center justify-center overflow-hidden">
              {(() => {
                const cleanId = product.name.toLowerCase()
                  .replace(/§[0-9a-fk-or]/g, "")
                  .replace(/[^a-z0-9]/g, "_")
                  .replace(/_+/g, "_")
                  .replace(/^_|_$/g, "");
                
                const displayUrl = mainImage || getItemTexture(cleanId);

                return (
                  <img
                    src={displayUrl}
                    alt={product.name}
                    className="h-full w-full object-contain p-8"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (img.src !== getItemTexture(cleanId)) {
                        img.src = getItemTexture(cleanId);
                      } else if (img.src !== getItemTextureFallback(cleanId)) {
                        img.src = getItemTextureFallback(cleanId);
                      } else {
                        img.style.display = "none";
                        const parent = img.parentElement;
                        if (parent && !parent.querySelector(".fallback-icon")) {
                          const icon = document.createElement("div");
                          icon.className = "fallback-icon flex items-center justify-center h-full w-full";
                          icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>`;
                          parent.appendChild(icon);
                        }
                      }
                    }}
                  />
                );
              })()}
            </div>
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

            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                {/* Preço original riscado e Badge de desconto */}
                <div className="flex items-center gap-2 mb-1">
                  {(product.originalPrice || (category?.showCouponDiscount && categoryCoupon)) && (
                    <span className="text-lg text-muted-foreground line-through decoration-muted-foreground/50">
                      {formatPrice(product.originalPrice || product.price)}
                    </span>
                  )}
                  
                  {/* Badge de desconto (Manual ou Automático por cupom) */}
                  {(product.discountBadge || (category?.showCouponDiscount && categoryCoupon?.discountType === "percent")) && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold">
                      <TrendingDown className="h-3 w-3" />
                      {product.discountBadge || `-${parseFloat(String(categoryCoupon?.discountValue))}%`}
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-4xl font-bold text-orange-500 leading-none">
                    {formatPrice(product.price)}
                  </span>
                  {product.showPixPrice !== false && (
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                      À vista no Pix
                    </p>
                  )}
                </div>
              </div>
              {/* Ícone PIX */}
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <PixIcon className="w-7 h-7 text-primary" />
              </div>
            </div>

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

            {/* Quantidade + botões */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 border border-border rounded-lg bg-muted px-2 py-1 shrink-0">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="h-7 w-7 flex items-center justify-center hover:text-primary transition-colors">
                    <span className="text-lg font-bold leading-none">−</span>
                  </button>
                  <span className="w-8 text-center font-semibold text-foreground">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="h-7 w-7 flex items-center justify-center hover:text-primary transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {/* Comprar agora — vai direto pro checkout */}
                <Button
                  size="lg"
                  className="flex-1 font-bold text-base gap-2 rounded-full"
                  onClick={handleBuyNow}
                >
                  <ShoppingCart className="w-5 h-5" />
                  Comprar agora
                </Button>
              </div>

              {/* Adicionar ao carrinho */}
              <Button
                size="lg"
                variant="outline"
                className="w-full font-bold text-base gap-2 rounded-full border-border"
                onClick={handleAddToCart}
              >
                <Plus className="w-5 h-5" />
                {added ? "Adicionado!" : "Adicionar ao carrinho"}
              </Button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { icon: Zap, label: "Entrega no Jogo" },
                { icon: Shield, label: "Compra Segura" },
                { icon: Truck, label: "Pix Instantâneo" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted text-center">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-xs text-muted-foreground leading-tight">{label}</span>
                </div>
              ))}
            </div>

            {/* Kit images — shown below trust badges, right side */}
            {kitImages.length > 0 && (
              <div className="mt-5">
                {/* Active kit image */}
                <div className="rounded-xl overflow-hidden border border-border bg-muted w-full">
                  <img
                    src={kitImages[activeKitIndex]}
                    alt={`Kit foto ${activeKitIndex + 1}`}
                    className="w-full object-contain max-h-56"
                  />
                </div>
                {/* Thumbnail selectors */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {kitImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveKitIndex(i)}
                      className={`h-14 w-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                        i === activeKitIndex
                          ? "border-primary shadow-md shadow-primary/30"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
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
