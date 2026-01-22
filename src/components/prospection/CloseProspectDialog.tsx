import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateProspect, useCreateInteraction } from '@/hooks/useProspects';
import { toast } from 'sonner';
import { CheckCircle, XCircle } from 'lucide-react';

interface CloseProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName?: string;
  type: 'won' | 'lost';
}

export function CloseProspectDialog({ 
  open, 
  onOpenChange, 
  prospectId, 
  prospectName,
  type 
}: CloseProspectDialogProps) {
  const updateProspect = useUpdateProspect();
  const createInteraction = useCreateInteraction();

  const [reason, setReason] = useState('');

  const isWon = type === 'won';

  const handleSubmit = async () => {
    try {
      // Update prospect status
      await updateProspect.mutateAsync({
        id: prospectId,
        status: isWon ? 'Gagné' : 'Perdu',
        next_action: null,
        next_action_at: null,
      });

      // Create interaction to log the closure
      await createInteraction.mutateAsync({
        prospect_id: prospectId,
        action_type: 'Autre',
        channel: 'Email',
        subject: isWon ? 'Affaire gagnée' : 'Affaire perdue',
        content: reason || (isWon ? 'Affaire conclue avec succès' : 'Affaire non conclue'),
        outcome: isWon ? 'Gagné' : 'Perdu',
      });

      toast.success(isWon ? 'Félicitations ! Affaire gagnée 🎉' : 'Affaire marquée comme perdue');
      onOpenChange(false);
      setReason('');
    } catch (error) {
      console.error('Error closing prospect:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWon ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Marquer comme gagné
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Marquer comme perdu
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {prospectName ? `Clôturer l'opportunité ${prospectName}` : 'Clôturer cette opportunité'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              {isWon ? 'Raison du succès (optionnel)' : 'Raison de la perte (optionnel)'}
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isWon ? 'Ex: Prix compétitif, Bon relationnel...' : 'Ex: Budget, Concurrent, Timing...'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={updateProspect.isPending || createInteraction.isPending}
            variant={isWon ? 'default' : 'destructive'}
          >
            {updateProspect.isPending ? 'Enregistrement...' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
