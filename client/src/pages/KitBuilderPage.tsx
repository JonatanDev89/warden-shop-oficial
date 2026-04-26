import { useState, useRef } from "react";
import ShopLayout from "@/components/ShopLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Search, X, ShoppingCart, Trash2, ChevronLeft } from "lucide-react";
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

function itemTexture(minecraftId: string, imageUrl?: string | null) {
  if (imageUrl) return imageUrl;
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
  pricePerUnit: boolean;
  imageUrl?: string | null;
  // configLabel: IDs for server/addon (e.g. "sharpness 5")
  configLabel?: string;
  // displayLabel: human-readable for UI (e.g. "Afiação 5")
  displayLabel?: string;
};

// Pending selection state when item needs extra config
type PendingConfig =
  | { type: "armor"; item: KitItem }
  | { type: "book"; item: KitItem }
  | { type: "tool"; item: KitItem; enchants: ToolEnchantOption[] };

type KitItem = NonNullable<ReturnType<typeof trpc.shop.getKitItems.useQuery>["data"]>[0];

export default function KitBuilderPage() {
  const [, navigate] = useLocation();
  const { data: kitItems = [] } = trpc.shop.getKitItems.useQuery();
  const createKitOrder = trpc.shop.createKitOrder.useMutation({
    onSuccess: (order) => {
      navigate(`/pedido-confirmado?orderNumber=${order?.orderNumber ?? ""}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const [slots, setSlots] = useState<(SlotItem | null)[]>(Array(TOTAL_SLOTS).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const searchRef = useRef<HTMLInputElement>(null);

  // Config sub-step
  const [pendingConfig, setPendingConfig] = useState<PendingConfig | null>(null);
  const [armorTier, setArmorTier] = useState<"full" | "god">("full");
  const [bookEnchantId, setBookEnchantId] = useState("");
  const [bookEnchantLevel, setBookEnchantLevel] = useState("1");
  // tool enchants: list of { id, level } chosen by user
  const [toolSelectedEnchants, setToolSelectedEnchants] = useState<{ id: string; level: number }[]>([]);
  const [toolAddId, setToolAddId] = useState("");
  const [toolAddLevel, setToolAddLevel] = useState("1");

  const filteredItems = kitItems.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.minecraftId.toLowerCase().includes(search.toLowerCase())
  );

  const totalPrice = slots.reduce((sum, s) => {
    if (!s) return sum;
    return sum + (s.pricePerUnit ? parseFloat(s.unitPrice) * s.quantity : parseFloat(s.unitPrice));
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

  // Called when user clicks an item in the picker
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
      setPendingConfig({ type: "book", item, enchants: [] });
      return;
    }

    if (cfg?.type === "tool") {
      setToolSelectedEnchants([]);
      setToolAddId(cfg.enchants.length > 0 ? cfg.enchants[0].id : "");
      setToolAddLevel("1");
      setPendingConfig({ type: "tool", item, enchants: cfg.enchants });
      return;
    }

    // No special config — place directly
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
    // configLabel uses ID for addon; displayLabel uses PT-BR name for UI
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
    const next = [...slots];
    next[selectedSlot!] = {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = slots
      .map((s, i) => (s ? { slot: i, ...s } : null))
      .filter(Boolean) as {
        slot: number;
        minecraftId: string;
        name: string;
        quantity: number;
        unitPrice: string;
        configLabel?: string;
      }[];
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
          <h1
            className="text-3xl font-bold text-foreground mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
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
                      ${
                        selectedSlot === i
                          ? "border-white bg-[#8b8b8b] shadow-inner"
                          : "border-[#555] bg-[#8b8b8b] hover:border-white hover:bg-[#9b9b9b]"
                      }
                      ${slot ? "border-[#333]" : ""}
                    `}
                    title={slot ? `${slot.name}${slot.displayLabel ? ` (${slot.displayLabel})` : ""} x${slot.quantity}` : `Slot ${i + 1}`}
                  >
                    {slot ? (
                      <>
                        <img
                          src={itemTexture(slot.minecraftId, slot.imageUrl)}
                          alt={slot.name}
                          className="w-full h-full object-contain p-0.5"
                          style={{ imageRendering: "pixelated" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "";
                          }}
                        />
                        <span className="absolute bottom-0 right-0.5 text-white text-[10px] font-bold leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                          {slot.quantity}
                        </span>
                        <button
                          onClick={(e) => clearSlot(i, e)}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
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
                {/* ── Config sub-step: Armor ── */}
                {pendingConfig?.type === "armor" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPendingConfig(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-sm font-semibold text-foreground">
                        {pendingConfig.item.name} — escolha o tier
                      </p>
                    </div>
                    {(() => {
                      const cfg = parseItemConfig(pendingConfig.item.itemConfig);
                      if (cfg?.type !== "armor") return null;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          {(["full", "god"] as const).map((tier) => {
                            const price = tier === "full" ? cfg.priceFull : cfg.priceGod;
                            const enchants = tier === "full" ? cfg.enchantsFull : cfg.enchantsGod;
                            return (
                              <button
                                key={tier}
                                onClick={() => setArmorTier(tier)}
                                className={`rounded-lg border-2 p-3 text-left transition-all ${
                                  armorTier === tier
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-muted hover:border-primary/50"
                                }`}
                              >
                                <p className="font-semibold text-foreground capitalize">{tier}</p>
                                <p className="text-primary font-bold text-sm mt-0.5">
                                  R$ {parseFloat(price).toFixed(2).replace(".", ",")}
                                </p>
                                {enchants.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    {enchants.map((e) => `${e.name} ${e.level}`).join(", ")}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <Button onClick={confirmArmor} className="w-full">
                      Confirmar
                    </Button>
                  </div>
                ) : pendingConfig?.type === "book" ? (
                  /* ── Config sub-step: Book ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPendingConfig(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-sm font-semibold text-foreground">
                        {pendingConfig.item.name} — escolha o encantamento
                      </p>
                    </div>

                    {(() => {
                      const cfg = parseItemConfig(pendingConfig.item.itemConfig);
                      const pricePerLevel = cfg?.type === "book" ? parseFloat(cfg.pricePerLevel) : 0;
                      const enchantMeta = ALL_ENCHANTS.find((e) => e.id === bookEnchantId);
                      const level = enchantMeta
                        ? Math.max(1, Math.min(enchantMeta.maxLevel, parseInt(bookEnchantLevel) || 1))
                        : 1;
                      const price = pricePerLevel * level;

                      return (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Encantamento
                            </Label>
                            <Select value={bookEnchantId} onValueChange={(v) => {
                              setBookEnchantId(v);
                              setBookEnchantLevel("1");
                            }}>
                              <SelectTrigger className="bg-muted border-border">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border max-h-64">
                                {ALL_ENCHANTS.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.name}{" "}
                                    <span className="text-muted-foreground text-xs">
                                      ({e.category} · max. {e.maxLevel})
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {bookEnchantId && enchantMeta && (
                            <div className="space-y-2">
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                  Nivel (1–{enchantMeta.maxLevel})
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={enchantMeta.maxLevel}
                                  value={bookEnchantLevel}
                                  onChange={(e) => setBookEnchantLevel(e.target.value)}
                                  className="bg-muted border-border h-9 w-24"
                                />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {level} nivel(is) x R$ {pricePerLevel.toFixed(2).replace(".", ",")} ={" "}
                                <span className="text-primary font-bold">
                                  R$ {price.toFixed(2).replace(".", ",")}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <Button onClick={confirmBook} disabled={!bookEnchantId} className="w-full">
                      Confirmar
                    </Button>
                  </div>
                ) : pendingConfig?.type === "tool" ? (
                  /* ── Config sub-step: Tool ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPendingConfig(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-sm font-semibold text-foreground">
                        {pendingConfig.item.name} — escolha os encantamentos
                      </p>
                    </div>

                    {/* Selected enchants */}
                    <div className="space-y-1">
                      {toolSelectedEnchants.map((sel) => {
                        const meta = pendingConfig.enchants.find((e) => e.id === sel.id);
                        if (!meta) return null;
                        const cost = parseFloat(meta.price) * sel.level;
                        return (
                          <div key={sel.id} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                            <span className="flex-1 text-sm text-foreground">{meta.name}</span>
                            <Input
                              type="number"
                              min={1}
                              max={meta.maxLevel}
                              value={sel.level}
                              onChange={(e) => {
                                const lv = Math.max(1, Math.min(meta.maxLevel, parseInt(e.target.value) || 1));
                                setToolSelectedEnchants((prev) =>
                                  prev.map((s) => (s.id === sel.id ? { ...s, level: lv } : s))
                                );
                              }}
                              className="w-16 h-7 text-xs bg-muted border-border"
                            />
                            <span className="text-xs text-primary font-bold w-16 text-right shrink-0">
                              R$ {cost.toFixed(2).replace(".", ",")}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setToolSelectedEnchants((prev) => prev.filter((s) => s.id !== sel.id))
                              }
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                      {toolSelectedEnchants.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhum encantamento selecionado.</p>
                      )}
                    </div>

                    {/* Add enchant */}
                    {(() => {
                      const selectedIds = new Set(toolSelectedEnchants.map((s) => s.id));
                      const available = pendingConfig.enchants.filter((e) => !selectedIds.has(e.id));
                      if (available.length === 0) return null;
                      return (
                        <div className="flex gap-2">
                          <Select value={toolAddId} onValueChange={(v) => { setToolAddId(v); setToolAddLevel("1"); }}>
                            <SelectTrigger className="bg-muted border-border h-8 text-xs flex-1">
                              <SelectValue placeholder="Encantamento..." />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border max-h-60">
                              {available.map((e) => (
                                <SelectItem key={e.id} value={e.id} className="text-xs">
                                  {e.name} (máx. {e.maxLevel}) — R$ {parseFloat(e.price).toFixed(2).replace(".", ",")}/nv
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={1}
                            max={pendingConfig.enchants.find((e) => e.id === toolAddId)?.maxLevel ?? 10}
                            value={toolAddLevel}
                            onChange={(e) => setToolAddLevel(e.target.value)}
                            className="w-16 h-8 text-xs bg-muted border-border"
                            placeholder="Nv."
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!toolAddId}
                            onClick={() => {
                              const meta = pendingConfig.enchants.find((e) => e.id === toolAddId);
                              if (!meta) return;
                              const lv = Math.max(1, Math.min(meta.maxLevel, parseInt(toolAddLevel) || 1));
                              setToolSelectedEnchants((prev) => [...prev, { id: meta.id, level: lv }]);
                              const remaining = pendingConfig.enchants.filter(
                                (e) => e.id !== toolAddId && !toolSelectedEnchants.find((s) => s.id === e.id)
                              );
                              setToolAddId(remaining[0]?.id ?? "");
                              setToolAddLevel("1");
                            }}
                            className="h-8 px-2"
                          >
                            <X className="h-3 w-3 rotate-45" />
                          </Button>
                        </div>
                      );
                    })()}

                    {/* Price preview */}
                    {(() => {
                      const cfg = parseItemConfig(pendingConfig.item.itemConfig);
                      if (cfg?.type !== "tool") return null;
                      const enchantCost = toolSelectedEnchants.reduce((sum, sel) => {
                        const meta = pendingConfig.enchants.find((e) => e.id === sel.id);
                        return sum + (meta ? parseFloat(meta.price) * sel.level : 0);
                      }, 0);
                      const total = parseFloat(cfg.basePrice) + enchantCost;
                      return (
                        <p className="text-sm text-muted-foreground">
                          Base: R$ {parseFloat(cfg.basePrice).toFixed(2).replace(".", ",")}
                          {enchantCost > 0 && (
                            <> + encantamentos: R$ {enchantCost.toFixed(2).replace(".", ",")}</>
                          )}
                          {" = "}
                          <span className="text-primary font-bold">
                            R$ {total.toFixed(2).replace(".", ",")}
                          </span>
                        </p>
                      );
                    })()}

                    <Button onClick={confirmTool} className="w-full">
                      Confirmar
                    </Button>
                  </div>
                ) : (
                  /* ── Normal item picker ── */                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">
                        Slot {selectedSlot + 1} — escolha um item
                      </p>
                      <button
                        onClick={() => setSelectedSlot(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
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
                      <span className="text-xs text-muted-foreground">
                        (escolha o item para ver limites)
                      </span>
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
                        filteredItems.map((item) => {
                          const cfg = parseItemConfig(item.itemConfig);
                          return (
                            <button
                              key={item.id}
                              onClick={() => selectItem(item)}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-primary/10 hover:border-primary border border-border transition-all text-left"
                            >
                              <img
                                src={itemTexture(item.minecraftId, item.imageUrl)}
                                alt={item.name}
                                className="h-8 w-8 object-contain shrink-0"
                                style={{ imageRendering: "pixelated" }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {item.name}
                                </p>
                                {cfg?.type === "armor" ? (
                                  <p className="text-xs text-muted-foreground">Full / God</p>
                                ) : cfg?.type === "book" ? (
                                  <p className="text-xs text-muted-foreground">
                                    Livro de encantamento
                                  </p>
                                ) : cfg?.type === "tool" ? (
                                  <p className="text-xs text-muted-foreground">
                                    Ferramenta · {cfg.enchants.length} encant. disponíveis
                                  </p>
                                ) : (
                                  <p className="text-xs text-primary font-bold">
                                    R${" "}
                                    {parseFloat(String(item.price))
                                      .toFixed(2)
                                      .replace(".", ",")}
                                    <span className="text-muted-foreground font-normal ml-1">
                                      {item.pricePerUnit ? "/un" : "/slot"}
                                    </span>
                                  </p>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                  {item.minPerSlot === item.maxPerSlot
                                    ? `${item.minPerSlot} un`
                                    : `${item.minPerSlot}–${item.maxPerSlot} un`}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
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
                  {slots.map(
                    (s, i) =>
                      s && (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <img
                            src={itemTexture(s.minecraftId, s.imageUrl)}
                            alt={s.name}
                            className="h-6 w-6 object-contain shrink-0"
                            style={{ imageRendering: "pixelated" }}
                          />
                          <span className="flex-1 text-foreground truncate">
                            {s.name}
                            {s.displayLabel && (
                              <span className="text-muted-foreground ml-1">({s.displayLabel})</span>
                            )}
                          </span>
                          <span className="text-muted-foreground shrink-0">x{s.quantity}</span>
                          <span className="text-primary font-bold shrink-0">
                            R${" "}
                            {(s.pricePerUnit
                              ? parseFloat(s.unitPrice) * s.quantity
                              : parseFloat(s.unitPrice)
                            )
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                          <button
                            onClick={(e) => clearSlot(i, e)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      )
                  )}
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
            <form
              onSubmit={handleSubmit}
              className="border border-border rounded-xl bg-card p-4 space-y-3"
            >
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Finalizar Pedido
              </h2>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Nick no Minecraft *
                </Label>
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
                {createKitOrder.isPending
                  ? "Enviando..."
                  : `Pedir Kit — R$ ${totalPrice.toFixed(2).replace(".", ",")}`}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
