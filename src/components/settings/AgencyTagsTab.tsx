import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  'Communication',
  'Événementiel',
  'Digital & Web',
  'Création & Production',
  'Data & Performance',
  'Formations',
  'Ressources déportées',
  'Autre',
] as const;

const NONE_VALUE = '__none__';

interface AgencyTag {
  id: string;
  name: string;
  color: string;
  categorie: string | null;
  created_at: string;
  updated_at: string;
}

export function AgencyTagsTab() {
  const [tags, setTags] = useState<AgencyTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [newTagCategorie, setNewTagCategorie] = useState<string>(NONE_VALUE);
  const [editingTag, setEditingTag] = useState<AgencyTag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteTag, setDeleteTag] = useState<AgencyTag | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('Erreur lors du chargement des tags');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Le nom du tag est requis');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('agency_tags')
        .insert({
          name: newTagName.trim(),
          color: newTagColor,
          categorie: newTagCategorie === NONE_VALUE ? null : newTagCategorie,
        });

      if (error) throw error;

      toast.success('Tag ajouté avec succès');
      setNewTagName('');
      setNewTagColor('#6366f1');
      setNewTagCategorie(NONE_VALUE);
      fetchTags();
    } catch (error: any) {
      console.error('Error adding tag:', error);
      if (error.code === '23505') {
        toast.error('Ce tag existe déjà');
      } else {
        toast.error('Erreur lors de l\'ajout du tag');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateCategorie = async (tag: AgencyTag, value: string) => {
    const newCategorie = value === NONE_VALUE ? null : value;
    // Optimistic update
    setTags((prev) =>
      prev.map((t) => (t.id === tag.id ? { ...t, categorie: newCategorie } : t))
    );
    try {
      const { error } = await supabase
        .from('agency_tags')
        .update({ categorie: newCategorie })
        .eq('id', tag.id);
      if (error) throw error;
      toast.success('Catégorie mise à jour');
    } catch (error) {
      console.error('Error updating categorie:', error);
      toast.error('Erreur lors de la mise à jour');
      fetchTags();
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('agency_tags')
        .update({
          name: editName.trim(),
          color: editColor,
        })
        .eq('id', editingTag.id);

      if (error) throw error;

      toast.success('Tag modifié avec succès');
      setEditingTag(null);
      fetchTags();
    } catch (error: any) {
      console.error('Error updating tag:', error);
      if (error.code === '23505') {
        toast.error('Ce tag existe déjà');
      } else {
        toast.error('Erreur lors de la modification du tag');
      }
    }
  };

  const handleDeleteTag = async () => {
    if (!deleteTag) return;

    try {
      const { error } = await supabase
        .from('agency_tags')
        .delete()
        .eq('id', deleteTag.id);

      if (error) throw error;

      toast.success('Tag supprimé avec succès');
      setDeleteTag(null);
      fetchTags();
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Erreur lors de la suppression du tag');
    }
  };

  const startEdit = (tag: AgencyTag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  };

  const getTagColor = (color: string): string => {
    // Convert hex to HSL format for consistent display
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tags d'agence</CardTitle>
          <CardDescription>
            Gérez les tags prédéfinis pour catégoriser vos agences partenaires
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Ajouter un nouveau tag</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nom du tag (ex: Influence, Site vitrine...)"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1"
              />
              <Input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-20"
              />
              <Select value={newTagCategorie} onValueChange={setNewTagCategorie}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— Aucune —</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddTag} disabled={adding || !newTagName.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Tags existants ({tags.length})</Label>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Aucun tag défini. Ajoutez votre premier tag ci-dessus.
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card"
                  >
                    {editingTag?.id === tag.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-20"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleUpdateTag}
                          disabled={!editName.trim()}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge
                          style={{
                            backgroundColor: `hsl(${getTagColor(tag.color)} / 0.15)`,
                            color: `hsl(${getTagColor(tag.color)})`,
                            borderColor: `hsl(${getTagColor(tag.color)} / 0.3)`,
                          }}
                          className="border flex-1"
                        >
                          {tag.name}
                        </Badge>
                        <Select
                          value={tag.categorie ?? NONE_VALUE}
                          onValueChange={(value) => handleUpdateCategorie(tag, value)}
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Catégorie" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>— Aucune —</SelectItem>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(tag)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteTag(tag)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTag} onOpenChange={() => setDeleteTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce tag ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le tag "{deleteTag?.name}" ? 
              Les agences utilisant ce tag le conserveront, mais il ne sera plus disponible pour de nouvelles agences.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
