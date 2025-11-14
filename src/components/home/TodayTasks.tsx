import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Bell } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TodayTask {
  id: string;
  title: string;
  end_date: string | null;
  priority: string;
  projects?: {
    name: string;
  };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

export function TodayTasks() {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayData();
  }, []);

  const fetchTodayData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch today's tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          end_date,
          priority,
          projects (
            name
          )
        `)
        .eq('assigned_to', user.id)
        .eq('status', 'in_progress')
        .lte('end_date', today)
        .order('priority', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch unread notifications
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (notifError) throw notifError;

      setTasks(tasksData || []);
      setNotifications(notifData || []);
    } catch (error) {
      console.error('Error fetching today data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Haute';
      case 'medium': return 'Moyenne';
      case 'low': return 'Basse';
      default: return priority;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            À faire aujourd'hui
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          À faire aujourd'hui
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tasks Section */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span>Tâches en cours</span>
            {tasks.length > 0 && (
              <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
            )}
          </h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tâche urgente</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.projects && (
                        <p className="text-xs text-muted-foreground">{task.projects.name}</p>
                      )}
                      {task.end_date && (
                        <p className="text-xs text-destructive mt-1">
                          Échéance: {format(new Date(task.end_date), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {getPriorityLabel(task.priority)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Section */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>Notifications récentes</span>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="text-xs">{notifications.length}</Badge>
            )}
          </h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-3 rounded-lg border bg-card">
                  <p className="text-sm font-medium">{notif.title}</p>
                  <p className="text-xs text-muted-foreground">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(notif.created_at), 'HH:mm', { locale: fr })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
