import { useState, useRef } from "react";
import ShopLayout from "@/components/ShopLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Search, X, ShoppingCart, Trash2, ChevronLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseItemConfig, ALL_ENCHANTS, type ToolEnchantOption } from "@/lib/kitEnchants";
import { useCart } from "@/contexts/CartContext";
import { getItemTexture, getItemTextureFallback, getGenericFallback } from "@/lib/minecraftTextures";

const INVENTORY_ROWS = 4;
const INVENTORY_COLS = 9;
const TOTAL_SLOTS = INVENTORY_ROWS * INVENTORY_COLS;

type SlotItem = {
  minecraftId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  pricePerUnit: boolean;
  imageUrl?: string | null;
  configLabel?: string;
  displayLabel?: string;
};

type PendingConfig =
  | { type: "armor"; item: KitItem }
  | { type: "book"; item: KitItem }
  | { type: "tool"; item: KitItem; enchants: ToolEnchantOption[] }
  | { type: "egg"; item: KitItem }
  | { type: "potion"; item: KitItem }
  | { type: "trim"; item: KitItem };

type KitItem = NonNullable<ReturnType<typeof trpc.shop.getKitItems.useQuery>["data"]>[0];

export default function KitBuilderPage() {
  const [, navigate] = useLocation();
  const { data: kitItems = [] } = trpc.shop.getKitItems.useQuery();
  const { addItem, clearCart } = useCart();

  const [slots, setSlots] = useState<(SlotItem | null)[]>(Array(TOTAL_SLOTS).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const searchRef = useRef<HTMLInputElement>(null);

  const [pendingConfig, setPendingConfig] = useState<PendingConfig | null>(null);
  const [armorTier, setArmorTier] = useState<"full" | "god">("full");
  const [bookEnchantId, setBookEnchantId] = useState("");
  const [bookEnchantLevel, setBookEnchantLevel] = useState("1");
  const [toolSelectedEnchants, setToolSelectedEnchants] = useState<{ id: string; level: number }[]>([]);
  const [toolAddId, setToolAddId] = useState("");
  const [toolAddLevel, setToolAddLevel] = useState("1");
  const [selectedOptionId, setSelectedOptionId] = useState("");

  const filteredItems = kitItems.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.minecraftId.toLowerCase().includes(search.toLowerCase())
  );

  const totalPrice = slots.reduce((sum, s) => {
    if (!s) return sum;
    const itemPrice = s.pricePerUnit ? parseFloat(s.unitPrice) * s.quantity : parseFloat(s.unitPrice);
    return sum + Math.round(itemPrice * 100) / 100;
  }, 0);

  const filledSlots = slots.filter(Boolean).length;

  function openSlot(index: number) {
    setSelectedSlot(index);
    setPendingConfig(null);
    setSearch("");
    setQuantityInput(slots[index]?.quantity?.toString() ?? "1");
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function clearSlot(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    const next = [...slots];
    next[index] = null;
    setSlots(next);
    if (selectedSlot === index) setSelectedSlot(null);
  }

  function selectItem(item: KitItem) {
    if (selectedSlot === null) return;
    const cfg = parseItemConfig(item.itemConfig);

    if (cfg?.type === "armor") {
      setArmorTier("full");
      setPendingConfig({ type: "armor", item });
      return;
    }

    if (cfg?.type === "book") {
      setBookEnchantId(ALL_ENCHANTS[0].id);
      setBookEnchantLevel("1");
      setPendingConfig({ type: "book", item });
      return;
    }

    if (cfg?.type === "tool") {
      setToolSelectedEnchants([]);
      setToolAddId(cfg.enchants.length > 0 ? cfg.enchants[0].id : "");
      setToolAddLevel("1");
      setPendingConfig({ type: "tool", item, enchants: cfg.enchants });
      return;
    }

    if (cfg?.type === "egg" || cfg?.type === "potion" || cfg?.type === "trim") {
      setSelectedOptionId(cfg.options.length > 0 ? cfg.options[0].id : "");
      setPendingConfig({ type: cfg.type, item } as PendingConfig);
      return;
    }

    placeItem(item, String(item.price), false, undefined);
  }

  function placeItem(
    item: KitItem,
    price: string,
    pricePerUnit: boolean,
    configLabel: string | undefined,
    displayLabel?: string
  ) {
    if (selectedSlot === null) return;
    const qty = Math.max(
      item.minPerSlot,
      Math.min(item.maxPerSlot, parseInt(quantityInput) || item.minPerSlot)
    );
    const next = [...slots];
    next[selectedSlot] = {
      minecraftId: item.minecraftId,
      name: item.name,
      quantity: qty,
      unitPrice: price,
      pricePerUnit,
      imageUrl: item.imageUrl,
      configLabel,
      displayLabel: displayLabel ?? configLabel,
    };
    setSlots(next);
    setSelectedSlot(null);
    setPendingConfig(null);
  }

  function confirmArmor() {
    if (!pendingConfig || pendingConfig.type !== "armor") return;
    const cfg = parseItemConfig(pendingConfig.item.itemConfig);
    if (cfg?.type !== "armor") return;
    const price = armorTier === "full" ? cfg.priceFull : cfg.priceGod;
    const label = armorTier === "full" ? "Full" : "God";
    placeItem(pendingConfig.item, price, false, label);
  }

  function confirmBook() {
    if (!pendingConfig || pendingConfig.type !== "book") return;
    const cfg = parseItemConfig(pendingConfig.item.itemConfig);
    if (cfg?.type !== "book") return;
    const enchantMeta = ALL_ENCHANTS.find((e) => e.id === bookEnchantId);
    if (!enchantMeta) return;
    const level = Math.max(1, Math.min(enchantMeta.maxLevel, parseInt(bookEnchantLevel) || 1));
    const totalEnchantPrice = (parseFloat(cfg.pricePerLevel) * level).toFixed(2);
    placeItem(pendingConfig.item, totalEnchantPrice, false, `${enchantMeta.id} ${level}`, `${enchantMeta.name} ${level}`);
  }

  function confirmTool() {
    if (!pendingConfig || pendingConfig.type !== "tool") return;
    const cfg = parseItemConfig(pendingConfig.item.itemConfig);
    if (cfg?.type !== "tool") return;
    const enchantCost = toolSelectedEnchants.reduce((sum, sel) => {
      const meta = pendingConfig.enchants.find((e) => e.id === sel.id);
      if (!meta) return sum;
      return sum + parseFloat(meta.price) * sel.level;
    }, 0);
    const total = (parseFloat(cfg.basePrice) + enchantCost).toFixed(2);
    const label =
      toolSelectedEnchants.length > 0
        ? toolSelectedEnchants
            .map((sel) => `${sel.id} ${sel.level}`)
            .join(", ")
        : "Sem encantamentos";
    
    if (selectedSlot === null) return;
    const next = [...slots];
    next[selectedSlot] = {
      minecraftId: pendingConfig.item.minecraftId,
      name: pendingConfig.item.name,
      quantity: 1,
      unitPrice: total,
      pricePerUnit: false,
      imageUrl: pendingConfig.item.imageUrl,
      configLabel: label,
      displayLabel: toolSelectedEnchants.length > 0
        ? toolSelectedEnchants.map((sel) => {
            const meta = pendingConfig.enchants.find((e) => e.id === sel.id);
            return `${meta?.name ?? sel.id} ${sel.level}`;
          }).join(", ")
        : "Sem encantamentos",
    };
    setSlots(next);
    setSelectedSlot(null);
    setPendingConfig(null);
  }

  function confirmGenericOption() {
    if (!pendingConfig || !["egg", "potion", "trim"].includes(pendingConfig.type)) return;
    const cfg = parseItemConfig(pendingConfig.item.itemConfig);
    if (!cfg || !("options" in cfg)) return;
    const opt = cfg.options.find((o) => o.id === selectedOptionId);
    if (!opt) return;
    
    if (selectedSlot === null) return;
    const qty = Math.max(
      pendingConfig.item.minPerSlot,
      Math.min(pendingConfig.item.maxPerSlot, parseInt(quantityInput) || pendingConfig.item.minPerSlot)
    );
    const next = [...slots];
    next[selectedSlot] = {
      minecraftId: opt.id,
      name: opt.name,
      quantity: qty,
      unitPrice: opt.price,
      pricePerUnit: true,
      imageUrl: undefined,
      configLabel: undefined,
      displayLabel: undefined,
    };
    setSlots(next);
    setSelectedSlot(null);
    setPendingConfig(null);
  }

  function addKitToCart() {
    if (filledSlots === 0) { toast.error("Adicione pelo menos um item ao kit."); return; }
    const filled = slots
      .map((s, i) => s ? { slot: i, minecraftId: s.minecraftId, name: s.name, quantity: s.quantity, unitPrice: s.unitPrice, pricePerUnit: s.pricePerUnit, configLabel: s.configLabel } : null)
      .filter(Boolean) as any[];
    addItem({
      productId: -1,
      name: `Kit Personalizado (${filledSlots} item${filledSlots > 1 ? "s" : ""})`,
      price: totalPrice,
      imageUrl: undefined,
      kitSlots: filled,
    });
    toast.success("Kit adicionado ao carrinho!");
  }

  function buyKitNow() {
    if (filledSlots === 0) { toast.error("Adicione pelo menos um item ao kit."); return; }
    const filled = slots
      .map((s, i) => s ? { slot: i, minecraftId: s.minecraftId, name: s.name, quantity: s.quantity, unitPrice: s.unitPrice, pricePerUnit: s.pricePerUnit, configLabel: s.configLabel } : null)
      .filter(Boolean) as any[];
    clearCart();
    addItem({
      productId: -1,
      name: `Kit Personalizado (${filledSlots} item${filledSlots > 1 ? "s" : ""})`,
      price: totalPrice,
      imageUrl: undefined,
      kitSlots: filled,
    });
    navigate("/checkout");
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
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#c6c6c6] border-4 border-[#555] rounded-sm p-3 inline-block w-full">
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${INVENTORY_COLS}, minmax(0, 1fr))` }}>
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => openSlot(i)}
                    className={`relative aspect-square rounded-sm border-2 flex items-center justify-center transition-all
                      ${selectedSlot === i ? "border-white bg-[#8b8b8b] shadow-inner" : "border-[#555] bg-[#8b8b8b] hover:border-white hover:bg-[#9b9b9b]"}
                      ${slot ? "border-[#333]" : ""}
                    `}
                    title={slot ? `${slot.name}${slot.displayLabel ? ` (${slot.displayLabel})` : ""} x${slot.quantity}` : `Slot ${i + 1}`}
                  >
                    {slot ? (
                      <>
                        <img
                          src={getItemTexture(slot.minecraftId, slot.imageUrl)}
                          alt={slot.name}
                          className="w-full h-full object-contain p-0.5"
                          style={{ imageRendering: "pixelated" }}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            const id = slot?.minecraftId || "";
                            if (img.src !== getItemTextureFallback(id)) {
                              img.src = getItemTextureFallback(id);
                            } else {
                              img.src = getGenericFallback();
                            }
                          }}
                        />
                        <span className="absolute bottom-0 right-0.5 text-white text-[10px] font-bold leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                          {slot.quantity}
                        </span>
                        <button onClick={(e) => clearSlot(i, e)} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10">
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

            {selectedSlot !== null && (
              <div className="border border-border rounded-xl bg-card p-4">
                {pendingConfig?.type === "armor" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPendingConfig(null)} className="text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-sm font-semibold text-foreground">{pendingConfig.item.name} — escolha o tier</p>
                    </div>
                    {(() => {
                      const cfg = parseItemConfig(pendingConfig.item.itemConfig);
                      if (cfg?.type !== "armor") return null;
                      return (
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setArmorTier("full")} className={`p-4 rounded-xl border-2 text-left transition-all ${armorTier === "full" ? "border-primary bg-primary/10" : "border-border bg-muted hover:border-primary/50"}`}>
                            <p className="text-sm font-bold text-foreground mb-1">Full</p>
                            <p className="text-xs text-primary font-bold">R$ {parseFloat(cfg.priceFull).toFixed(2).replace(".", ",")}</p>
                          </button>
                          <button onClick={() => setArmorTier("god")} className={`p-4 rounded-xl border-2 text-left transition-all ${armorTier === "god" ? "border-primary bg-primary/10" : "border-border bg-muted hover:border-primary/50"}`}>
                            <p className="text-sm font-bold text-foreground mb-1">God</p>
                            <p className="text-xs text-primary font-bold">R$ {parseFloat(cfg.priceGod).toFixed(2).replace(".", ",")}</p>
                          </button>
                        </div>
                      );
                    })()}
                    <Button onClick={confirmArmor} className="w-full">Confirmar</Button>
                  </div>
                ) : pendingConfig?.type === "book" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPendingConfig(null)} className="text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-sm font-semibold text-foreground">{pendingConfig.item.name} — escolha o encantamento</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Encantamento</Label>
                        <Select value={bookEnchantId} onValueChange={setBookEnchantId}>
                          <SelectTrigger className="bg-muted border-border h-9 text-xs">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border max-h-60">
                            {ALL_ENCHANTS.map((e) => (
                              <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Nível (Máx {ALL_ENCHANTS.find(e => e.id === bookEnchantId)?.maxLevel ?? 5})</Label>
                        <Input type="number" min="1" max={ALL_ENCHANTS.find(e => e.id === bookEnchantId)?.maxLevel ?? 10} value={bookEnchantLevel} onChange={(e) => setBookEnchantLevel(e.target.value)} className="bg-muted border-border h-9 text-xs" />
                      </div>
                    </div>
                    <Button onClick={confirmBook} className="w-full">Confirmar</Button>
                  </div>
                ) : pendingConfig?.type === "tool" ? (
                   <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPendingConfig(null)} className="text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-sm font-semibold text-foreground">{pendingConfig.item.name} — escolha os encantamentos</p>
                    </div>
                    <div className="space-y-1">
                      {toolSelectedEnchants.map((sel) => {
                        const meta = pendingConfig.enchants.find((e) => e.id === sel.id);
                        if (!meta) return null;
                        return (
                          <div key={sel.id} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                            <span className="flex-1 text-sm text-foreground">{meta.name}</span>
                            <Input type="number" min={1} max={meta.maxLevel} value={sel.level} onChange={(e) => {
                                const lv = Math.max(1, Math.min(meta.maxLevel, parseInt(e.target.value) || 1));
                                setToolSelectedEnchants((prev) => prev.map((s) => (s.id === sel.id ? { ...s, level: lv } : s)));
                              }} className="w-16 h-7 text-xs bg-muted border-border" />
                            <button type="button" onClick={() => setToolSelectedEnchants((prev) => prev.filter((s) => s.id !== sel.id))} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Select value={toolAddId} onValueChange={(v) => { setToolAddId(v); setToolAddLevel("1"); }}>
                        <SelectTrigger className="bg-muted border-border h-8 text-xs flex-1">
                          <SelectValue placeholder="Adicionar..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border max-h-60">
                          {pendingConfig.enchants.filter(e => !toolSelectedEnchants.find(s => s.id === e.id)).map((e) => (
                            <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" variant="outline" disabled={!toolAddId} onClick={() => {
                        const meta = pendingConfig.enchants.find((e) => e.id === toolAddId);
                        if (!meta) return;
                        setToolSelectedEnchants((prev) => [...prev, { id: meta.id, level: parseInt(toolAddLevel) || 1 }]);
                        setToolAddId("");
                      }} className="h-8 px-2">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <Label className="text-xs text-muted-foreground shrink-0">Quantidade:</Label>
                      <Input 
                        type="number" 
                        min={pendingConfig.item.minPerSlot} 
                        max={pendingConfig.item.maxPerSlot} 
                        value={quantityInput} 
                        onChange={(e) => setQuantityInput(e.target.value)} 
                        className="bg-muted border-border h-8 w-20 text-sm" 
                      />
                    </div>
                    <Button onClick={confirmTool} className="w-full">Confirmar</Button>
                  </div>
                ) : (pendingConfig?.type === "egg" || pendingConfig?.type === "potion" || pendingConfig?.type === "trim") ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPendingConfig(null)} className="text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-sm font-semibold text-foreground">
                        {pendingConfig.item.name} — escolha uma opção
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <Label className="text-xs text-muted-foreground shrink-0">Quantidade:</Label>
                      <Input 
                        type="number" 
                        min={pendingConfig.item.minPerSlot} 
                        max={pendingConfig.item.maxPerSlot} 
                        value={quantityInput} 
                        onChange={(e) => setQuantityInput(e.target.value)} 
                        className="bg-muted border-border h-8 w-20 text-sm" 
                      />
                      <span className="text-[10px] text-muted-foreground">
                        (Mín: {pendingConfig.item.minPerSlot}, Máx: {pendingConfig.item.maxPerSlot})
                      </span>
                    </div>

                    {(() => {
                      const cfg = parseItemConfig(pendingConfig.item.itemConfig);
                      if (!cfg || !("options" in cfg)) return null;
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {cfg.options.map((opt) => (
                            <button key={opt.id} onClick={() => setSelectedOptionId(opt.id)} className={`flex items-center gap-3 p-2 rounded-lg border-2 text-left transition-all ${selectedOptionId === opt.id ? "border-primary bg-primary/10" : "border-border bg-muted hover:border-primary/50"}`}>
                              <img src={getItemTexture(opt.id)} alt="" className="h-8 w-8 object-contain shrink-0" style={{ imageRendering: "pixelated" }} onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (img.src !== getItemTextureFallback(opt.id)) {
                                    img.src = getItemTextureFallback(opt.id);
                                  } else {
                                    img.src = getGenericFallback();
                                  }
                                }} />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {opt.name}
                                  {(opt as any).level && (
                                    <span className="text-muted-foreground ml-1">({(opt as any).level})</span>
                                  )}
                                </p>
                                <p className="text-xs text-primary font-bold">R$ {parseFloat(opt.price).toFixed(2).replace(".", ",")}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    <Button onClick={confirmGenericOption} className="w-full">Confirmar</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">Slot {selectedSlot + 1} — escolha um item</p>
                      <button onClick={() => setSelectedSlot(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-xs text-muted-foreground shrink-0">Quantidade:</Label>
                      <Input type="number" min="1" max="64" value={quantityInput} onChange={(e) => setQuantityInput(e.target.value)} className="bg-muted border-border h-8 w-20 text-sm" />
                    </div>
                    <div className="relative mb-3">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item..." className="bg-muted border-border pl-8 h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                      {filteredItems.map((item) => (
                        <button key={item.id} onClick={() => selectItem(item)} className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-primary/10 hover:border-primary border border-border transition-all text-left">
                          <img src={getItemTexture(item.minecraftId, item.imageUrl)} alt={item.name} className="h-8 w-8 object-contain shrink-0" style={{ imageRendering: "pixelated" }} onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              if (img.src !== getItemTextureFallback(item.minecraftId)) {
                                img.src = getItemTextureFallback(item.minecraftId);
                              } else {
                                img.src = getGenericFallback();
                              }
                            }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                            <p className="text-xs text-primary font-bold">R$ {parseFloat(String(item.price)).toFixed(2).replace(".", ",")}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6 sticky top-8">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Seu Kit
              </h2>
              <div className="space-y-3 mb-6 max-h-80 overflow-y-auto pr-2">
                {slots.map((s, i) => s && (
                  <div key={i} className="flex items-center gap-3 group">
                    <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0 border border-border">
                      <img src={getItemTexture(s.minecraftId, s.imageUrl)} alt="" className="h-7 w-7 object-contain" style={{ imageRendering: "pixelated" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{s.name} x{s.quantity}</p>
                      {s.displayLabel && <p className="text-[10px] text-muted-foreground truncate">{s.displayLabel}</p>}
                    </div>
                    <button onClick={(e) => clearSlot(i, e)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {filledSlots === 0 && <p className="text-sm text-muted-foreground text-center py-8">Seu kit está vazio.</p>}
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-xl font-bold text-primary">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
                <Button onClick={buyKitNow} className="w-full" disabled={filledSlots === 0}>Comprar Agora</Button>
                <Button onClick={addKitToCart} variant="outline" className="w-full" disabled={filledSlots === 0}>Adicionar ao Carrinho</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
