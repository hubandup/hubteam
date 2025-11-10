import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface CreateChatRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateChatRoomDialog({ open, onOpenChange, onSuccess }: CreateChatRoomDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<'project' | 'direct'>('project');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    if (type === 'project' && !projectId) {
      toast.error('Veuillez sélectionner un projet');
      return;
    }

    setCreating(true);
    try {
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name,
          type,
          project_id: type === 'project' ? projectId : null,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add current user as member
      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert({
          room_id: room.id,
          user_id: user!.id,
        });

      if (memberError) throw memberError;

      toast.success('Conversation créée avec succès');
      setName('');
      setType('project');
      setProjectId('');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating chat room:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
          <DialogDescription>
            Créez une nouvelle conversation de projet ou directe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la conversation"
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'project' | 'direct')}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Conversation de projet</SelectItem>
                <SelectItem value="direct">Message direct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'project' && (
            <div className="space-y-2">
              <Label htmlFor="project">Projet</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              'Créer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
