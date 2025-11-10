import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
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

export function WeeklySchedule() {
  const [tasksByDay, setTasksByDay] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyTasks();
  }, []);

  const fetchWeeklyTasks = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Lundi
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Dimanche

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
        .neq('status', 'done')
        .or(`start_date.gte.${format(weekStart, 'yyyy-MM-dd')},end_date.lte.${format(weekEnd, 'yyyy-MM-dd')}`);

      if (error) throw error;

      // Organiser les tâches par jour de la semaine
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
        .filter(day => day.getDay() !== 0 && day.getDay() !== 6); // Exclure samedi et dimanche

      const organized: Record<string, Task[]> = {};

      weekDays.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        organized[dayKey] = [];

        tasks?.forEach(task => {
          if (!task.start_date && !task.end_date) return;

          const taskStart = task.start_date ? new Date(task.start_date) : null;
          const taskEnd = task.end_date ? new Date(task.end_date) : null;

          // Vérifier si la tâche est prévue pour ce jour
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
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
        return 'bg-warning text-warning-foreground';
      case 'low':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Haute';
      case 'medium':
        return 'Moyenne';
      case 'low':
        return 'Basse';
      default:
        return priority;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Programme de la semaine</CardTitle>
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
        <CardTitle>Programme de la semaine</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-5">
          {weekDays.map(dayKey => {
            const date = new Date(dayKey);
            const dayName = format(date, 'EEEE', { locale: fr });
            const dayNumber = format(date, 'd MMM', { locale: fr });
            const tasks = tasksByDay[dayKey] || [];
            const isToday = isSameDay(date, new Date());

            return (
              <div
                key={dayKey}
                className={`space-y-3 p-4 rounded-lg border ${
                  isToday ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="space-y-1">
                  <p className={`font-semibold capitalize ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {dayName}
                  </p>
                  <p className="text-xs text-muted-foreground">{dayNumber}</p>
                </div>

                {tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucune tâche</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        className="p-2 rounded-md bg-background border border-border space-y-1"
                      >
                        <p className="text-xs font-medium line-clamp-2">{task.title}</p>
                        {task.projects && (
                          <p className="text-xs text-muted-foreground truncate">
                            {task.projects.name}
                          </p>
                        )}
                        <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
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
