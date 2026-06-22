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
  Egg,
  FlaskConical,
  Hammer,
} from "lucide-react";
import { toast } from "sonner";
import {
  ALL_ENCHANTS,
  type EnchantEntry,
  type ToolEnchantOption,
  type GenericOption,
} from "@/lib/kitEnchants";
import { getItemTexture } from "@/lib/minecraftTextures";

type KitItem = NonNullable<ReturnType<typeof trpc.admin.getKitItems.useQuery>["data"]>[0];
type ConfigType = "none" | "armor" | "book" | "tool" | "egg" | "potion" | "trim";

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
  eggOptions: GenericOption[];
  potionOptions: GenericOption[];
  trimOptions: GenericOption[];
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
  eggOptions: [],
  potionOptions: [],
  trimOptions: [],
};

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
  if (form.configType === "egg") {
    return JSON.stringify({
      type: "egg",
      options: form.eggOptions,
    });
  }
  if (form.configType === "potion") {
    return JSON.stringify({
      type: "potion",
      options: form.potionOptions,
    });
  }
  if (form.configType === "trim") {
    return JSON.stringify({
      type: "trim",
      options: form.trimOptions,
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
    eggOptions: [],
    potionOptions: [],
    trimOptions: [],
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
        base.bookPricePerLevel = cfg.pricePerLevel ?? "0";
      } else if (cfg?.type === "tool") {
        base.configType = "tool";
        base.toolEnchants = cfg.enchants ?? [];
      } else if (cfg?.type === "egg") {
        base.configType = "egg";
        base.eggOptions = cfg.options ?? [];
      } else if (cfg?.type === "potion") {
        base.configType = "potion";
        base.potionOptions = cfg.options ?? [];
      } else if (cfg?.type === "trim") {
        base.configType = "trim";
        base.trimOptions = cfg.options ?? [];
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

function GenericOptionList({
  label,
  options,
  onChange,
  idPlaceholder = "minecraft_id",
}: {
  label: string;
  options: GenericOption[];
  onChange: (v: GenericOption[]) => void;
  idPlaceholder?: string;
}) {
  const [addId, setAddId] = useState("");
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("0");

  const add = () => {
    if (!addId || !addName) return;
    onChange([...options, { id: addId, name: addName, price: addPrice }]);
    setAddId("");
    setAddName("");
    setAddPrice("0");
  };

  const remove = (id: string) => onChange(options.filter((o) => o.id !== id));

  return (
    <div className="space-y-2">
      <Label className="text-foreground text-sm">{label}</Label>
      <div className="space-y-1">
        {options.map((o) => (
          <div key={o.id} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
            <div className="h-6 w-6 shrink-0 flex items-center justify-center">
               <img src={getItemTexture(o.id)} alt="" className="h-5 w-5 object-contain" />
            </div>
            <span className="flex-1 text-sm text-foreground truncate">{o.name}</span>
            <span className="text-xs text-primary font-bold">R$ {parseFloat(o.price).toFixed(2)}</span>
            <button
              type="button"
              onClick={() => remove(o.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-border pt-2">
        <Input
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          placeholder={idPlaceholder}
          className="h-8 text-xs bg-muted border-border"
        />
        <div className="flex gap-2">
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Nome amigável"
            className="h-8 text-xs bg-muted border-border flex-1"
          />
          <Input
            type="number"
            step="0.01"
            value={addPrice}
            onChange={(e) => setAddPrice(e.target.value)}
            className="h-8 text-xs bg-muted border-border w-20"
          />
          <Button type="button" size="sm" variant="outline" onClick={add} className="h-8 px-2">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
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

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Itens do Kit</h1>
            <p className="text-muted-foreground">Gerencie os itens disponíveis no construtor de kits.</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Item
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items?.map((item) => (
              <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex gap-4">
                <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <img
                    src={getItemTexture(item.minecraftId, item.imageUrl)}
                    alt={item.name}
                    className="h-12 w-12 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                    {!item.active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 truncate">{item.minecraftId}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{formatPrice(item.price)}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja remover este item?")) {
                            deleteKitItem.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Item" : "Novo Item do Kit"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs value={form.configType} onValueChange={(v) => setForm({ ...form, configType: v as ConfigType })}>
                <TabsList className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-muted p-1 h-auto">
                  <TabsTrigger value="none" className="text-xs py-2">
                    <Package className="h-3 w-3 mr-1" /> Simples
                  </TabsTrigger>
                  <TabsTrigger value="armor" className="text-xs py-2">
                    <Shield className="h-3 w-3 mr-1" /> Armadura
                  </TabsTrigger>
                  <TabsTrigger value="book" className="text-xs py-2">
                    <BookOpen className="h-3 w-3 mr-1" /> Livro
                  </TabsTrigger>
                  <TabsTrigger value="tool" className="text-xs py-2">
                    <Wrench className="h-3 w-3 mr-1" /> Ferramenta
                  </TabsTrigger>
                  <TabsTrigger value="egg" className="text-xs py-2">
                    <Egg className="h-3 w-3 mr-1" /> Ovos
                  </TabsTrigger>
                  <TabsTrigger value="potion" className="text-xs py-2">
                    <FlaskConical className="h-3 w-3 mr-1" /> Poções
                  </TabsTrigger>
                  <TabsTrigger value="trim" className="text-xs py-2">
                    <Hammer className="h-3 w-3 mr-1" /> Moldes
                  </TabsTrigger>
                </TabsList>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome do Item</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Espada de Netherite"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ID do Minecraft</Label>
                    <Input
                      value={form.minecraftId}
                      onChange={(e) => setForm({ ...form, minecraftId: e.target.value })}
                      placeholder="Ex: netherite_sword"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço Base</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL da Imagem (Opcional)</Label>
                    <Input
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={form.active}
                        onCheckedChange={(v) => setForm({ ...form, active: v })}
                      />
                      <Label>Ativo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={form.pricePerUnit}
                        onCheckedChange={(v) => setForm({ ...form, pricePerUnit: v })}
                      />
                      <Label>Preço por Unidade</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Min por Slot</Label>
                      <Input
                        type="number"
                        value={form.minPerSlot}
                        onChange={(e) => setForm({ ...form, minPerSlot: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max por Slot</Label>
                      <Input
                        type="number"
                        value={form.maxPerSlot}
                        onChange={(e) => setForm({ ...form, maxPerSlot: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <TabsContent value="armor" className="space-y-4 mt-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Preço Full</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.armorPriceFull}
                        onChange={(e) => setForm({ ...form, armorPriceFull: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço God</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.armorPriceGod}
                        onChange={(e) => setForm({ ...form, armorPriceGod: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <EnchantList
                      label="Encantamentos Full"
                      enchants={form.armorEnchantsFull}
                      onChange={(v) => setForm({ ...form, armorEnchantsFull: v })}
                    />
                    <EnchantList
                      label="Encantamentos God"
                      enchants={form.armorEnchantsGod}
                      onChange={(v) => setForm({ ...form, armorEnchantsGod: v })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="book" className="space-y-4 mt-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Preço por Nível de Encantamento</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.bookPricePerLevel}
                      onChange={(e) => setForm({ ...form, bookPricePerLevel: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      O comprador poderá escolher qualquer encantamento. O preço será: nível x este valor.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="tool" className="mt-4 border-t pt-4">
                  <ToolEnchantList
                    enchants={form.toolEnchants}
                    onChange={(v) => setForm({ ...form, toolEnchants: v })}
                  />
                </TabsContent>

                <TabsContent value="egg" className="mt-4 border-t pt-4">
                  <GenericOptionList
                    label="Opções de Ovos"
                    options={form.eggOptions}
                    onChange={(v) => setForm({ ...form, eggOptions: v })}
                    idPlaceholder="creeper_spawn_egg"
                  />
                </TabsContent>

                <TabsContent value="potion" className="mt-4 border-t pt-4">
                  <GenericOptionList
                    label="Opções de Poções"
                    options={form.potionOptions}
                    onChange={(v) => setForm({ ...form, potionOptions: v })}
                    idPlaceholder="potion ou splash_potion"
                  />
                </TabsContent>

                <TabsContent value="trim" className="mt-4 border-t pt-4">
                  <GenericOptionList
                    label="Opções de Moldes"
                    options={form.trimOptions}
                    onChange={(v) => setForm({ ...form, trimOptions: v })}
                    idPlaceholder="coast_armor_trim_smithing_template"
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={upsertKitItem.isPending}>
                  {upsertKitItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingId ? "Salvar Alterações" : "Criar Item"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
