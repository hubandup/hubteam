import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTasks } from '@/hooks/useTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Building2 } from 'lucide-react';
import { format } from 'date-fns';

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
  const [userId, setUserId] = useState<string | null>(null);
  const { data: allTasks, isLoading } = useTasks();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const tasks = useMemo(() => {
    if (!allTasks || !userId) return [];
    
    const today = format(new Date(), 'yyyy-MM-dd');
    
    return allTasks
      .filter(task => 
        task.assigned_to === userId &&
        (task.status === 'in_progress' || task.status === 'todo') &&
        task.end_date &&
        task.end_date <= today
      )
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
               (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
      });
  }, [allTasks, userId]);

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

  if (isLoading || !userId) {
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
                          <span 
                            className="text-sm font-semibold text-primary uppercase"
                          >
                            {client.company}
                          </span>
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
