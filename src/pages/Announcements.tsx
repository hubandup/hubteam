import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Megaphone, Users, User, Globe } from 'lucide-react';
import { RichTextEditor } from '@/components/faq/RichTextEditor';
import { createSafeHtml } from '@/lib/sanitize';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Navigate } from 'react-router-dom';

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience_type: 'all' | 'role' | 'users';
  target_roles: string[] | null;
  target_user_ids: string[] | null;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  created_by: string | null;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'team', label: 'Équipe' },
  { value: 'client', label: 'Client' },
  { value: 'agency', label: 'Agence' },
];

export default function Announcements() {
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'role' | 'users'>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  if (!isAdmin) return <Navigate to="/" replace />;

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (ann: Record<string, any>) => {
      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(ann as any)
          .eq('id', editingAnnouncement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({ ...ann, created_by: user?.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements-admin'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
      toast.success(editingAnnouncement ? 'Annonce modifiée' : 'Annonce créée');
      closeDialog();
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements-admin'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
      toast.success('Annonce supprimée');
      setDeleteId(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('announcements').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements-admin'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
    },
  });

  function openCreateDialog() {
    setEditingAnnouncement(null);
    setTitle('');
    setContent('');
    setAudienceType('all');
    setSelectedRoles([]);
    setSelectedUserIds([]);
    setActive(true);
    setStartsAt(new Date().toISOString().slice(0, 16));
    setEndsAt('');
    setDialogOpen(true);
  }

  function openEditDialog(ann: Announcement) {
    setEditingAnnouncement(ann);
    setTitle(ann.title);
    setContent(ann.content);
    setAudienceType(ann.audience_type);
    setSelectedRoles(ann.target_roles || []);
    setSelectedUserIds(ann.target_user_ids || []);
    setActive(ann.active);
    setStartsAt(ann.starts_at ? new Date(ann.starts_at).toISOString().slice(0, 16) : '');
    setEndsAt(ann.ends_at ? new Date(ann.ends_at).toISOString().slice(0, 16) : '');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingAnnouncement(null);
  }

  function handleSave() {
    if (!title.trim() || !content.trim()) {
      toast.error('Le titre et le contenu sont obligatoires');
      return;
    }
    saveMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      audience_type: audienceType,
      target_roles: audienceType === 'role' ? selectedRoles as ('admin' | 'team' | 'client' | 'agency')[] : null,
      target_user_ids: audienceType === 'users' ? selectedUserIds : null,
      active,
      starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    });
  }

  const audienceLabel = (ann: Announcement) => {
    if (ann.audience_type === 'all') return 'Tous les utilisateurs';
    if (ann.audience_type === 'role') return (ann.target_roles || []).map(r => ROLES.find(rl => rl.value === r)?.label || r).join(', ');
    if (ann.audience_type === 'users') {
      const count = ann.target_user_ids?.length || 0;
      return `${count} utilisateur${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`;
    }
    return '';
  };

  const audienceIcon = (type: string) => {
    if (type === 'all') return <Globe className="h-3.5 w-3.5" />;
    if (type === 'role') return <Users className="h-3.5 w-3.5" />;
    return <User className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7" />
            Informer
          </h1>
          <p className="text-muted-foreground">Gérez les messages affichés aux utilisateurs à leur connexion</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle annonce
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Aucune annonce pour le moment</p>
            <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une annonce
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {announcements.map(ann => (
            <Card key={ann.id} className={!ann.active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{ann.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ann.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={ann.active}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: ann.id, active: checked })}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(ann)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(ann.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="gap-1">
                    {audienceIcon(ann.audience_type)}
                    {audienceLabel(ann)}
                  </Badge>
                  <Badge variant={ann.active ? 'default' : 'secondary'}>
                    {ann.active ? 'Actif' : 'Inactif'}
                  </Badge>
                  {ann.ends_at && (
                    <Badge variant="outline">
                      Expire le {new Date(ann.ends_at).toLocaleDateString('fr-FR')}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? 'Modifier l\'annonce' : 'Nouvelle annonce'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titre *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de l'annonce" />
            </div>
            <div>
              <Label>Contenu *</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Contenu du message..." rows={4} />
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={audienceType} onValueChange={(v: 'all' | 'role' | 'users') => setAudienceType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  <SelectItem value="role">Par rôle</SelectItem>
                  <SelectItem value="users">Utilisateurs spécifiques</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {audienceType === 'role' && (
              <div className="space-y-2">
                <Label>Rôles ciblés</Label>
                {ROLES.map(role => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedRoles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedRoles(prev => [...prev, role.value]);
                        else setSelectedRoles(prev => prev.filter(r => r !== role.value));
                      }}
                    />
                    <span className="text-sm">{role.label}</span>
                  </div>
                ))}
              </div>
            )}

            {audienceType === 'users' && (
              <div className="space-y-2">
                <Label>Utilisateurs ciblés</Label>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                  {profiles.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedUserIds.includes(p.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedUserIds(prev => [...prev, p.id]);
                          else setSelectedUserIds(prev => prev.filter(id => id !== p.id));
                        }}
                      />
                      <span className="text-sm">{p.first_name} {p.last_name}</span>
                      <span className="text-xs text-muted-foreground">{p.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Début</Label>
                <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              </div>
              <div>
                <Label>Fin (optionnel)</Label>
                <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette annonce ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
