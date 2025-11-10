import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Loader2, Edit, Plus, Trash2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';

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
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: Eye,
};

const actionLabels = {
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
  client: 'Client',
  project: 'Projet',
  task: 'Tâche',
  agency: 'Agence',
  comment: 'Commentaire',
  user: 'Utilisateur',
};

export default function Activity() {
  const { canRead } = usePermissions();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel('activity-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActivities = async () => {
    try {
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (activitiesError) throw activitiesError;

      const userIds = [...new Set(activitiesData.map(a => a.user_id))];

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData.map(p => [p.id, p]));

      const enrichedActivities = activitiesData.map(activity => ({
        ...activity,
        profiles: profilesMap.get(activity.user_id) || {
          first_name: 'Unknown',
          last_name: 'User',
          avatar_url: null,
        },
      }));

      setActivities(enrichedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!canRead('dashboard')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">
            Vous n'avez pas les permissions pour accéder à la timeline
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
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={activity.profiles.avatar_url || undefined} />
                        <AvatarFallback>
                          {activity.profiles.first_name[0]}
                          {activity.profiles.last_name[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {activity.profiles.first_name} {activity.profiles.last_name}
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

                        {activity.old_values && activity.new_values && (
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
                        
                        {activity.action_type === 'created' && activity.new_values && (
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
