import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateProspect, PROSPECT_CHANNELS, PROSPECT_PRIORITIES, PROSPECT_STATUSES, ProspectChannel, ProspectPriority, ProspectStatus } from '@/hooks/useProspects';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateColorFromString } from '@/lib/utils';
import { Check, Search } from 'lucide-react';

interface AddProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: {
    contact_id?: string;
    company_name?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
  };
}

export function AddProspectDialog({ open, onOpenChange, defaultValues }: AddProspectDialogProps) {
  const createProspect = useCreateProspect();
  const [availableExpertises, setAvailableExpertises] = useState<string[]>([]);
  const [expertiseSearch, setExpertiseSearch] = useState('');

  const [formData, setFormData] = useState({
    company_name: defaultValues?.company_name || '',
    contact_name: defaultValues?.contact_name || '',
    email: defaultValues?.email || '',
    phone: defaultValues?.phone || '',
    linkedin_url: '',
    channel: 'Email' as ProspectChannel,
    referrer: '',
    status: 'À contacter' as ProspectStatus,
    priority: 'B' as ProspectPriority,
    estimated_amount: 0,
    probability: 0.5,
    need_summary: '',
    offer_tags: [] as string[],
    next_action: '',
    next_action_at: '',
    notes: '',
    contact_id: defaultValues?.contact_id || null,
  });

  useEffect(() => {
    const loadExpertises = async () => {
      const { data: agencies } = await supabase
        .from('agencies')
        .select('tags');
      
      // Extract and deduplicate tags from agencies
      const allTags = new Set<string>();
      agencies?.forEach(a => {
        if (Array.isArray(a.tags)) {
          a.tags.forEach((t: string) => allTags.add(t));
        }
      });
      
      // Sort alphabetically
      const sortedTags = Array.from(allTags).sort((a, b) => 
        a.localeCompare(b, 'fr')
      );
      
      setAvailableExpertises(sortedTags);
    };
    
    if (open) {
      loadExpertises();
    }
  }, [open]);

  const toggleExpertise = (tag: string) => {
    setFormData(prev => {
      const current = prev.offer_tags || [];
      if (current.includes(tag)) {
        return { ...prev, offer_tags: current.filter(t => t !== tag) };
      } else {
        return { ...prev, offer_tags: [...current, tag] };
      }
    });
  };

  const filteredExpertises = useMemo(() => {
    if (!expertiseSearch.trim()) return availableExpertises;
    const search = expertiseSearch.toLowerCase().trim();
    return availableExpertises.filter(tag => 
      tag.toLowerCase().includes(search)
    );
  }, [availableExpertises, expertiseSearch]);

  const handleSubmit = async () => {
    if (!formData.company_name.trim() || !formData.contact_name.trim() || !formData.email.trim()) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    try {
      await createProspect.mutateAsync({
        ...formData,
        estimated_amount: Number(formData.estimated_amount) || 0,
        probability: Number(formData.probability) || 0.5,
        next_action_at: formData.next_action_at || null,
      });
      toast.success('Prospect créé avec succès');
      onOpenChange(false);
      setFormData({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        linkedin_url: '',
        channel: 'Email',
        referrer: '',
        status: 'À contacter',
        priority: 'B',
        estimated_amount: 0,
        probability: 0.5,
        need_summary: '',
        offer_tags: [],
        next_action: '',
        next_action_at: '',
        notes: '',
        contact_id: null,
      });
    } catch (error) {
      console.error('Error creating prospect:', error);
      toast.error('Erreur lors de la création du prospect');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau prospect à votre pipeline commercial
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Entreprise *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Nom de l'entreprise"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact *</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                placeholder="Prénom Nom"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+33..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn</Label>
              <Input
                id="linkedin_url"
                value={formData.linkedin_url}
                onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referrer">Référent</Label>
              <Input
                id="referrer"
                value={formData.referrer}
                onChange={(e) => setFormData(prev => ({ ...prev, referrer: e.target.value }))}
                placeholder="Qui vous a recommandé ?"
              />
            </div>
          </div>

          {/* Status and priority */}
          <div className="grid grid-cols-3 gap-4">
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
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={formData.status}
                onValueChange={(value: ProspectStatus) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: ProspectPriority) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_PRIORITIES.map(priority => (
                    <SelectItem key={priority} value={priority}>Priorité {priority}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Financial */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_amount">Montant estimé (€)</Label>
              <Input
                id="estimated_amount"
                type="number"
                value={formData.estimated_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_amount: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probability">Probabilité (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={Math.round(formData.probability * 100)}
                onChange={(e) => setFormData(prev => ({ ...prev, probability: Number(e.target.value) / 100 }))}
                placeholder="50"
              />
            </div>
          </div>

          {/* Next action */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="next_action">Prochaine action</Label>
              <Input
                id="next_action"
                value={formData.next_action}
                onChange={(e) => setFormData(prev => ({ ...prev, next_action: e.target.value }))}
                placeholder="Ex: Appeler, Envoyer devis..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_action_at">Date prochaine action</Label>
              <Input
                id="next_action_at"
                type="date"
                value={formData.next_action_at}
                onChange={(e) => setFormData(prev => ({ ...prev, next_action_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="need_summary">Résumé du besoin</Label>
            <Textarea
              id="need_summary"
              value={formData.need_summary}
              onChange={(e) => setFormData(prev => ({ ...prev, need_summary: e.target.value }))}
              placeholder="Description du besoin client..."
              rows={2}
            />
          </div>

          {/* Expertises multi-select with search */}
          <div className="space-y-2">
            <Label>Expertises {formData.offer_tags.length > 0 && <span className="text-muted-foreground">({formData.offer_tags.length} sélectionnée{formData.offer_tags.length > 1 ? 's' : ''})</span>}</Label>
            {availableExpertises.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Aucune expertise disponible. Ajoutez des tags sur vos fiches agences.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Rechercher une expertise..."
                    value={expertiseSearch}
                    onChange={(e) => setExpertiseSearch(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/30">
                  {filteredExpertises.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">Aucune expertise trouvée</p>
                  ) : (
                    filteredExpertises.map((tag) => {
                      const isSelected = formData.offer_tags.includes(tag);
                      const tagColor = generateColorFromString(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer hover:scale-105`}
                          style={isSelected ? {
                            backgroundColor: tagColor,
                            borderColor: tagColor,
                            color: 'white',
                          } : {
                            borderColor: tagColor,
                            color: tagColor,
                            backgroundColor: 'transparent',
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExpertise(tag);
                          }}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {tag}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notes internes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createProspect.isPending}>
            {createProspect.isPending ? 'Création...' : 'Créer le prospect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
