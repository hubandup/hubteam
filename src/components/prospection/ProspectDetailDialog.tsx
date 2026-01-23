import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Prospect, Interaction, useInteractions, useUpdateProspect, PROSPECT_STATUSES, PROSPECT_CHANNELS, PROSPECT_PRIORITIES, ProspectStatus, ProspectChannel, ProspectPriority } from '@/hooks/useProspects';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, User, Phone, Mail, Linkedin, Calendar, Euro, MessageSquare, Pencil, Plus, Search, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AddInteractionDialog } from './AddInteractionDialog';
import { supabase } from '@/integrations/supabase/client';
import { generateColorFromString } from '@/lib/utils';

interface ProspectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
}

export function ProspectDetailDialog({ open, onOpenChange, prospect }: ProspectDetailDialogProps) {
  const { data: interactions = [] } = useInteractions(prospect?.id);
  const updateProspect = useUpdateProspect();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Prospect>>({});
  const [addInteractionOpen, setAddInteractionOpen] = useState(false);
  const [availableExpertises, setAvailableExpertises] = useState<string[]>([]);
  const [expertiseSearch, setExpertiseSearch] = useState('');

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
    loadExpertises();
  }, []);

  const filteredExpertises = useMemo(() => {
    if (!expertiseSearch.trim()) return availableExpertises;
    const search = expertiseSearch.toLowerCase().trim();
    return availableExpertises.filter(tag => 
      tag.toLowerCase().includes(search)
    );
  }, [availableExpertises, expertiseSearch]);

  if (!prospect) return null;

  const startEditing = () => {
    setEditData({
      company_name: prospect.company_name,
      contact_name: prospect.contact_name,
      email: prospect.email,
      phone: prospect.phone || '',
      linkedin_url: prospect.linkedin_url || '',
      channel: prospect.channel,
      status: prospect.status,
      priority: prospect.priority,
      estimated_amount: prospect.estimated_amount,
      probability: prospect.probability,
      need_summary: prospect.need_summary || '',
      offer_tags: prospect.offer_tags || [],
      next_action: prospect.next_action || '',
      next_action_at: prospect.next_action_at || '',
      notes: prospect.notes || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const saveChanges = async () => {
    try {
      await updateProspect.mutateAsync({
        id: prospect.id,
        ...editData,
      });
      toast.success('Prospect mis à jour');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating prospect:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const toggleExpertise = (tag: string) => {
    setEditData(prev => {
      const current = prev.offer_tags || [];
      if (current.includes(tag)) {
        return { ...prev, offer_tags: current.filter(t => t !== tag) };
      } else {
        return { ...prev, offer_tags: [...current, tag] };
      }
    });
  };

  const statusConfig = PROSPECT_STATUSES.find(s => s.value === prospect.status);
  const weightedRevenue = prospect.estimated_amount * prospect.probability;

  const priorityColors = {
    A: 'bg-red-500 text-white',
    B: 'bg-yellow-500 text-white',
    C: 'bg-green-500 text-white',
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[600px] w-full flex flex-col p-0 gap-0">
          {/* Header avec actions */}
          <SheetHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 shrink-0 text-primary" />
                  {isEditing ? (
                    <Input
                      value={editData.company_name || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, company_name: e.target.value }))}
                      className="h-8 text-lg font-semibold"
                    />
                  ) : (
                    <span className="truncate">{prospect.company_name}</span>
                  )}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  {isEditing ? (
                    <Input
                      value={editData.contact_name || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, contact_name: e.target.value }))}
                      className="h-7 text-sm"
                    />
                  ) : (
                    <span className="truncate">{prospect.contact_name}</span>
                  )}
                </div>
              </div>
              
              {/* Boutons d'action modernisés */}
              <div className="flex items-center gap-1 shrink-0">
                {isEditing ? (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={cancelEditing}
                      className="h-9 px-3 text-muted-foreground hover:text-foreground"
                    >
                      Annuler
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={saveChanges} 
                      disabled={updateProspect.isPending}
                      className="h-9 px-4 gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Enregistrer
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={startEditing}
                    className="h-9 px-3 gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="info" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="mx-6 mt-4 w-fit">
              <TabsTrigger value="info">Informations</TabsTrigger>
              <TabsTrigger value="interactions">
                Interactions ({interactions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex-1 overflow-auto mt-0 px-6 pb-6">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-4 pr-4 py-4">
                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <Select
                          value={editData.status}
                          onValueChange={(value: ProspectStatus) => setEditData(prev => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROSPECT_STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={editData.priority}
                          onValueChange={(value: ProspectPriority) => setEditData(prev => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROSPECT_PRIORITIES.map(p => (
                              <SelectItem key={p} value={p}>Priorité {p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={editData.channel}
                          onValueChange={(value: ProspectChannel) => setEditData(prev => ({ ...prev, channel: value }))}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROSPECT_CHANNELS.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className={statusConfig?.color}>
                          {prospect.status}
                        </Badge>
                        <Badge className={priorityColors[prospect.priority]}>
                          Priorité {prospect.priority}
                        </Badge>
                        <Badge variant="secondary">{prospect.channel}</Badge>
                      </>
                    )}
                  </div>

                  {/* Contact info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {isEditing ? (
                          <Input
                            value={editData.email || ''}
                            onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                            className="h-7"
                          />
                        ) : (
                          <a href={`mailto:${prospect.email}`} className="text-primary hover:underline">
                            {prospect.email}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {isEditing ? (
                          <Input
                            value={editData.phone || ''}
                            onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                            className="h-7"
                          />
                        ) : (
                          prospect.phone || <span className="text-muted-foreground">Non renseigné</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        {isEditing ? (
                          <Input
                            value={editData.linkedin_url || ''}
                            onChange={(e) => setEditData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                            className="h-7"
                            placeholder="https://linkedin.com/in/..."
                          />
                        ) : prospect.linkedin_url ? (
                          <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Voir le profil
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Non renseigné</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Financial */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Euro className="h-4 w-4" />
                        Opportunité
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Montant estimé (€)</Label>
                            <Input
                              type="number"
                              value={editData.estimated_amount || 0}
                              onChange={(e) => setEditData(prev => ({ ...prev, estimated_amount: Number(e.target.value) }))}
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Probabilité (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round((editData.probability || 0) * 100)}
                              onChange={(e) => setEditData(prev => ({ ...prev, probability: Number(e.target.value) / 100 }))}
                              className="h-8"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold">{prospect.estimated_amount.toLocaleString('fr-FR')} €</div>
                            <div className="text-xs text-muted-foreground">Montant</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold">{Math.round(prospect.probability * 100)}%</div>
                            <div className="text-xs text-muted-foreground">Probabilité</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-primary">{weightedRevenue.toLocaleString('fr-FR')} €</div>
                            <div className="text-xs text-muted-foreground">Pondéré</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Next action */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Prochaine action
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Action</Label>
                            <Input
                              value={editData.next_action || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, next_action: e.target.value }))}
                              className="h-8"
                              placeholder="Appeler, Envoyer devis..."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input
                              type="date"
                              value={editData.next_action_at || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, next_action_at: e.target.value }))}
                              className="h-8"
                            />
                          </div>
                        </div>
                      ) : prospect.next_action ? (
                        <div>
                          <div className="font-medium">{prospect.next_action}</div>
                          {prospect.next_action_at && (
                            <div className="text-sm text-muted-foreground">
                              {format(parseISO(prospect.next_action_at), 'EEEE d MMMM yyyy', { locale: fr })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-muted-foreground italic">Aucune action planifiée</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Need summary & Expertises */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Besoin / Expertises</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {isEditing ? (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs">Expertises {(editData.offer_tags || []).length > 0 && <span className="text-muted-foreground">({(editData.offer_tags || []).length} sélectionnée{(editData.offer_tags || []).length > 1 ? 's' : ''})</span>}</Label>
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
                                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border rounded-md bg-muted/30">
                                  {filteredExpertises.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic py-2">Aucune expertise trouvée</p>
                                  ) : (
                                    filteredExpertises.map((tag) => {
                                      const isSelected = (editData.offer_tags || []).includes(tag);
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
                          <div className="space-y-1">
                            <Label className="text-xs">Résumé du besoin</Label>
                            <Textarea
                              value={editData.need_summary || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, need_summary: e.target.value }))}
                              rows={2}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {prospect.offer_tags && prospect.offer_tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {prospect.offer_tags.map((tag) => {
                                const tagColor = generateColorFromString(tag);
                                return (
                                  <Badge 
                                    key={tag}
                                    variant="outline"
                                    style={{
                                      borderColor: tagColor,
                                      color: tagColor,
                                      backgroundColor: `${tagColor}15`.replace('hsl', 'hsla').replace(')', ', 0.15)'),
                                    }}
                                  >
                                    {tag}
                                  </Badge>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Aucune expertise sélectionnée</p>
                          )}
                          {prospect.need_summary ? (
                            <p className="text-sm">{prospect.need_summary}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Besoin non renseigné</p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <Textarea
                          value={editData.notes || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                          rows={3}
                        />
                      ) : prospect.notes ? (
                        <p className="text-sm whitespace-pre-wrap">{prospect.notes}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Aucune note</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="interactions" className="flex-1 overflow-auto mt-0 px-6 pb-6">
              <div className="flex justify-end mb-4 pt-4">
                <Button size="sm" onClick={() => setAddInteractionOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-3">
                  {interactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Aucune interaction enregistrée</p>
                    </div>
                  ) : (
                    interactions.map((interaction) => (
                      <Card key={interaction.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{interaction.action_type}</Badge>
                              <Badge variant="secondary">{interaction.channel}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(interaction.happened_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </span>
                          </div>
                          {interaction.subject && (
                            <div className="font-medium text-sm mb-1">{interaction.subject}</div>
                          )}
                          {interaction.content && (
                            <p className="text-sm text-muted-foreground mb-2">{interaction.content}</p>
                          )}
                          {interaction.outcome && (
                            <div className="text-sm">
                              <span className="font-medium">Résultat:</span> {interaction.outcome}
                            </div>
                          )}
                          {interaction.next_step && (
                            <div className="text-sm text-primary mt-1">
                              <span className="font-medium">Suite:</span> {interaction.next_step}
                              {interaction.next_action_at && (
                                <span className="text-muted-foreground">
                                  {' '}(le {format(parseISO(interaction.next_action_at), 'dd/MM/yyyy')})
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AddInteractionDialog
        open={addInteractionOpen}
        onOpenChange={setAddInteractionOpen}
        prospectId={prospect.id}
        prospectName={prospect.company_name}
      />
    </>
  );
}
