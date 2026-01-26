import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export function AddTeamMemberDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: AddTeamMemberDialogProps) {
  const [memberType, setMemberType] = useState<'profile' | 'agency_contact' | 'client'>('profile');
  const [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectClientId, setProjectClientId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchProjectClient();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // For "client" we fetch either:
    // - the list of clients (if no client is linked yet)
    // - the contacts of the linked client (if already linked)
    fetchMembers();
  }, [open, memberType, projectClientId]);

  const fetchProjectClient = async () => {
    try {
      const { data } = await supabase
        .from('project_clients')
        .select('client_id')
        .eq('project_id', projectId)
        .maybeSingle();
      
      setProjectClientId(data?.client_id || null);
    } catch (error) {
      console.error('Error fetching project client:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      let data: any[] = [];
      
      if (memberType === 'profile') {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .order('first_name');
        data = profiles || [];
      } else if (memberType === 'agency_contact') {
        const { data: contacts } = await supabase
          .from('agency_contacts')
          .select(`
            id, 
            first_name, 
            last_name, 
            email, 
            agency_id,
            agencies!agency_contacts_agency_id_fkey(name)
          `)
          .order('first_name');
        data = contacts || [];
      } else if (memberType === 'client') {
        if (!projectClientId) {
          // No client linked yet → allow selecting a client to associate
          const { data: clients, error } = await supabase
            .from('clients')
            .select('id, company, first_name, last_name, email')
            .eq('active', true)
            .order('company');

          if (error) {
            console.error('Error fetching clients:', error);
            toast.error('Erreur lors du chargement des clients');
          } else {
            data = clients || [];
            if (data.length === 0) {
              toast.info('Aucun client disponible');
            }
          }
        } else {
          // Client already linked → allow selecting a client contact
          const { data: clientContacts, error } = await supabase
            .from('client_contacts')
            .select('id, first_name, last_name, email, title')
            .eq('client_id', projectClientId)
            .order('first_name');
          
          if (error) {
            console.error('Error fetching client contacts:', error);
            toast.error('Erreur lors du chargement des contacts clients');
          } else {
            data = clientContacts || [];
            if (data.length === 0) {
              toast.info('Aucun contact trouvé pour ce client');
            }
          }
        }
      }

      setMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Erreur lors du chargement des membres');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      toast.error('Veuillez sélectionner un membre');
      return;
    }

    setLoading(true);
    try {
      // Special case: from "Équipe > Ajouter > Clients" when the project has no linked client yet,
      // we associate the selected client to the project.
      if (memberType === 'client' && !projectClientId) {
        const { error } = await supabase
          .from('project_clients')
          .insert({
            project_id: projectId,
            client_id: memberId,
          });

        if (error) {
          // Unique constraint (if any) / already linked
          if ((error as any).code === '23505') {
            toast.error('Ce client est déjà associé à ce projet');
          } else {
            throw error;
          }
          return;
        }

        toast.success('Client associé au projet');
        setProjectClientId(memberId);
        onSuccess();
        onOpenChange(false);
        setMemberId('');
        return;
      }

      // If adding an agency contact, also add the agency to project_agencies if not already added
      if (memberType === 'agency_contact') {
        const { data: contactData } = await supabase
          .from('agency_contacts')
          .select('agency_id')
          .eq('id', memberId)
          .single();

        if (contactData?.agency_id) {
          // Check if agency is already linked to project
          const { data: existingLink } = await supabase
            .from('project_agencies')
            .select('id')
            .eq('project_id', projectId)
            .eq('agency_id', contactData.agency_id)
            .maybeSingle();

          // If not linked, add it
          if (!existingLink) {
            await supabase
              .from('project_agencies')
              .insert({
                project_id: projectId,
                agency_id: contactData.agency_id,
              });
          }
        }
      }

      const { error } = await supabase
        .from('project_team_members' as any)
        .insert({
          project_id: projectId,
          member_type: memberType === 'client' ? 'client_contact' : memberType,
          member_id: memberId,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Ce membre fait déjà partie de l\'équipe');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Membre ajouté à l\'équipe');
      onSuccess();
      onOpenChange(false);
      setMemberId('');
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.error('Erreur lors de l\'ajout du membre');
    } finally {
      setLoading(false);
    }
  };

  const getMemberLabel = (member: any) => {
    const name = `${member.first_name} ${member.last_name}`;
    if (memberType === 'agency_contact' && member.agencies) {
      return `${name} (${member.agencies.name})`;
    }
    if (memberType === 'client') {
      // If no client is linked yet, we're selecting a client company; otherwise a client contact
      if (!projectClientId) {
        return `${(member.company || '').toUpperCase()} - ${name}${member.email ? ` (${member.email})` : ''}`;
      }
      return `${name}${member.title ? ` - ${member.title}` : ''}`;
    }
    return `${name} (${member.email})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un membre à l'équipe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type de membre</Label>
            <Select
              value={memberType}
              onValueChange={(value: any) => {
                setMemberType(value);
                setMemberId('');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profile">Équipe</SelectItem>
                <SelectItem value="agency_contact">Agences</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Membre</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder={
                  memberType === 'client' && !projectClientId
                    ? "Sélectionner un client à associer"
                    : members.length === 0
                    ? "Aucun membre disponible"
                    : "Sélectionner un membre"
                } />
              </SelectTrigger>
              <SelectContent>
                {members.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {memberType === 'client' && !projectClientId
                      ? "Aucun client disponible"
                      : "Aucun membre disponible"}
                  </div>
                ) : (
                  members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {getMemberLabel(member)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              Ajouter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
