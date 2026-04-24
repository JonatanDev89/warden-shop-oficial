import { useState, useRef } from "react";
import ShopLayout from "@/components/ShopLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package, Search, X, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Minecraft item texture URL from minecraft-assets CDN
function itemTexture(minecraftId: string) {
  return `https://minecraft-inventory.s7a.dev/items/${minecraftId}.png`;
}

const INVENTORY_ROWS = 4;
const INVENTORY_COLS = 9;
const TOTAL_SLOTS = INVENTORY_ROWS * INVENTORY_COLS;

type SlotItem = {
  minecraftId: string;
  name: string;
  quantity: number;
  unitPrice: string;
};

export default function KitBuilderPage() {
  const [, navigate] = useLocation();
  const { data: kitItems = [] } = trpc.shop.getKitItems.useQuery();
  const createKitOrder = trpc.shop.createKitOrder.useMutation({
    onSuccess: (order) => {
      navigate(`/pedido-confirmado?orderNumber=${order?.orderNumber ?? ""}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Inventory slots: index → SlotItem | null
  const [slots, setSlots] = useState<(SlotItem | null)[]>(Array(TOTAL_SLOTS).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredItems = kitItems.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.minecraftId.toLowerCase().includes(search.toLowerCase())
  );

  const totalPrice = slots.reduce((sum, s) => {
    if (!s) return sum;
    return sum + parseFloat(s.unitPrice) * s.quantity;
  }, 0);

  const filledSlots = slots.filter(Boolean).length;

  function openSlot(index: number) {
    setSelectedSlot(index);
    setSearch("");
    setQuantityInput(slots[index]?.quantity?.toString() ?? "1");
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function placeItem(item: (typeof kitItems)[0]) {
    if (selectedSlot === null) return;
    const qty = Math.max(1, Math.min(item.maxPerSlot, parseInt(quantityInput) || 1));
    const next = [...slots];
    next[selectedSlot] = {
      minecraftId: item.minecraftId,
      name: item.name,
      quantity: qty,
      unitPrice: String(item.price),
    };
    setSlots(next);
    setSelectedSlot(null);
  }

  function clearSlot(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    const next = [...slots];
    next[index] = null;
    setSlots(next);
    if (selectedSlot === index) setSelectedSlot(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = slots
      .map((s, i) => (s ? { slot: i, ...s } : null))
      .filter(Boolean) as { slot: number; minecraftId: string; name: string; quantity: number; unitPrice: string }[];
    if (filled.length === 0) {
      toast.error("Adicione pelo menos um item ao kit.");
      return;
    }
    createKitOrder.mutate({ minecraftNickname: nick, email, slots: filled });
  }

  return (
    <ShopLayout>
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Monte seu Kit
          </h1>
          <p className="text-muted-foreground text-sm">
            Clique em um slot, escolha o item e a quantidade. O preço é calculado automaticamente.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Inventory grid */}
          <div className="lg:col-span-2 space-y-4">
            {/* Grid */}
            <div className="bg-[#c6c6c6] border-4 border-[#555] rounded-sm p-3 inline-block w-full">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${INVENTORY_COLS}, minmax(0, 1fr))` }}
              >
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => openSlot(i)}
                    className={`relative aspect-square rounded-sm border-2 flex items-center justify-center transition-all
                      ${selectedSlot === i
                        ? "border-white bg-[#8b8b8b] shadow-inner"
                        : "border-[#555] bg-[#8b8b8b] hover:border-white hover:bg-[#9b9b9b]"
                      }
                      ${slot ? "border-[#333]" : ""}
                    `}
                    title={slot ? `${slot.name} x${slot.quantity}` : `Slot ${i + 1}`}
                  >
                    {slot ? (
                      <>
                        <img
                          src={itemTexture(slot.minecraftId)}
                          alt={slot.name}
                          className="w-full h-full object-contain p-0.5 image-rendering-pixelated"
                          style={{ imageRendering: "pixelated" }}
                          onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                        />
                        {/* Quantity badge */}
                        <span className="absolute bottom-0 right-0.5 text-white text-[10px] font-bold leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                          {slot.quantity}
                        </span>
                        {/* Remove button */}
                        <button
                          onClick={(e) => clearSlot(i, e)}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[#555] text-xs opacity-40">+</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Item picker panel */}
            {selectedSlot !== null && (
              <div className="border border-border rounded-xl bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">
                    Slot {selectedSlot + 1} — escolha um item
                  </p>
                  <button onClick={() => setSelectedSlot(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Quantity */}
                <div className="flex items-center gap-2 mb-3">
                  <Label className="text-xs text-muted-foreground shrink-0">Quantidade:</Label>
                  <Input
                    type="number"
                    min="1"
                    max="64"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    className="bg-muted border-border h-8 w-20 text-sm"
                  />
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar item..."
                    className="bg-muted border-border pl-8 h-8 text-sm"
                  />
                </div>

                {/* Item list */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {filteredItems.length === 0 ? (
                    <p className="col-span-3 text-center text-xs text-muted-foreground py-4">
                      Nenhum item encontrado. O admin precisa cadastrar itens.
                    </p>
                  ) : (
                    filteredItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => placeItem(item)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-primary/10 hover:border-primary border border-border transition-all text-left"
                      >
                        <img
                          src={itemTexture(item.minecraftId)}
                          alt={item.name}
                          className="h-8 w-8 object-contain shrink-0"
                          style={{ imageRendering: "pixelated" }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                          <p className="text-xs text-primary font-bold">
                            R$ {parseFloat(String(item.price)).toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Summary + checkout */}
          <div className="space-y-4">
            {/* Kit summary */}
            <div className="border border-border rounded-xl bg-card p-4">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Resumo do Kit
              </h2>
              {filledSlots === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum item adicionado ainda.</p>
              ) : (
                <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                  {slots.map((s, i) => s && (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <img
                        src={itemTexture(s.minecraftId)}
                        alt={s.name}
                        className="h-6 w-6 object-contain shrink-0"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="flex-1 text-foreground truncate">{s.name}</span>
                      <span className="text-muted-foreground shrink-0">x{s.quantity}</span>
                      <span className="text-primary font-bold shrink-0">
                        R$ {(parseFloat(s.unitPrice) * s.quantity).toFixed(2).replace(".", ",")}
                      </span>
                      <button onClick={(e) => clearSlot(i, e)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-border mt-3 pt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{filledSlots} slot(s)</span>
                <span className="text-lg font-bold text-primary">
                  R$ {totalPrice.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Checkout form */}
            <form onSubmit={handleSubmit} className="border border-border rounded-xl bg-card p-4 space-y-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Finalizar Pedido
              </h2>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Nick no Minecraft *</Label>
                <Input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  className="bg-muted border-border h-9 text-sm"
                  placeholder="SeuNick"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted border-border h-9 text-sm"
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={filledSlots === 0 || createKitOrder.isPending}
              >
                {createKitOrder.isPending ? "Enviando..." : `Pedir Kit — R$ ${totalPrice.toFixed(2).replace(".", ",")}`}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
