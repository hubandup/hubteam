import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar } from 'lucide-react';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  priority: string;
  status: string;
  projects?: {
    name: string;
  };
}

export function MyWeeklySchedule() {
  const [tasksByDay, setTasksByDay] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyTasks();
  }, []);

  const fetchWeeklyTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          start_date,
          end_date,
          priority,
          status,
          projects (
            name
          )
        `)
        .eq('assigned_to', user.id)
        .neq('status', 'done')
        .or(`start_date.gte.${format(weekStart, 'yyyy-MM-dd')},end_date.lte.${format(weekEnd, 'yyyy-MM-dd')}`);

      if (error) throw error;

      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
        .filter(day => day.getDay() !== 0 && day.getDay() !== 6);

      const organized: Record<string, Task[]> = {};

      weekDays.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        organized[dayKey] = [];

        tasks?.forEach(task => {
          if (!task.start_date && !task.end_date) return;

          const taskStart = task.start_date ? new Date(task.start_date) : null;
          const taskEnd = task.end_date ? new Date(task.end_date) : null;

          const isTaskOnThisDay = 
            (taskStart && isSameDay(taskStart, day)) ||
            (taskEnd && isSameDay(taskEnd, day)) ||
            (taskStart && taskEnd && isWithinInterval(day, { start: taskStart, end: taskEnd }));

          if (isTaskOnThisDay) {
            organized[dayKey].push(task);
          }
        });
      });

      setTasksByDay(organized);
    } catch (error) {
      console.error('Error fetching weekly tasks:', error);
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
            <Calendar className="h-5 w-5" />
            Mon programme de la semaine
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const weekDays = Object.keys(tasksByDay).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Mon programme de la semaine
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {weekDays.map(dayKey => {
            const date = new Date(dayKey);
            const isToday = isSameDay(date, new Date());
            const dayTasks = tasksByDay[dayKey] || [];

            return (
              <div key={dayKey} className={`p-4 rounded-lg border ${isToday ? 'bg-primary/5 border-primary' : 'bg-card'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className={`font-semibold ${isToday ? 'text-primary' : ''}`}>
                    {format(date, 'EEEE d MMMM', { locale: fr })}
                  </h3>
                  {isToday && <Badge variant="default" className="text-xs">Aujourd'hui</Badge>}
                </div>

                {dayTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune tâche</p>
                ) : (
                  <div className="space-y-2">
                    {dayTasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-2 rounded bg-background/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          {task.projects && (
                            <p className="text-xs text-muted-foreground truncate">{task.projects.name}</p>
                          )}
                        </div>
                        <Badge className={getPriorityColor(task.priority)} variant="secondary">
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
