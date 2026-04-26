import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  X,
  BookOpen,
  Shield,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  ALL_ENCHANTS,
  type EnchantEntry,
  type ToolEnchantOption,
} from "@/lib/kitEnchants";

type KitItem = NonNullable<ReturnType<typeof trpc.admin.getKitItems.useQuery>["data"]>[0];
type ConfigType = "none" | "armor" | "book" | "tool";

type KitItemForm = {
  minecraftId: string;
  name: string;
  price: string;
  minPerSlot: string;
  maxPerSlot: string;
  pricePerUnit: boolean;
  imageUrl: string;
  active: boolean;
  configType: ConfigType;
  armorPriceFull: string;
  armorPriceGod: string;
  armorEnchantsFull: EnchantEntry[];
  armorEnchantsGod: EnchantEntry[];
  bookPricePerLevel: string;
  toolEnchants: ToolEnchantOption[];
};

const emptyForm: KitItemForm = {
  minecraftId: "",
  name: "",
  price: "0",
  minPerSlot: "1",
  maxPerSlot: "64",
  pricePerUnit: false,
  imageUrl: "",
  active: true,
  configType: "none",
  armorPriceFull: "0",
  armorPriceGod: "0",
  armorEnchantsFull: [],
  armorEnchantsGod: [],
  bookPricePerLevel: "0",
  toolEnchants: [],
};

function itemTexture(minecraftId: string, imageUrl?: string | null) {
  if (imageUrl) return imageUrl;
  return `https://minecraft-inventory.s7a.dev/items/${minecraftId}.png`;
}

function formatPrice(v: string | number) {
  return `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;
}

function buildItemConfig(form: KitItemForm): string | undefined {
  if (form.configType === "armor") {
    return JSON.stringify({
      type: "armor",
      priceFull: form.armorPriceFull,
      priceGod: form.armorPriceGod,
      enchantsFull: form.armorEnchantsFull,
      enchantsGod: form.armorEnchantsGod,
    });
  }
  if (form.configType === "book") {
    return JSON.stringify({
      type: "book",
      pricePerLevel: form.bookPricePerLevel,
    });
  }
  if (form.configType === "tool") {
    return JSON.stringify({
      type: "tool",
      basePrice: form.price,
      enchants: form.toolEnchants,
    });
  }
  return undefined;
}

function parseFormFromItem(item: KitItem): KitItemForm {
  const base: KitItemForm = {
    minecraftId: item.minecraftId,
    name: item.name,
    price: String(item.price),
    minPerSlot: String(item.minPerSlot ?? 1),
    maxPerSlot: String(item.maxPerSlot ?? 64),
    pricePerUnit: item.pricePerUnit ?? false,
    imageUrl: item.imageUrl ?? "",
    active: item.active ?? true,
    configType: "none",
    armorPriceFull: "0",
    armorPriceGod: "0",
    armorEnchantsFull: [],
    armorEnchantsGod: [],
    bookPricePerLevel: "0",
    toolEnchants: [],
  };
  if (item.itemConfig) {
    try {
      const cfg = JSON.parse(item.itemConfig);
      if (cfg?.type === "armor") {
        base.configType = "armor";
        base.armorPriceFull = cfg.priceFull ?? "0";
        base.armorPriceGod = cfg.priceGod ?? "0";
        base.armorEnchantsFull = cfg.enchantsFull ?? [];
        base.armorEnchantsGod = cfg.enchantsGod ?? [];
      } else if (cfg?.type === "book") {
        base.configType = "book";
        // support old format (enchants array) and new format (pricePerLevel)
        base.bookPricePerLevel = cfg.pricePerLevel ?? "0";
      } else if (cfg?.type === "tool") {
        base.configType = "tool";
        base.toolEnchants = cfg.enchants ?? [];
      }
    } catch {}
  }
  return base;
}

function EnchantList({
  label,
  enchants,
  onChange,
}: {
  label: string;
  enchants: EnchantEntry[];
  onChange: (v: EnchantEntry[]) => void;
}) {
  const [addId, setAddId] = useState("");
  const [addLevel, setAddLevel] = useState("1");

  const selected = new Set(enchants.map((e) => e.id));
  const available = ALL_ENCHANTS.filter((e) => !selected.has(e.id));

  const add = () => {
    const meta = ALL_ENCHANTS.find((e) => e.id === addId);
    if (!meta) return;
    const level = Math.min(parseInt(addLevel) || 1, meta.maxLevel);
    onChange([...enchants, { id: meta.id, name: meta.name, level }]);
    setAddId("");
    setAddLevel("1");
  };

  const remove = (id: string) => onChange(enchants.filter((e) => e.id !== id));
  const updateLevel = (id: string, level: number) =>
    onChange(enchants.map((e) => (e.id === id ? { ...e, level } : e)));

  return (
    <div className="space-y-2">
      <Label className="text-foreground text-sm">{label}</Label>
      <div className="space-y-1">
        {enchants.map((e) => {
          const meta = ALL_ENCHANTS.find((m) => m.id === e.id);
          return (
            <div key={e.id} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
              <span className="flex-1 text-sm text-foreground">{e.name}</span>
              <Input
                type="number"
                min={1}
                max={meta?.maxLevel ?? 10}
                value={e.level}
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                  updateLevel(e.id, parseInt(ev.target.value) || 1)
                }
                className="w-16 h-7 text-xs bg-muted border-border"
              />
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      {available.length > 0 && (
        <div className="flex gap-2">
          <Select value={addId} onValueChange={setAddId}>
            <SelectTrigger className="bg-muted border-border h-8 text-xs flex-1">
              <SelectValue placeholder="Encantamento..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-h-60">
              {available.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-xs">
                  {e.name} ({e.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            max={10}
            value={addLevel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddLevel(e.target.value)}
            className="w-16 h-8 text-xs bg-muted border-border"
            placeholder="Nv."
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={add}
            disabled={!addId}
            className="h-8 px-2"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ToolEnchantList({
  enchants,
  onChange,
}: {
  enchants: ToolEnchantOption[];
  onChange: (v: ToolEnchantOption[]) => void;
}) {
  const [addId, setAddId] = useState("");
  const [addPrice, setAddPrice] = useState("0");

  const selected = new Set(enchants.map((e) => e.id));
  const available = ALL_ENCHANTS.filter((e) => !selected.has(e.id));

  const add = () => {
    const meta = ALL_ENCHANTS.find((e) => e.id === addId);
    if (!meta) return;
    onChange([
      ...enchants,
      { id: meta.id, name: meta.name, maxLevel: meta.maxLevel, price: addPrice },
    ]);
    setAddId("");
    setAddPrice("0");
  };

  const remove = (id: string) => onChange(enchants.filter((e) => e.id !== id));
  const updatePrice = (id: string, price: string) =>
    onChange(enchants.map((e) => (e.id === id ? { ...e, price } : e)));

  return (
    <div className="space-y-2">
      <Label className="text-foreground text-sm">Encantamentos disponiveis</Label>
      <div className="space-y-1">
        {enchants.map((e) => (
          <div key={e.id} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
            <span className="flex-1 text-sm text-foreground">
              {e.name}{" "}
              <span className="text-xs text-muted-foreground">(max. {e.maxLevel})</span>
            </span>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={e.price}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                updatePrice(e.id, ev.target.value)
              }
              className="w-24 h-7 text-xs bg-muted border-border"
              placeholder="R$/nv"
            />
            <button
              type="button"
              onClick={() => remove(e.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <div className="flex gap-2">
          <Select value={addId} onValueChange={setAddId}>
            <SelectTrigger className="bg-muted border-border h-8 text-xs flex-1">
              <SelectValue placeholder="Encantamento..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-h-60">
              {available.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-xs">
                  {e.name} ({e.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={addPrice}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddPrice(e.target.value)}
            className="w-24 h-8 text-xs bg-muted border-border"
            placeholder="R$/nv"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={add}
            disabled={!addId}
            className="h-8 px-2"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminKitItems() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.admin.getKitItems.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<KitItemForm>(emptyForm);

  const upsertKitItem = trpc.admin.upsertKitItem.useMutation({
    onSuccess: () => {
      utils.admin.getKitItems.invalidate();
      setDialogOpen(false);
      toast.success(editingId ? "Item atualizado!" : "Item criado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteKitItem = trpc.admin.deleteKitItem.useMutation({
    onSuccess: () => {
      utils.admin.getKitItems.invalidate();
      toast.success("Item removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: KitItem) => {
    setEditingId(item.id);
    setForm(parseFormFromItem(item));
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertKitItem.mutate({
      minecraftId: form.minecraftId.trim(),
      name: form.name.trim(),
      price: form.price,
      minPerSlot: parseInt(form.minPerSlot) || 1,
      maxPerSlot: parseInt(form.maxPerSlot) || 64,
      pricePerUnit: form.pricePerUnit,
      imageUrl: form.imageUrl.trim() || undefined,
      itemConfig: buildItemConfig(form),
      active: form.active,
    });
  };

  const setF = (patch: Partial<KitItemForm>) =>
    setForm((f: KitItemForm) => ({ ...f, ...patch }));

  return (
    <AdminLayout title="Itens do Kit">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Itens do Kit
          </h2>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Item
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !items?.length ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Package className="h-8 w-8" />
            <p className="text-sm">Nenhum item cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              let configBadge: React.ReactNode = null;
              if (item.itemConfig) {
                try {
                  const cfg = JSON.parse(item.itemConfig);
                  if (cfg?.type === "armor")
                    configBadge = (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Shield className="h-3 w-3" /> Armadura
                      </Badge>
                    );
                  else if (cfg?.type === "book")
                    configBadge = (
                      <Badge variant="outline" className="text-xs gap-1">
                        <BookOpen className="h-3 w-3" /> Livro
                      </Badge>
                    );
                  else if (cfg?.type === "tool")
                    configBadge = (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Wrench className="h-3 w-3" /> Ferramenta
                      </Badge>
                    );
                } catch {}
              }
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={itemTexture(item.minecraftId, item.imageUrl)}
                      alt={item.name}
                      className="h-8 w-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{item.name}</p>
                      <span className="text-xs text-muted-foreground font-mono">
                        {item.minecraftId}
                      </span>
                      {!item.active && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                      {configBadge}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-sm text-primary font-bold">
                        {formatPrice(item.price)}
                        {item.pricePerUnit && (
                          <span className="text-xs text-muted-foreground font-normal ml-1">
                            /unidade
                          </span>
                        )}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {item.minPerSlot}-{item.maxPerSlot} por slot
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remover "${item.name}"?`))
                          deleteKitItem.mutate({ id: item.id });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Item" : "Novo Item do Kit"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Minecraft ID *</Label>
              <div className="flex gap-2 items-center">
                <div className="h-10 w-10 rounded-lg bg-muted border border-border shrink-0 overflow-hidden flex items-center justify-center">
                  {form.minecraftId ? (
                    <img
                      src={itemTexture(form.minecraftId, form.imageUrl || null)}
                      alt=""
                      className="h-8 w-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <Input
                  value={form.minecraftId}
                  onChange={(e) => setF({ minecraftId: e.target.value })}
                  className="bg-muted border-border flex-1 font-mono text-sm"
                  placeholder="enchanted_book"
                  required
                  disabled={!!editingId}
                />
              </div>
              {editingId && (
                <p className="text-xs text-muted-foreground mt-1">
                  O Minecraft ID nao pode ser alterado apos a criacao.
                </p>
              )}
            </div>

            <div>
              <Label className="text-foreground mb-1.5 block">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setF({ name: e.target.value })}
                className="bg-muted border-border"
                placeholder="Livro de Encantamento"
                required
              />
            </div>

            <div>
              <Label className="text-foreground mb-1.5 block">
                URL da Imagem{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setF({ imageUrl: e.target.value })}
                className="bg-muted border-border"
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground mb-1.5 block">Preco base (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setF({ price: e.target.value })}
                  className="bg-muted border-border"
                  required
                />
              </div>
              <div className="flex flex-col justify-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.pricePerUnit}
                    onCheckedChange={(v) => setF({ pricePerUnit: v })}
                  />
                  <Label className="text-foreground text-sm">Preco por unidade</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground mb-1.5 block">Min. por slot</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.minPerSlot}
                  onChange={(e) => setF({ minPerSlot: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Max. por slot</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.maxPerSlot}
                  onChange={(e) => setF({ maxPerSlot: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-1.5 block">Configuracao especial</Label>
              <Select
                value={form.configType}
                onValueChange={(v) => setF({ configType: v as ConfigType })}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="armor">Armadura (Full / God)</SelectItem>
                  <SelectItem value="book">Livro de Encantamento</SelectItem>
                  <SelectItem value="tool">Ferramenta / Arma (encantamentos avulsos)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.configType === "armor" && (
              <div className="rounded-lg border border-border p-3 space-y-4 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Configuracao de Armadura
                </p>
                <Tabs defaultValue="full">
                  <TabsList className="bg-muted">
                    <TabsTrigger value="full">Full</TabsTrigger>
                    <TabsTrigger value="god">God</TabsTrigger>
                  </TabsList>
                  <TabsContent value="full" className="space-y-3 pt-2">
                    <div>
                      <Label className="text-foreground mb-1.5 block text-sm">
                        Preco Full (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.armorPriceFull}
                        onChange={(e) => setF({ armorPriceFull: e.target.value })}
                        className="bg-muted border-border"
                      />
                    </div>
                    <EnchantList
                      label="Encantamentos Full"
                      enchants={form.armorEnchantsFull}
                      onChange={(v) => setF({ armorEnchantsFull: v })}
                    />
                  </TabsContent>
                  <TabsContent value="god" className="space-y-3 pt-2">
                    <div>
                      <Label className="text-foreground mb-1.5 block text-sm">
                        Preco God (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.armorPriceGod}
                        onChange={(e) => setF({ armorPriceGod: e.target.value })}
                        className="bg-muted border-border"
                      />
                    </div>
                    <EnchantList
                      label="Encantamentos God"
                      enchants={form.armorEnchantsGod}
                      onChange={(v) => setF({ armorEnchantsGod: v })}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {form.configType === "book" && (
              <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Configuracao de Livro
                </p>
                <p className="text-xs text-muted-foreground">
                  O comprador escolhe qualquer encantamento na hora de montar o kit.
                  Defina o preco cobrado por nivel de encantamento.
                </p>
                <div>
                  <Label className="text-foreground mb-1.5 block text-sm">
                    Preco por nivel (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.bookPricePerLevel}
                    onChange={(e) => setF({ bookPricePerLevel: e.target.value })}
                    className="bg-muted border-border w-40"
                    placeholder="ex: 2.50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemplo: Afiacao V = 5 niveis x R$ {parseFloat(form.bookPricePerLevel || "0").toFixed(2)} = R$ {(5 * parseFloat(form.bookPricePerLevel || "0")).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {form.configType === "tool" && (
              <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Configuracao de Ferramenta / Arma
                </p>
                <p className="text-xs text-muted-foreground">
                  Fixado em 1 por slot. O usuario escolhe os encantamentos e niveis na hora de montar o kit.
                </p>
                <ToolEnchantList
                  enchants={form.toolEnchants}
                  onChange={(v) => setF({ toolEnchants: v })}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setF({ active: v })}
              />
              <Label className="text-foreground">Item ativo</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={upsertKitItem.isPending}
                className="flex-1"
              >
                {upsertKitItem.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingId ? "Salvar" : "Criar Item"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
