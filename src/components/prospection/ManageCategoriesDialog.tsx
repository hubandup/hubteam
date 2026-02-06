import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProspectCategories,
  useCreateProspectCategory,
  useDeleteProspectCategory,
} from '@/hooks/useProspectCategories';

interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#e11d48',
];

export function ManageCategoriesDialog({ open, onOpenChange }: ManageCategoriesDialogProps) {
  const { data: categories = [] } = useProspectCategories();
  const createCategory = useCreateProspectCategory();
  const deleteCategory = useDeleteProspectCategory();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Veuillez saisir un nom');
      return;
    }
    try {
      await createCategory.mutateAsync({ name: newName.trim(), color: newColor });
      toast.success('Catégorie ajoutée');
      setNewName('');
      setNewColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
    } catch {
      toast.error('Erreur : cette catégorie existe peut-être déjà');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast.success(`Catégorie "${name}" supprimée`);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gérer les catégories</DialogTitle>
          <DialogDescription>Ajoutez ou supprimez des catégories de prospects.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Add form */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nouvelle catégorie</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de la catégorie"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Couleur</Label>
              <Input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
            </div>
            <Button onClick={handleAdd} disabled={createCategory.isPending} size="sm" className="h-9">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Category list */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2 rounded-md border bg-card"
              >
                <Badge
                  className="text-xs font-medium"
                  style={{
                    backgroundColor: `${cat.color}20`,
                    color: cat.color,
                    borderColor: `${cat.color}40`,
                  }}
                >
                  {cat.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(cat.id, cat.name)}
                  disabled={deleteCategory.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune catégorie</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
