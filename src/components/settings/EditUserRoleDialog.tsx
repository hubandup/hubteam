import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Agency {
  id: string;
  name: string;
}

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    role: 'admin' | 'team' | 'client' | 'agency' | null;
  };
}

export function EditUserRoleDialog({ open, onOpenChange, user }: EditUserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>(user.role || '');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAgencies, setLoadingAgencies] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedRole(user.role || '');
      fetchAgencies();
      if (user.role === 'agency') {
        fetchUserAgencies();
      }
    }
  }, [open, user]);

  const fetchAgencies = async () => {
    setLoadingAgencies(true);
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des agences');
      console.error('Error fetching agencies:', error);
    } finally {
      setLoadingAgencies(false);
    }
  };

  const fetchUserAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_members')
        .select('agency_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setSelectedAgencies(data.map(item => item.agency_id));
    } catch (error: any) {
      console.error('Error fetching user agencies:', error);
    }
  };

  const handleAgencyToggle = (agencyId: string) => {
    setSelectedAgencies(prev =>
      prev.includes(agencyId)
        ? prev.filter(id => id !== agencyId)
        : [...prev, agencyId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedRole) {
      toast.error('Veuillez sélectionner un rôle');
      return;
    }

    setLoading(true);
    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let roleError;
      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: selectedRole as 'admin' | 'team' | 'client' | 'agency' })
          .eq('user_id', user.id);
        roleError = error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: selectedRole as 'admin' | 'team' | 'client' | 'agency' });
        roleError = error;
      }

      if (roleError) throw roleError;

      // If role is 'agency', manage agency memberships
      if (selectedRole === 'agency') {
        // First, get current agency memberships
        const { data: currentMemberships, error: fetchError } = await supabase
          .from('agency_members')
          .select('id, agency_id')
          .eq('user_id', user.id);

        if (fetchError) throw fetchError;

        const currentAgencyIds = currentMemberships?.map(m => m.agency_id) || [];

        // Find agencies to add and remove
        const agenciesToAdd = selectedAgencies.filter(id => !currentAgencyIds.includes(id));
        const agenciesToRemove = currentAgencyIds.filter(id => !selectedAgencies.includes(id));

        // Add new memberships
        if (agenciesToAdd.length > 0) {
          const { error: insertError } = await supabase
            .from('agency_members')
            .insert(agenciesToAdd.map(agency_id => ({ user_id: user.id, agency_id })));

          if (insertError) throw insertError;
        }

        // Remove old memberships
        if (agenciesToRemove.length > 0) {
          const membershipIdsToRemove = currentMemberships
            ?.filter(m => agenciesToRemove.includes(m.agency_id))
            .map(m => m.id) || [];

          const { error: deleteError } = await supabase
            .from('agency_members')
            .delete()
            .in('id', membershipIdsToRemove);

          if (deleteError) throw deleteError;
        }
      } else {
        // If role is not 'agency', remove all agency memberships
        const { error: deleteError } = await supabase
          .from('agency_members')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;
      }

      toast.success('Rôle mis à jour avec succès');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour du rôle');
      console.error('Error updating role:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier le rôle utilisateur</DialogTitle>
          <DialogDescription>
            Modifiez le rôle et les permissions de{' '}
            <span className="font-medium">
              {user.display_name || `${user.first_name} ${user.last_name}`}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">Rôle *</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="team">Équipe</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="agency">Agence</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {selectedRole === 'admin' && 'Tous les droits sur l\'application'}
              {selectedRole === 'team' && 'Lecture dans Dashboard, CRM, Agences, Projets. Écriture dans CRM et Projets'}
              {selectedRole === 'client' && 'Lecture limitée à leurs propres données'}
              {selectedRole === 'agency' && 'Lecture CRM, Agences, Projets. Écriture limitée aux données rattachées'}
            </p>
          </div>

          {selectedRole === 'agency' && (
            <div className="space-y-3">
              <Label>Agences rattachées</Label>
              {loadingAgencies ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : agencies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Aucune agence disponible. Créez une agence d'abord.
                </p>
              ) : (
                <div className="space-y-2 border rounded-md p-4 max-h-[200px] overflow-y-auto">
                  {agencies.map((agency) => (
                    <div key={agency.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agency-${agency.id}`}
                        checked={selectedAgencies.includes(agency.id)}
                        onCheckedChange={() => handleAgencyToggle(agency.id)}
                      />
                      <label
                        htmlFor={`agency-${agency.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {agency.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Sélectionnez les agences auxquelles cet utilisateur appartient
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
