import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, Plus, Pencil, Trash2, Package, GripVertical, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parseProductImages } from "@/lib/productImages";

type ProductForm = {
  categoryId: string;
  name: string;
  description: string;
  kitContents: string;
  price: string;
  stock: string;
  imageUrl: string;      // foto principal
  kitImages: string[];   // fotos do kit (thumbnails)
  commands: string;
  active: boolean;
};

const emptyForm: ProductForm = {
  categoryId: "",
  name: "",
  description: "",
  kitContents: "",
  price: "",
  stock: "-1",
  imageUrl: "",
  kitImages: [],
  commands: "",
  active: true,
};

type Product = NonNullable<ReturnType<typeof trpc.admin.getProducts.useQuery>["data"]>[0];

function SortableProduct({
  product,
  onEdit,
  onDelete,
  formatPrice,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (id: number) => void;
  formatPrice: (v: string | number) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-4 p-4 rounded-lg bg-card border border-border ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {(() => {
          const { main } = parseProductImages(product.imageUrl);
          return main ? (
            <img src={main} alt={product.name} className="h-full w-full object-cover rounded-lg" />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          );
        })()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">{product.name}</p>
          {!product.active && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
          )}
        </div>
        <p className="text-sm text-primary font-bold">{formatPrice(product.price)}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(product.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminProducts() {
  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.admin.getProducts.useQuery();
  const { data: categories } = trpc.admin.getCategories.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");

  const reorderProducts = trpc.admin.reorderProducts.useMutation({
    onSuccess: () => utils.admin.getProducts.invalidate(),
    onError: () => toast.error("Erro ao salvar ordem."),
  });

  const sensors = useSensors(useSensor(PointerSensor));

  const orderedProducts = (() => {
    if (!products) return [];
    if (!localOrder) return products;
    return [...products].sort((a, b) => localOrder.indexOf(a.id) - localOrder.indexOf(b.id));
  })();

  const displayedProducts = filterCategoryId === "all"
    ? orderedProducts
    : orderedProducts.filter((p) => String(p.categoryId) === filterCategoryId);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = orderedProducts.map((p) => p.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    setLocalOrder(newOrder);
    reorderProducts.mutate({ orderedIds: newOrder });
  };

  const createProduct = trpc.admin.createProduct.useMutation({
    onSuccess: () => {
      utils.admin.getProducts.invalidate();
      utils.admin.getDashboard.invalidate();
      setLocalOrder(null);
      setDialogOpen(false);
      toast.success("Produto criado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProduct = trpc.admin.updateProduct.useMutation({
    onSuccess: () => {
      utils.admin.getProducts.invalidate();
      setDialogOpen(false);
      toast.success("Produto atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => {
      utils.admin.getProducts.invalidate();
      utils.admin.getDashboard.invalidate();
      setLocalOrder(null);
      toast.success("Produto removido.");
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: NonNullable<typeof products>[0]) => {
    setEditingId(p.id);
    const kitArr: string[] = (() => {
      try { return p.kitContents ? JSON.parse(p.kitContents) : []; } catch { return []; }
    })();
    const cmdArr: string[] = (() => {
      try { return p.commands ? JSON.parse(p.commands) : []; } catch { return []; }
    })();
    // Parse imageUrl: JSON { main, kitImages } or plain string
    let mainUrl = p.imageUrl ?? "";
    let kitImgs: string[] = [];
    if (p.imageUrl) {
      try {
        const parsed = JSON.parse(p.imageUrl);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          mainUrl = parsed.main ?? "";
          kitImgs = Array.isArray(parsed.kitImages) ? parsed.kitImages.filter(Boolean) : [];
        }
      } catch {}
    }
    setForm({
      categoryId: String(p.categoryId),
      name: p.name,
      description: p.description ?? "",
      kitContents: kitArr.join("\n"),
      price: String(p.price),
      stock: String(p.stock),
      imageUrl: mainUrl,
      kitImages: kitImgs,
      commands: cmdArr.join("\n"),
      active: p.active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kitContentsJson = form.kitContents.trim()
      ? JSON.stringify(form.kitContents.split("\n").map((s) => s.trim()).filter(Boolean))
      : undefined;
    const commandsJson = form.commands.trim()
      ? JSON.stringify(form.commands.split("\n").map((s) => s.trim()).filter(Boolean))
      : undefined;

    // Serialize imageUrl: if kit images exist, store as JSON { main, kitImages }
    const validKitImages = form.kitImages.map((u) => u.trim()).filter(Boolean);
    const imageUrl = validKitImages.length > 0
      ? JSON.stringify({ main: form.imageUrl.trim() || null, kitImages: validKitImages })
      : form.imageUrl.trim() || undefined;

    if (editingId) {
      updateProduct.mutate({
        id: editingId,
        categoryId: parseInt(form.categoryId),
        name: form.name,
        description: form.description || undefined,
        kitContents: kitContentsJson,
        price: form.price,
        stock: parseInt(form.stock),
        imageUrl,
        commands: commandsJson,
        active: form.active,
      });
    } else {
      createProduct.mutate({
        categoryId: parseInt(form.categoryId),
        name: form.name,
        description: form.description || undefined,
        kitContents: kitContentsJson,
        price: form.price,
        stock: parseInt(form.stock),
        imageUrl,
        commands: commandsJson,
        active: form.active,
      });
    }
  };

  const formatPrice = (v: string | number) =>
    `R$ ${parseFloat(String(v)).toFixed(2).replace(".", ",")}`;

  return (
    <AdminLayout title="Produtos">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Produtos
          </h2>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategoryId("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterCategoryId === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategoryId(String(cat.id))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterCategoryId === String(cat.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filterCategoryId === "all" ? (
          // Grouped by category
          <div className="space-y-6">
            {categories?.map((cat) => {
              const catProducts = orderedProducts.filter((p) => p.categoryId === cat.id);
              if (catProducts.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">{cat.name}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">{catProducts.length} produto{catProducts.length !== 1 ? "s" : ""}</span>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={orderedProducts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {catProducts.map((product) => (
                          <SortableProduct
                            key={product.id}
                            product={product}
                            formatPrice={formatPrice}
                            onEdit={openEdit}
                            onDelete={(id) => {
                              if (confirm("Remover produto?")) deleteProduct.mutate({ id });
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              );
            })}
            {/* Products with no matching category */}
            {(() => {
              const catIds = new Set(categories?.map((c) => c.id) ?? []);
              const orphans = orderedProducts.filter((p) => !catIds.has(p.categoryId));
              if (orphans.length === 0) return null;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sem categoria</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {orphans.map((product) => (
                      <SortableProduct
                        key={product.id}
                        product={product}
                        formatPrice={formatPrice}
                        onEdit={openEdit}
                        onDelete={(id) => {
                          if (confirm("Remover produto?")) deleteProduct.mutate({ id });
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          // Filtered by single category — with drag to reorder
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedProducts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {displayedProducts.map((product) => (
                  <SortableProduct
                    key={product.id}
                    product={product}
                    formatPrice={formatPrice}
                    onEdit={openEdit}
                    onDelete={(id) => {
                      if (confirm("Remover produto?")) deleteProduct.mutate({ id });
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Categoria *</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-muted border-border"
                required
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-muted border-border resize-none"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">
                Conteúdo do Kit (um item por linha)
              </Label>
              <Textarea
                value={form.kitContents}
                onChange={(e) => setForm({ ...form, kitContents: e.target.value })}
                className="bg-muted border-border resize-none font-mono text-sm"
                rows={4}
                placeholder={"Espada de ferro\n32x Pão\n5x Poção de Cura"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground mb-1.5 block">Preço (R$) *</Label>
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
                <Label className="text-foreground mb-1.5 block">Estoque (-1 = ilimitado)</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Foto Principal do Produto</Label>
              <div className="flex gap-2 items-center">
                <div className="h-10 w-10 rounded-lg bg-muted border border-border shrink-0 overflow-hidden flex items-center justify-center">
                  {form.imageUrl.trim() ? (
                    <img src={form.imageUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <Input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="bg-muted border-border flex-1"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Fotos do Kit (thumbnails clicáveis)</Label>
              <div className="space-y-2">
                {form.kitImages.map((url, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="h-10 w-10 rounded-lg bg-muted border border-primary/40 shrink-0 overflow-hidden flex items-center justify-center">
                      {url.trim() ? (
                        <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <Input
                      value={url}
                      onChange={(e) => {
                        const next = [...form.kitImages];
                        next[i] = e.target.value;
                        setForm({ ...form, kitImages: next });
                      }}
                      className="bg-muted border-border flex-1"
                      placeholder="https://..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => {
                        const next = form.kitImages.filter((_, idx) => idx !== i);
                        setForm({ ...form, kitImages: next });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setForm({ ...form, kitImages: [...form.kitImages, ""] })}
                >
                  <Plus className="h-3 w-3" /> Adicionar foto do kit
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Comandos Minecraft (um por linha)</Label>
              <Textarea
                value={form.commands}
                onChange={(e) => setForm({ ...form, commands: e.target.value })}
                className="bg-muted border-border resize-none font-mono text-xs"
                rows={3}
                placeholder={'/execute as {player} at @s run structure load kitdima ~ ~ ~\n/give {player} diamond_sword\n/effect {player} speed 300 2'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {'{player}'} para substituir pelo nickname do jogador
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label className="text-foreground">Produto ativo</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="flex-1">
                {(createProduct.isPending || updateProduct.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingId ? "Salvar" : "Criar Produto"}
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
