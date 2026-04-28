import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, RotateCcw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  EXPERTISE_CATEGORIES,
  useCreateExpertise,
  useExpertises,
  useUpdateExpertise,
} from '@/hooks/useExpertises';

const ALL = '__all__';

export function AgencyTagsTab() {
  const { data: expertises = [], isLoading } = useExpertises();
  const updateMut = useUpdateExpertise();
  const createMut = useCreateExpertise();

  const [filter, setFilter] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newCategorie, setNewCategorie] = useState<string>('Autre');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of expertises) c[e.categorie] = (c[e.categorie] || 0) + 1;
    return c;
  }, [expertises]);

  const filtered = useMemo(() => {
    return expertises
      .filter((e) => filter === ALL || e.categorie === filter)
      .filter((e) =>
        search.trim() ? e.nom.toLowerCase().includes(search.trim().toLowerCase()) : true
      );
  }, [expertises, filter, search]);

  const handleAdd = async () => {
    if (!newNom.trim()) return;
    await createMut.mutateAsync({ nom: newNom, categorie: newCategorie });
    setNewNom('');
    setNewCategorie('Autre');
    setAddOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Expertises</CardTitle>
            <CardDescription>
              Référentiel administrable des expertises agences ({expertises.length} au total)
            </CardDescription>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une expertise
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes ({expertises.length})</SelectItem>
                {EXPERTISE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat} ({counts[cat] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune expertise trouvée.
            </div>
          ) : (
            <div className="border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="w-64">Catégorie</TableHead>
                    <TableHead className="w-24 text-center">Actif</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id} className={!e.actif ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">
                        {e.nom}
                        {!e.actif && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={e.categorie}
                          onValueChange={(v) =>
                            updateMut.mutate({ id: e.id, patch: { categorie: v } })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPERTISE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={e.actif}
                          onCheckedChange={(checked) =>
                            updateMut.mutate({ id: e.id, patch: { actif: checked } })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {e.actif ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              updateMut.mutate({ id: e.id, patch: { actif: false } })
                            }
                            title="Désactiver"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              updateMut.mutate({ id: e.id, patch: { actif: true } })
                            }
                            title="Réactiver"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une expertise</DialogTitle>
            <DialogDescription>
              Cette expertise sera proposée dans la sélection sur les fiches agences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={newNom}
                onChange={(e) => setNewNom(e.target.value)}
                placeholder="Ex : Branding, SEO local…"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={newCategorie} onValueChange={setNewCategorie}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERTISE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={!newNom.trim() || createMut.isPending}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
