import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Loader2, Edit, Plus, Trash2, Eye, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useActivities } from '@/hooks/useActivities';
import { useQueryClient } from '@tanstack/react-query';

interface ActivityLogEntry {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

const actionIcons = {
  INSERT: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: Eye,
};

const actionLabels = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  created: 'Création',
  updated: 'Modification',
  deleted: 'Suppression',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  view: 'Consultation',
};

const fieldLabels: Record<string, string> = {
  first_name: 'Prénom',
  last_name: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  company: 'Entreprise',
  name: 'Nom',
  title: 'Titre',
  description: 'Description',
  status: 'Statut',
  priority: 'Priorité',
  start_date: 'Date de début',
  end_date: 'Date de fin',
  assigned_to: 'Assigné à',
  active: 'Actif',
  revenue: 'Revenu',
};

const ignoredFields = ['id', 'created_at', 'updated_at', 'user_id', 'created_by', 'avatar_url', 'logo_url'];

const entityLabels = {
  clients: 'Client',
  projects: 'Projet',
  tasks: 'Tâche',
  agencies: 'Agence',
  task_comments: 'Commentaire',
  users: 'Utilisateur',
  user_posts: 'Publication',
  invoices: 'Facture',
  quotes: 'Devis',
  meeting_notes: 'Compte rendu',
  client: 'Client',
  project: 'Projet',
  task: 'Tâche',
  agency: 'Agence',
  comment: 'Commentaire',
  user: 'Utilisateur',
};

export default function Activity() {
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const { data: activities = [], isLoading: loading } = useActivities();
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async (activity: ActivityLogEntry) => {
    if (!activity.old_values || activity.action_type === 'INSERT') {
      toast.error('Impossible de restaurer cette version');
      return;
    }

    setRestoring(true);
    try {
      const { error } = await supabase
        .from(activity.entity_type as any)
        .update(activity.old_values)
        .eq('id', activity.entity_id);

      if (error) throw error;

      toast.success('Version restaurée avec succès');
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Erreur lors de la restauration');
    } finally {
      setRestoring(false);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">
            Seuls les administrateurs peuvent accéder à la timeline d'activité
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          Timeline d'activité
        </h1>
        <p className="text-muted-foreground">
          Historique complet des modifications dans l'application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activités récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            {activities.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune activité enregistrée</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const ActionIcon = actionIcons[activity.action_type as keyof typeof actionIcons] || Edit;
                  const actionLabel = actionLabels[activity.action_type as keyof typeof actionLabels] || activity.action_type;
                  const entityLabel = entityLabels[activity.entity_type as keyof typeof entityLabels] || activity.entity_type;

                  return (
                    <div
                      key={activity.id}
                      className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex gap-4 flex-1">
                        <Avatar className="h-10 w-10">
                        <AvatarImage src={activity.profiles?.avatar_url || undefined} />
                        <AvatarFallback>
                          {activity.profiles?.first_name?.[0] || 'U'}
                          {activity.profiles?.last_name?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {activity.profiles?.first_name || 'Utilisateur'} {activity.profiles?.last_name || 'système'}
                          </span>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <ActionIcon className="h-3 w-3" />
                            {actionLabel}
                          </Badge>
                          <Badge variant="secondary">{entityLabel}</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>

                        {activity.action_type === 'UPDATE' && activity.old_values && activity.new_values && (
                          <div className="text-xs space-y-1 bg-muted/30 p-2 rounded">
                            <div className="font-medium mb-1">Modifications :</div>
                            {Object.keys(activity.new_values)
                              .filter(key => !ignoredFields.includes(key))
                              .map((key) => {
                                const oldValue = activity.old_values?.[key];
                                const newValue = activity.new_values[key];
                                if (oldValue !== newValue && newValue !== null) {
                                  const label = fieldLabels[key] || key;
                                  const displayOldValue = oldValue === null || oldValue === '' ? '(vide)' : String(oldValue);
                                  const displayNewValue = String(newValue);
                                  
                                  return (
                                    <div key={key} className="flex gap-2 items-center">
                                      <span className="text-muted-foreground font-medium min-w-[100px]">{label}:</span>
                                      {activity.action_type !== 'created' && (
                                        <>
                                          <span className="line-through text-destructive">
                                            {displayOldValue}
                                          </span>
                                          <span>→</span>
                                        </>
                                      )}
                                      <span className="text-primary font-medium">
                                        {displayNewValue}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })
                              .filter(Boolean)}
                          </div>
                        )}
                        
                        {activity.action_type === 'INSERT' && activity.new_values && (
                          <div className="text-xs space-y-1 bg-muted/30 p-2 rounded">
                            <div className="font-medium mb-1">Détails :</div>
                            {Object.keys(activity.new_values)
                              .filter(key => !ignoredFields.includes(key) && activity.new_values[key] !== null && activity.new_values[key] !== '')
                              .slice(0, 3)
                              .map((key) => {
                                const label = fieldLabels[key] || key;
                                const value = String(activity.new_values[key]);
                                return (
                                  <div key={key} className="flex gap-2">
                                    <span className="text-muted-foreground font-medium min-w-[100px]">{label}:</span>
                                    <span className="text-foreground">{value}</span>
                                  </div>
                                );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                      {activity.action_type === 'UPDATE' && 
                       activity.old_values && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={restoring}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restaurer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action restaurera {entityLabel} à son état précédent. 
                                Les modifications actuelles seront remplacées par les anciennes valeurs.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRestore(activity)}>
                                Confirmer la restauration
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
