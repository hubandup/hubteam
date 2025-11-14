import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TaskDate {
  date: string;
  count: number;
  tasks: { id: string; title: string; priority: string }[];
}

export function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [taskDates, setTaskDates] = useState<Record<string, TaskDate>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaskDates();
  }, []);

  const fetchTaskDates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, title, start_date, end_date, priority')
        .eq('assigned_to', user.id)
        .neq('status', 'done');

      if (error) throw error;

      const dates: Record<string, TaskDate> = {};

      tasks?.forEach((task) => {
        if (task.end_date) {
          const dateKey = format(new Date(task.end_date), 'yyyy-MM-dd');
          if (!dates[dateKey]) {
            dates[dateKey] = { date: dateKey, count: 0, tasks: [] };
          }
          dates[dateKey].count++;
          dates[dateKey].tasks.push({
            id: task.id,
            title: task.title,
            priority: task.priority,
          });
        }
      });

      setTaskDates(dates);
    } catch (error) {
      console.error('Error fetching task dates:', error);
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

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDateTasks = selectedDateKey ? taskDates[selectedDateKey] : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Calendrier
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
          <CalendarDays className="h-5 w-5" />
          Calendrier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          locale={fr}
          modifiers={{
            hasTasks: (date) => {
              const dateKey = format(date, 'yyyy-MM-dd');
              return !!taskDates[dateKey];
            },
          }}
          modifiersStyles={{
            hasTasks: {
              fontWeight: 'bold',
              textDecoration: 'underline',
              textDecorationColor: 'hsl(var(--primary))',
            },
          }}
          className="rounded-md border pointer-events-auto"
        />

        {selectedDate && (
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold mb-3">
              {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </h3>
            {!selectedDateTasks || selectedDateTasks.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune tâche ce jour</p>
            ) : (
              <div className="space-y-2">
                {selectedDateTasks.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <p className="text-sm flex-1 truncate">{task.title}</p>
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {getPriorityLabel(task.priority)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
