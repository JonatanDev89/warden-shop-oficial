import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, Pencil, Trash2, Tag, GripVertical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Category = { id: number; name: string; description?: string | null; imageUrl?: string | null; createdAt: Date };

function SortableCategory({
  cat,
  onEdit,
  onDelete,
}: {
  cat: Category;
  onEdit: (c: Category) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
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
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Tag className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{cat.name}</p>
        {cat.description && (
          <p className="text-sm text-muted-foreground truncate">{cat.description}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(cat)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(cat.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.admin.getCategories.useQuery();
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const createCategory = trpc.admin.createCategory.useMutation({
    onSuccess: () => {
      utils.admin.getCategories.invalidate();
      utils.admin.getDashboard.invalidate();
      setLocalOrder(null);
      setDialogOpen(false);
      toast.success("Categoria criada!");
    },
  });

  const updateCategory = trpc.admin.updateCategory.useMutation({
    onSuccess: () => {
      utils.admin.getCategories.invalidate();
      setDialogOpen(false);
      toast.success("Categoria atualizada!");
    },
  });

  const deleteCategory = trpc.admin.deleteCategory.useMutation({
    onSuccess: () => {
      utils.admin.getCategories.invalidate();
      utils.admin.getDashboard.invalidate();
      setLocalOrder(null);
      toast.success("Categoria removida.");
    },
  });

  const reorderCategories = trpc.admin.reorderCategories.useMutation({
    onSuccess: () => utils.admin.getCategories.invalidate(),
    onError: () => toast.error("Erro ao salvar ordem."),
  });

  const sensors = useSensors(useSensor(PointerSensor));

  const orderedCategories = (() => {
    if (!categories) return [];
    if (!localOrder) return categories;
    return [...categories].sort((a, b) => localOrder.indexOf(a.id) - localOrder.indexOf(b.id));
  })();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = orderedCategories.map((c) => c.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    setLocalOrder(newOrder);
    reorderCategories.mutate({ orderedIds: newOrder });
  };

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setImageUrl("");
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description ?? "");
    setImageUrl(c.imageUrl ?? "");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateCategory.mutate({ id: editingId, name, description: description || undefined, imageUrl: imageUrl || undefined });
    } else {
      createCategory.mutate({ name, description: description || undefined, imageUrl: imageUrl || undefined });
    }
  };

  return (
    <AdminLayout title="Categorias">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Categorias
          </h2>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderedCategories.map((cat) => (
                  <SortableCategory
                    key={cat.id}
                    cat={cat}
                    onEdit={openEdit}
                    onDelete={(id) => {
                      if (confirm("Remover categoria?")) deleteCategory.mutate({ id });
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-muted border-border" required />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-muted border-border resize-none" rows={3} />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">URL da Imagem</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://exemplo.com/imagem.png" className="bg-muted border-border" />
              {imageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-border h-32">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending} className="flex-1">
                {editingId ? "Salvar" : "Criar"}
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
