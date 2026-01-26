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
  const [memberType, setMemberType] = useState<'profile' | 'agency_contact' | 'client_user' | 'client_contact'>(
    'profile'
  );
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
    // For "client_user" we fetch:
    // - the linked client (if already linked)
    // - otherwise the list of active clients
    // For "client_contact" we fetch:
    // - contacts of the linked client
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
      } else if (memberType === 'client_user') {
        if (projectClientId) {
          // Client already linked → allow selecting the linked client to (re)grant access
          const { data: client, error } = await supabase
            .from('clients')
            .select('id, company, first_name, last_name, email')
            .eq('id', projectClientId)
            .maybeSingle();

          if (error) {
            console.error('Error fetching linked client:', error);
            toast.error('Erreur lors du chargement du client');
          } else {
            data = client ? [client] : [];
            if (!client) {
              toast.info('Aucun client associé à ce projet');
            }
          }
        } else {
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
        }
      } else if (memberType === 'client_contact') {
        if (!projectClientId) {
          data = [];
          toast.info("Associez d'abord un client au projet");
        } else {
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
      // Client account access (visibility for the client user)
      if (memberType === 'client_user') {
        const selectedClient = members.find((c) => c.id === memberId);
        const selectedClientEmail = selectedClient?.email;

        if (projectClientId && projectClientId !== memberId) {
          toast.error('Ce projet est déjà associé à un autre client');
          return;
        }

        // Ensure project-client association exists
        if (!projectClientId) {
          const { error: linkError } = await supabase
            .from('project_clients')
            .insert({
              project_id: projectId,
              client_id: memberId,
            });

          if (linkError && (linkError as any).code !== '23505') {
            throw linkError;
          }
          setProjectClientId(memberId);
        }

        if (!selectedClientEmail) {
          toast.error("Impossible de retrouver l'email du client");
          return;
        }

        // Map client email to a user profile (client account)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', selectedClientEmail)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile?.id) {
          toast.info("Ce client n'a pas encore de compte utilisateur");
          return;
        }

        const { error: teamInsertError } = await supabase.from('project_team_members').insert({
          project_id: projectId,
          member_id: profile.id,
          member_type: 'profile',
        });

        if (teamInsertError && (teamInsertError as any).code !== '23505') {
          throw teamInsertError;
        }

        toast.success('Accès client ajouté au projet');
        onSuccess();
        onOpenChange(false);
        setMemberId('');
        return;
      }

      // If adding a client contact, also grant access to the matching user account (profile) if it exists.
      // This is what makes the project appear in the contact's Hub Team space.
      if (memberType === 'client_contact') {
        const selectedContact = members.find((c) => c.id === memberId);
        const selectedContactEmail = selectedContact?.email;

        if (!selectedContactEmail) {
          toast.error("Impossible de retrouver l'email du contact");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', selectedContactEmail)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile?.id) {
          const { error: teamInsertError } = await supabase
            .from('project_team_members')
            .insert({
              project_id: projectId,
              member_id: profile.id,
              member_type: 'profile',
            });

          if (teamInsertError && (teamInsertError as any).code !== '23505') {
            throw teamInsertError;
          }
        } else {
          // We still allow adding the contact entry for tracking, but inform that it won't grant login access.
          toast.info("Ce contact n'a pas de compte utilisateur");
        }
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
          member_type: memberType,
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
    if (memberType === 'client_user') {
      return `${(member.company || '').toUpperCase()} - ${name}${member.email ? ` (${member.email})` : ''}`;
    }
    if (memberType === 'client_contact') {
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
                <SelectItem value="client_user">Compte client</SelectItem>
                <SelectItem value="client_contact">Contacts clients</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Membre</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder={
                  memberType === 'client_user' && !projectClientId
                    ? "Sélectionner un client à associer (compte)"
                    : memberType === 'client_user' && projectClientId
                    ? "Sélectionner le compte client à (ré)ajouter"
                    : memberType === 'client_contact' && !projectClientId
                    ? "Associez d'abord un client au projet"
                    : memberType === 'client_contact'
                    ? 'Sélectionner un contact client'
                    : members.length === 0
                    ? "Aucun membre disponible"
                    : "Sélectionner un membre"
                } />
              </SelectTrigger>
              <SelectContent>
                {members.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {memberType === 'client_user' && !projectClientId
                      ? 'Aucun client disponible'
                      : 'Aucun membre disponible'}
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
