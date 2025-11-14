import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TodayTask {
  id: string;
  title: string;
  end_date: string | null;
  priority: string;
  project_id: string | null;
  projects?: {
    id: string;
    name: string;
    project_clients?: {
      clients: {
        id: string;
        company: string;
        logo_url: string | null;
      };
    }[];
  };
}

export function TodayTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TodayTask[]>([]);
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
          project_id,
          projects (
            id,
            name,
            project_clients (
              clients (
                id,
                company,
                logo_url
              )
            )
          )
        `)
        .eq('assigned_to', user.id)
        .eq('status', 'in_progress')
        .lte('end_date', today)
        .order('priority', { ascending: false });

      if (tasksError) throw tasksError;

      setTasks(tasksData || []);
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
            <div className="space-y-3">
              {tasks.map((task) => {
                const client = task.projects?.project_clients?.[0]?.clients;
                return (
                  <div 
                    key={task.id} 
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Header with Client and Due Date */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {client && (
                          <>
                            <Avatar className="h-6 w-6 cursor-pointer" onClick={() => navigate(`/crm/${client.id}`)}>
                              <AvatarImage src={client.logo_url || ''} />
                              <AvatarFallback className="bg-primary/10 text-xs">
                                {client.company.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span 
                              className="text-sm font-semibold text-primary cursor-pointer hover:underline uppercase"
                              onClick={() => navigate(`/crm/${client.id}`)}
                            >
                              {client.company}
                            </span>
                          </>
                        )}
                      </div>
                      {task.end_date && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(task.end_date), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                    
                    {/* Task Content */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div
                          className="cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/projects/${task.project_id}?task=${task.id}`)}
                        >
                          <p className="text-sm font-medium">{task.title}</p>
                        </div>
                        
                        {task.projects && (
                          <div
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => navigate(`/projects/${task.projects.id}`)}
                          >
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {task.projects.name}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <Badge className={getPriorityColor(task.priority)} variant="secondary">
                        {getPriorityLabel(task.priority)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
