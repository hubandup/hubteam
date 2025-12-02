import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTasks } from '@/hooks/useTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TaskDate {
  date: string;
  count: number;
  tasks: { id: string; title: string; priority: string; project_id: string | null }[];
}

export function CalendarView() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [userId, setUserId] = useState<string | null>(null);
  const { data: allTasks, isLoading } = useTasks();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const taskDates = useMemo(() => {
    if (!allTasks || !userId) return {};
    
    const dates: Record<string, TaskDate> = {};

    allTasks
      .filter(task => task.assigned_to === userId && task.status !== 'done')
      .forEach((task) => {
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
            project_id: task.project_id,
          });
        }
      });

    return dates;
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

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDateTasks = selectedDateKey ? taskDates[selectedDateKey] : null;

  if (isLoading || !userId) {
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
          className="rounded-md border w-full"
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
                  <div 
                    key={task.id} 
                    className="flex items-center justify-between p-2 rounded bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/projects/${task.project_id}?task=${task.id}`)}
                  >
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
