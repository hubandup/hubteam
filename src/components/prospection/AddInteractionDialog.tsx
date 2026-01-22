import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateInteraction, PROSPECT_CHANNELS, INTERACTION_ACTION_TYPES, ProspectChannel, InteractionActionType } from '@/hooks/useProspects';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AddInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName?: string;
  defaultActionType?: InteractionActionType;
}

export function AddInteractionDialog({ 
  open, 
  onOpenChange, 
  prospectId, 
  prospectName,
  defaultActionType = 'Autre'
}: AddInteractionDialogProps) {
  const createInteraction = useCreateInteraction();

  const [formData, setFormData] = useState({
    action_type: defaultActionType,
    channel: 'Email' as ProspectChannel,
    subject: '',
    content: '',
    outcome: '',
    next_step: '',
    next_action_at: '',
    happened_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const handleSubmit = async () => {
    if (!formData.action_type) {
      toast.error('Veuillez sélectionner un type d\'action');
      return;
    }

    try {
      await createInteraction.mutateAsync({
        prospect_id: prospectId,
        action_type: formData.action_type as InteractionActionType,
        channel: formData.channel,
        subject: formData.subject || null,
        content: formData.content || null,
        outcome: formData.outcome || null,
        next_step: formData.next_step || null,
        next_action_at: formData.next_action_at || null,
        happened_at: formData.happened_at ? new Date(formData.happened_at).toISOString() : new Date().toISOString(),
      });
      toast.success('Interaction ajoutée');
      onOpenChange(false);
      setFormData({
        action_type: 'Autre',
        channel: 'Email',
        subject: '',
        content: '',
        outcome: '',
        next_step: '',
        next_action_at: '',
        happened_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
    } catch (error) {
      console.error('Error creating interaction:', error);
      toast.error('Erreur lors de l\'ajout de l\'interaction');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvelle interaction</DialogTitle>
          <DialogDescription>
            {prospectName ? `Ajouter une interaction pour ${prospectName}` : 'Ajouter une interaction'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type d'action</Label>
              <Select
                value={formData.action_type}
                onValueChange={(value: InteractionActionType) => setFormData(prev => ({ ...prev, action_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_ACTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select
                value={formData.channel}
                onValueChange={(value: ProspectChannel) => setFormData(prev => ({ ...prev, channel: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_CHANNELS.map(channel => (
                    <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="happened_at">Date/Heure</Label>
            <Input
              id="happened_at"
              type="datetime-local"
              value={formData.happened_at}
              onChange={(e) => setFormData(prev => ({ ...prev, happened_at: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Sujet</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Ex: Appel de découverte, Présentation offre..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Résumé</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Ce qui a été dit/fait..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome">Résultat</Label>
            <Input
              id="outcome"
              value={formData.outcome}
              onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
              placeholder="Ex: Intéressé, Pas disponible, Demande de devis..."
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Prochaine étape (optionnel)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="next_step">Action suivante</Label>
                <Input
                  id="next_step"
                  value={formData.next_step}
                  onChange={(e) => setFormData(prev => ({ ...prev, next_step: e.target.value }))}
                  placeholder="Ex: Envoyer devis..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_action_at">Date</Label>
                <Input
                  id="next_action_at"
                  type="date"
                  value={formData.next_action_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, next_action_at: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createInteraction.isPending}>
            {createInteraction.isPending ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
