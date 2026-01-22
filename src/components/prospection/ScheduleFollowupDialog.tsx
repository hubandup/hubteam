import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateProspect } from '@/hooks/useProspects';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

interface ScheduleFollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName?: string;
  currentAction?: string;
  currentDate?: string;
}

export function ScheduleFollowupDialog({ 
  open, 
  onOpenChange, 
  prospectId, 
  prospectName,
  currentAction,
  currentDate 
}: ScheduleFollowupDialogProps) {
  const updateProspect = useUpdateProspect();

  const [formData, setFormData] = useState({
    next_action: currentAction || '',
    next_action_at: currentDate || format(addDays(new Date(), 3), 'yyyy-MM-dd'),
  });

  const quickDates = [
    { label: 'Demain', days: 1 },
    { label: 'Dans 3 jours', days: 3 },
    { label: 'Dans 1 semaine', days: 7 },
    { label: 'Dans 2 semaines', days: 14 },
  ];

  const handleSubmit = async () => {
    if (!formData.next_action.trim() || !formData.next_action_at) {
      toast.error('Veuillez remplir l\'action et la date');
      return;
    }

    try {
      await updateProspect.mutateAsync({
        id: prospectId,
        next_action: formData.next_action,
        next_action_at: formData.next_action_at,
      });
      toast.success('Relance planifiée');
      onOpenChange(false);
    } catch (error) {
      console.error('Error scheduling followup:', error);
      toast.error('Erreur lors de la planification');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Planifier une relance</DialogTitle>
          <DialogDescription>
            {prospectName ? `Planifier la prochaine action pour ${prospectName}` : 'Définir la prochaine action'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="next_action">Prochaine action</Label>
            <Input
              id="next_action"
              value={formData.next_action}
              onChange={(e) => setFormData(prev => ({ ...prev, next_action: e.target.value }))}
              placeholder="Ex: Appeler, Envoyer devis, Relancer..."
            />
          </div>

          <div className="space-y-2">
            <Label>Date rapide</Label>
            <div className="flex flex-wrap gap-2">
              {quickDates.map(({ label, days }) => (
                <Button
                  key={days}
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    next_action_at: format(addDays(new Date(), days), 'yyyy-MM-dd') 
                  }))}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_action_at">Ou choisir une date</Label>
            <Input
              id="next_action_at"
              type="date"
              value={formData.next_action_at}
              onChange={(e) => setFormData(prev => ({ ...prev, next_action_at: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={updateProspect.isPending}>
            {updateProspect.isPending ? 'Enregistrement...' : 'Planifier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
