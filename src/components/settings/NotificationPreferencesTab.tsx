import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Bell, MessageSquare, Calendar, CheckCircle } from 'lucide-react';

interface NotificationPreferences {
  task_assigned: boolean;
  task_comment: boolean;
  mention: boolean;
  deadline_approaching: boolean;
}

export function NotificationPreferencesTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    task_assigned: true,
    task_comment: true,
    mention: true,
    deadline_approaching: true,
  });

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no preferences exist yet, create them
        if (error.code === 'PGRST116') {
          await createDefaultPreferences();
        } else {
          throw error;
        }
      } else if (data) {
        setPreferences({
          task_assigned: data.task_assigned,
          task_comment: data.task_comment,
          mention: data.mention,
          deadline_approaching: data.deadline_approaching,
        });
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      toast.error('Erreur lors du chargement des préférences');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPreferences = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .insert({ user_id: user.id });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating default preferences:', error);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    setSaving(true);
    setPreferences(prev => ({ ...prev, [key]: value }));

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Préférences mises à jour');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Erreur lors de la mise à jour');
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !value }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Préférences de notifications
        </CardTitle>
        <CardDescription>
          Choisissez les types de notifications que vous souhaitez recevoir
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="task_assigned" className="text-base cursor-pointer">
                  Tâches assignées
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recevoir une notification lorsqu'une tâche vous est assignée
                </p>
              </div>
            </div>
            <Switch
              id="task_assigned"
              checked={preferences.task_assigned}
              onCheckedChange={(checked) => updatePreference('task_assigned', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="task_comment" className="text-base cursor-pointer">
                  Commentaires sur les tâches
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recevoir une notification lors d'un nouveau commentaire sur vos tâches
                </p>
              </div>
            </div>
            <Switch
              id="task_comment"
              checked={preferences.task_comment}
              onCheckedChange={(checked) => updatePreference('task_comment', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="mention" className="text-base cursor-pointer">
                  Mentions
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recevoir une notification lorsque quelqu'un vous mentionne dans un message
                </p>
              </div>
            </div>
            <Switch
              id="mention"
              checked={preferences.mention}
              onCheckedChange={(checked) => updatePreference('mention', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="deadline_approaching" className="text-base cursor-pointer">
                  Deadlines approchantes
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recevoir une notification 24h avant une deadline
                </p>
              </div>
            </div>
            <Switch
              id="deadline_approaching"
              checked={preferences.deadline_approaching}
              onCheckedChange={(checked) => updatePreference('deadline_approaching', checked)}
              disabled={saving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}