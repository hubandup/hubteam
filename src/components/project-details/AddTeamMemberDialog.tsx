import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

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
  const [memberType, setMemberType] = useState<'profile' | 'agency_contact' | 'client_contact'>(
    'profile'
  );
  const [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectClientId, setProjectClientId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteContact, setInviteContact] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [inviteRole, setInviteRole] = useState<string>('client');
  const [inviting, setInviting] = useState(false);

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
    let pendingInviteRef: { first_name: string; last_name: string; email: string } | null = null;
    try {
      // Helper function to grant project access to a user profile by email (case-insensitive)
      const grantProfileAccess = async (email: string) => {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', email)
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
          return true;
        }
        return false;
      };

      // For client_contact or agency_contact, grant access to matching user profile if exists
      if (memberType === 'client_contact' || memberType === 'agency_contact') {
        const selectedMember = members.find((m) => m.id === memberId);
        const memberEmail = selectedMember?.email;

        if (memberEmail) {
          const hasProfile = await grantProfileAccess(memberEmail);
          if (!hasProfile) {
            // Store contact info for invite proposal after adding
            pendingInviteRef = {
              first_name: selectedMember.first_name,
              last_name: selectedMember.last_name,
              email: memberEmail,
            };
          }
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

      // After successfully adding, propose invitation if no profile found
      if (pendingInviteRef) {
        setInviteContact(pendingInviteRef);
        setInviteRole(memberType === 'agency_contact' ? 'agency' : 'client');
        setInviteDialogOpen(true);
      }
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.error('Erreur lors de l\'ajout du membre');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteContact = async () => {
    if (!inviteContact) return;

    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté pour inviter un utilisateur');
        return;
      }

      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteContact.email,
          role: inviteRole,
          firstName: inviteContact.first_name,
          lastName: inviteContact.last_name,
        },
      });

      if (error) throw error;

      toast.success('Invitation envoyée avec succès');
      setInviteDialogOpen(false);
      setInviteContact(null);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error("Erreur lors de l'envoi de l'invitation");
    } finally {
      setInviting(false);
    }
  };

  const getMemberLabel = (member: any) => {
    const name = `${member.first_name} ${member.last_name}`;
    if (memberType === 'agency_contact' && member.agencies) {
      return `${name} (${member.agencies.name})`;
    }
    if (memberType === 'client_contact') {
      return `${name}${member.title ? ` - ${member.title}` : ''}`;
    }
    return `${name} (${member.email})`;
  };

  return (
    <>
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
                <SelectItem value="client_contact">Clients</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Membre</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder={
                  memberType === 'client_contact' && !projectClientId
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
                    Aucun membre disponible
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

      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open);
        if (!open) setInviteContact(null);
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Créer un compte utilisateur ?</DialogTitle>
            <DialogDescription>
              {inviteContact?.first_name} {inviteContact?.last_name} n'a pas encore de compte sur la plateforme. Souhaitez-vous lui envoyer une invitation ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 text-sm border rounded-md p-3 bg-muted/30">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nom</span>
                <span className="font-medium">{inviteContact?.first_name} {inviteContact?.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{inviteContact?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rôle</span>
                <span className="font-medium capitalize">{inviteRole}</span>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setInviteDialogOpen(false);
                  setInviteContact(null);
                }}
                disabled={inviting}
              >
                Non merci
              </Button>
              <Button onClick={handleInviteContact} disabled={inviting}>
                {inviting ? 'Envoi...' : "Envoyer l'invitation"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
