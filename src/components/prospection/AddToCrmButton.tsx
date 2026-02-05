import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Prospect } from '@/hooks/useProspects';

interface AddToCrmButtonProps {
  prospect: Prospect;
}

export function AddToCrmButton({ prospect }: AddToCrmButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const handleClick = async () => {
    // Check if a client with this email already exists
    const { data: existing } = await supabase
      .from('clients')
      .select('id, company, first_name, last_name')
      .eq('email', prospect.email)
      .maybeSingle();

    setAlreadyExists(!!existing);
    setConfirmOpen(true);
  };

  const handleAddToCrm = async () => {
    setLoading(true);
    try {
      // Split contact_name into first/last name
      const nameParts = prospect.contact_name.trim().split(/\s+/);
      const firstName = nameParts[0] || 'N/A';
      const lastName = nameParts.slice(1).join(' ') || 'N/A';

      const { error } = await supabase
        .from('clients')
        .insert({
          company: prospect.company_name,
          first_name: firstName,
          last_name: lastName,
          email: prospect.email,
          phone: prospect.phone || null,
          kanban_stage: 'lead',
          active: true,
          linkedin_connected: !!prospect.linkedin_url,
        });

      if (error) throw error;

      // Link prospect to the new client via contact_id  
      const { data: newClient } = await supabase
        .from('clients')
        .select('id')
        .eq('email', prospect.email)
        .single();

      if (newClient) {
        await supabase
          .from('prospects')
          .update({ contact_id: newClient.id })
          .eq('id', prospect.id);
      }

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success('Contact ajouté au CRM');
      setConfirmOpen(false);
    } catch (error: any) {
      console.error('Error adding to CRM:', error);
      if (error?.code === '23505') {
        toast.error('Ce contact existe déjà dans le CRM');
      } else {
        toast.error('Erreur lors de l\'ajout au CRM');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-1.5"
      >
        <UserPlus className="h-4 w-4" />
        Ajouter au CRM
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Ajouter au CRM</DialogTitle>
            <DialogDescription>
              {alreadyExists
                ? `Un client avec l'email ${prospect.email} existe déjà dans le CRM. Voulez-vous quand même créer une nouvelle fiche ?`
                : `Voulez-vous ajouter ${prospect.contact_name} (${prospect.company_name}) au CRM ?`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm border rounded-md p-3 bg-muted/30">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entreprise</span>
              <span className="font-medium">{prospect.company_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact</span>
              <span className="font-medium">{prospect.contact_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{prospect.email}</span>
            </div>
            {prospect.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Téléphone</span>
                <span className="font-medium">{prospect.phone}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddToCrm} disabled={loading}>
              {loading ? 'Ajout...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
