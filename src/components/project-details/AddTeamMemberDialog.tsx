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

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, memberType]);

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
          .select('id, first_name, last_name, email, agencies(name)')
          .order('first_name');
        data = contacts || [];
      } else if (memberType === 'client') {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, first_name, last_name, email, company')
          .order('first_name');
        data = clients || [];
      }

      setMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
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
      const { error } = await supabase
        .from('project_team_members')
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
    if (memberType === 'client' && member.company) {
      return `${name} (${member.company})`;
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
                <SelectItem value="profile">Équipe Hub & Up</SelectItem>
                <SelectItem value="agency_contact">Contact Agence</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Membre</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un membre" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {getMemberLabel(member)}
                  </SelectItem>
                ))}
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
