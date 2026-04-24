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
import { Loader2, Plus, Pencil, Trash2, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ItemForm = {
  minecraftId: string;
  name: string;
  price: string;
  maxPerSlot: string;
  active: boolean;
};

const emptyForm: ItemForm = {
  minecraftId: "",
  name: "",
  price: "0",
  maxPerSlot: "64",
  active: true,
};

function itemTexture(minecraftId: string) {
  return `https://minecraft-inventory.s7a.dev/items/${minecraftId}.png`;
}

// Warden Craft kit items with prices
const COMMON_ITEMS = [
  { minecraftId: "netherite_sword",          name: "Qualquer Item Full",           price: "3.00", maxPerSlot: 1  },
  { minecraftId: "golden_apple",             name: "Pack Maçã Dourada",            price: "3.00", maxPerSlot: 64 },
  { minecraftId: "shulker_shell",            name: "16 Cascos Shulker",            price: "3.00", maxPerSlot: 16 },
  { minecraftId: "smithing_template",        name: "Molde de Atualização",         price: "2.00", maxPerSlot: 1  },
  { minecraftId: "end_crystal",              name: "Pack Cristal do End",          price: "2.00", maxPerSlot: 64 },
  { minecraftId: "elytra",                   name: "Elytra",                       price: "2.00", maxPerSlot: 1  },
  { minecraftId: "iron_ingot",               name: "Pack de Ferro",                price: "1.00", maxPerSlot: 64 },
  { minecraftId: "gold_ingot",               name: "Pack de Ouro",                 price: "1.00", maxPerSlot: 64 },
  { minecraftId: "tnt",                      name: "Pack TNT",                     price: "1.00", maxPerSlot: 64 },
  { minecraftId: "obsidian",                 name: "Pack Obsidiana",               price: "1.00", maxPerSlot: 64 },
  { minecraftId: "cobweb",                   name: "Pack Teia",                    price: "1.00", maxPerSlot: 64 },
  { minecraftId: "spawner",                  name: "1 Spawner",                    price: "1.00", maxPerSlot: 1  },
  { minecraftId: "chiseled_stone_bricks",    name: "Moldes Normais",               price: "1.00", maxPerSlot: 64 },
  { minecraftId: "brown_mushroom",           name: "Pack Fungos",                  price: "1.00", maxPerSlot: 64 },
  { minecraftId: "wither_skeleton_skull",    name: "Cabeça de Mob",                price: "1.00", maxPerSlot: 1  },
  { minecraftId: "blaze_powder",             name: "Pack de Pó de Chamas",         price: "1.00", maxPerSlot: 64 },
  { minecraftId: "wind_charge",              name: "Pack Carga de Vento",          price: "1.00", maxPerSlot: 64 },
  { minecraftId: "coal",                     name: "Pack de Carvão",               price: "0.75", maxPerSlot: 64 },
  { minecraftId: "stone",                    name: "Pack Blocos de Construção",    price: "0.75", maxPerSlot: 64 },
  { minecraftId: "blaze_rod",                name: "Pack Vara de Blaze",           price: "1.50", maxPerSlot: 64 },
  { minecraftId: "enchanted_book",           name: "Livro Encantado",              price: "0.50", maxPerSlot: 1  },
  { minecraftId: "firework_rocket",          name: "Pack Fogos",                   price: "0.50", maxPerSlot: 64 },
  { minecraftId: "experience_bottle",        name: "Pack XP",                      price: "0.50", maxPerSlot: 64 },
  { minecraftId: "netherite_ingot",          name: "Barra Netherite",              price: "0.50", maxPerSlot: 64 },
  { minecraftId: "totem_of_undying",         name: "Totem",                        price: "0.50", maxPerSlot: 1  },
  { minecraftId: "enchanted_golden_apple",   name: "Maçã Encantada",               price: "0.25", maxPerSlot: 64 },
  { minecraftId: "potion",                   name: "Qualquer Poção",               price: "0.25", maxPerSlot: 1  },
];

export default function AdminKitItems() {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.admin.getKitItems.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null); // minecraftId being edited

  const upsert = trpc.admin.upsertKitItem.useMutation({
    onSuccess: () => {
      utils.admin.getKitItems.invalidate();
      setDialogOpen(false);
      toast.success("Item salvo!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteItem = trpc.admin.deleteKitItem.useMutation({
    onSuccess: () => {
      utils.admin.getKitItems.invalidate();
      toast.success("Item removido.");
    },
  });

  const openCreate = (preset?: { minecraftId: string; name: string; price?: string; maxPerSlot?: number }) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      minecraftId: preset?.minecraftId ?? "",
      name: preset?.name ?? "",
      price: preset?.price ?? "0",
      maxPerSlot: String(preset?.maxPerSlot ?? 64),
    });
    setDialogOpen(true);
  };

  const openEdit = (item: (typeof items)[0]) => {
    setEditingId(item.minecraftId);
    setForm({
      minecraftId: item.minecraftId,
      name: item.name,
      price: String(item.price),
      maxPerSlot: String(item.maxPerSlot),
      active: item.active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsert.mutate({
      minecraftId: form.minecraftId.trim().toLowerCase().replace(/\s+/g, "_"),
      name: form.name.trim(),
      price: form.price,
      maxPerSlot: parseInt(form.maxPerSlot) || 64,
      active: form.active,
    });
  };

  const formatPrice = (v: string | number) =>
    `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;

  return (
    <AdminLayout title="Itens do Kit">
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Itens do Kit
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure os itens disponíveis e o preço por unidade para o "Monte seu Kit".
            </p>
          </div>
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Item
          </Button>
        </div>

        {/* Quick add common items */}
        <div className="border border-border rounded-xl bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Adicionar item comum rapidamente:</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_ITEMS.filter(c => !items.find(i => i.minecraftId === c.minecraftId)).map((c) => (
              <button
                key={c.minecraftId}
                onClick={() => openCreate(c)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-primary/10 border border-border hover:border-primary transition-all text-xs"
              >
                <img
                  src={itemTexture(c.minecraftId)}
                  alt={c.name}
                  className="h-5 w-5 object-contain"
                  style={{ imageRendering: "pixelated" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {c.name}
                <span className="text-primary font-bold ml-1">R${c.price}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Items list */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum item cadastrado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
              >
                <div className="h-10 w-10 bg-[#8b8b8b] rounded-sm flex items-center justify-center shrink-0 border-2 border-[#555]">
                  <img
                    src={itemTexture(item.minecraftId)}
                    alt={item.name}
                    className="h-8 w-8 object-contain"
                    style={{ imageRendering: "pixelated" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                    {!item.active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{item.minecraftId}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{formatPrice(item.price)}</p>
                  <p className="text-xs text-muted-foreground">max {item.maxPerSlot}/slot</p>
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
                      if (confirm(`Remover "${item.name}"?`)) deleteItem.mutate({ id: item.id });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Item" : "Novo Item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">ID do Minecraft *</Label>
              <div className="flex gap-2 items-center">
                <div className="h-10 w-10 bg-[#8b8b8b] rounded-sm flex items-center justify-center shrink-0 border-2 border-[#555]">
                  <img
                    src={itemTexture(form.minecraftId)}
                    alt=""
                    className="h-8 w-8 object-contain"
                    style={{ imageRendering: "pixelated" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <Input
                  value={form.minecraftId}
                  onChange={(e) => setForm({ ...form, minecraftId: e.target.value })}
                  className="bg-muted border-border font-mono text-sm"
                  placeholder="diamond_sword"
                  disabled={!!editingId}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use o ID exato do Minecraft (ex: diamond_sword, bread, arrow)
              </p>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Nome exibido *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-muted border-border"
                placeholder="Espada de Diamante"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground mb-1.5 block">Preço por unidade (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="bg-muted border-border"
                  required
                />
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Máx. por slot</Label>
                <Input
                  type="number"
                  min="1"
                  max="64"
                  value={form.maxPerSlot}
                  onChange={(e) => setForm({ ...form, maxPerSlot: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label className="text-foreground">Item ativo</Label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={upsert.isPending} className="flex-1">
                {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
