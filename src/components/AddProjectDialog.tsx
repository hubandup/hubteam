import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { AddClientDialog, type AddedClientPayload } from './AddClientDialog';

interface AddProjectDialogProps {
  onProjectAdded: () => void;
}

export function AddProjectDialog({ onProjectAdded }: AddProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clients, setClients] = useState<AddedClientPayload[]>([]);
  const [selectedClientPreview, setSelectedClientPreview] = useState<AddedClientPayload | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    client_id: '',
  });

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  const sortClients = (items: AddedClientPayload[]) =>
    [...items].sort((a, b) => a.company.localeCompare(b.company, 'fr', { sensitivity: 'base' }));

  const upsertClientInList = (list: AddedClientPayload[], client: AddedClientPayload) => {
    const nextClients = list.some((existingClient) => existingClient.id === client.id)
      ? list.map((existingClient) => existingClient.id === client.id ? client : existingClient)
      : [...list, client];

    return sortClients(nextClients);
  };

  const fetchClients = async (preservedClient?: AddedClientPayload | null) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company, first_name, last_name, email, kdrive_drive_id, kdrive_folder_id, kdrive_folder_path')
        .eq('active', true)
        .order('company');

      if (error) throw error;
      setClients((prev) => {
        const fetchedClients = data || [];
        const selectedClient = preservedClient
          ?? selectedClientPreview
          ?? prev.find((client) => client.id === formData.client_id);

        if (!selectedClient || fetchedClients.some((client) => client.id === selectedClient.id)) {
          return sortClients(fetchedClients);
        }

        return upsertClientInList(fetchedClients, selectedClient);
      });
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erreur lors du chargement des clients');
    }
  };

  const selectedClient = clients.find((client) => client.id === formData.client_id)
    ?? (selectedClientPreview?.id === formData.client_id ? selectedClientPreview : null);

  const handleClientChange = (value: string) => {
    setFormData((prev) => ({ ...prev, client_id: value }));
    setSelectedClientPreview(clients.find((client) => client.id === value) ?? null);
  };

  const selectedClientLabel = selectedClient
    ? `${selectedClient.company.toUpperCase()} - ${selectedClient.first_name} ${selectedClient.last_name}`.trim()
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Auto-add the project creator to the team
      if (project && userData.user?.id) {
        await supabase.from('project_team_members').insert({
          project_id: project.id,
          member_id: userData.user.id,
          member_type: 'profile',
        });
      }

      if (formData.client_id && project) {
        const { error: clientError } = await supabase
          .from('project_clients')
          .insert({
            project_id: project.id,
            client_id: formData.client_id,
          });

        if (clientError) throw clientError;

        // Auto-add client profile to team if exists
        const selectedClient = clients.find(c => c.id === formData.client_id);
        if (selectedClient) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', selectedClient.email)
            .maybeSingle();

          if (profile) {
            await supabase
              .from('project_team_members')
              .insert({
                project_id: project.id,
                member_id: profile.id,
                member_type: 'profile',
              });
          }
        }

        // Create KDrive folder automatically if client has KDrive configured
        if (selectedClient?.kdrive_drive_id && selectedClient?.kdrive_folder_id) {
          try {
            const { data: folderData, error: folderError } = await supabase.functions.invoke('kdrive-api', {
              body: {
                action: 'create-folder',
                driveId: selectedClient.kdrive_drive_id,
                parentId: selectedClient.kdrive_folder_id,
                folderPath: formData.name,
              },
            });

            if (!folderError && folderData?.data) {
              // Update project with KDrive folder info
              const newFolderPath = `${selectedClient.kdrive_folder_path}/${formData.name}`;
              await supabase
                .from('projects')
                .update({
                  kdrive_drive_id: selectedClient.kdrive_drive_id,
                  kdrive_folder_id: folderData.data.id,
                  kdrive_folder_path: newFolderPath,
                })
                .eq('id', project.id);
              
              toast.success('Projet créé avec dossier KDrive');
            } else {
              toast.success('Projet créé (dossier KDrive non créé)');
            }
          } catch (kdriveError) {
            console.error('Error creating KDrive folder:', kdriveError);
            toast.success('Projet créé (erreur création dossier KDrive)');
          }
        } else {
          toast.success('Projet créé avec succès');
        }
      } else {
        toast.success('Projet créé avec succès');
      }

      setOpen(false);
      setFormData({
        name: '',
        description: '',
        status: 'active',
        start_date: '',
        end_date: '',
        client_id: '',
      });
      setSelectedClientPreview(null);
      onProjectAdded();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Erreur lors de la création du projet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && addClientOpen) return;
      setOpen(nextOpen);
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => { if (addClientOpen) e.preventDefault(); }}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau projet à votre portefeuille
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom du projet *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client">Client</Label>
              <div className="flex gap-2">
                <Select
                  key={`${formData.client_id || 'empty'}-${clients.length}`}
                  value={formData.client_id}
                  onValueChange={handleClientChange}
                >
                  <SelectTrigger className="flex-1">
                    {selectedClient ? (
                      <span className="block truncate">{selectedClientLabel}</span>
                    ) : (
                      <SelectValue placeholder="Sélectionner un client" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <span className="uppercase">{client.company}</span> - {client.first_name} {client.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setAddClientOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <AddClientDialog
                  open={addClientOpen}
                  onOpenChange={setAddClientOpen}
                  onClientAdded={(newClient) => {
                    if (!newClient) return;

                    setClients((prev) => upsertClientInList(prev, newClient));
                    setSelectedClientPreview(newClient);
                    setFormData((prev) => ({ ...prev, client_id: newClient.id }));
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Date de début</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date">Date de fin</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Statut</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">À faire</SelectItem>
                  <SelectItem value="reco_in_progress">Reco en cours</SelectItem>
                  <SelectItem value="active">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="lost">Perdu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer le projet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
