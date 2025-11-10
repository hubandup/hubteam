import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const inviteSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
  role: z.enum(['admin', 'team', 'client', 'agency'], { 
    required_error: "Veuillez sélectionner un rôle" 
  }),
});

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    try {
      // Validate input
      const validationResult = inviteSchema.safeParse({ email, role });
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        return;
      }

      setInviting(true);

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée, veuillez vous reconnecter');
        return;
      }

      // Call edge function to invite user
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('Invitation envoyée avec succès');
      setEmail('');
      setRole('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi de l\'invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!inviting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setEmail('');
        setRole('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>
            Envoyez une invitation par email à un nouvel utilisateur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="utilisateur@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rôle</Label>
            <Select value={role} onValueChange={setRole} disabled={inviting}>
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
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={inviting}
          >
            Annuler
          </Button>
          <Button onClick={handleInvite} disabled={inviting}>
            {inviting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              'Envoyer l\'invitation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
