import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Calendar, User, Check } from 'lucide-react';
import { AddTaskDialog } from './AddTaskDialog';
import { EditTaskDialog } from './EditTaskDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProtectedAction } from '@/components/ProtectedAction';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  assigned_to: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface ProjectTasksTabProps {
  projectId: string;
}

export function ProjectTasksTab({ projectId }: ProjectTasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data separately for assigned users
      const tasksWithProfiles = await Promise.all(
        (data || []).map(async (task) => {
          if (task.assigned_to) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', task.assigned_to)
              .single();
            
            return { ...task, profiles: profile };
          }
          return task;
        })
      );

      setTasks(tasksWithProfiles);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    todo: { label: 'À faire', variant: 'secondary' as const },
    in_progress: { label: 'En cours', variant: 'default' as const },
    done: { label: 'Terminé', variant: 'outline' as const },
  };

  const priorityConfig = {
    low: { label: 'Basse', variant: 'secondary' as const },
    medium: { label: 'Moyenne', variant: 'default' as const },
    high: { label: 'Haute', variant: 'destructive' as const },
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowEditDialog(true);
  };

  const handleMarkAsDone = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening edit dialog
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Tâche marquée comme terminée');
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Erreur lors de la mise à jour de la tâche');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tâches du projet</CardTitle>
          <ProtectedAction module="tasks" action="create">
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une tâche
            </Button>
          </ProtectedAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{task.title}</h3>
                        <Badge variant={statusConfig[task.status as keyof typeof statusConfig]?.variant || 'secondary'}>
                          {statusConfig[task.status as keyof typeof statusConfig]?.label || task.status}
                        </Badge>
                        <Badge variant={priorityConfig[task.priority as keyof typeof priorityConfig]?.variant || 'secondary'}>
                          {priorityConfig[task.priority as keyof typeof priorityConfig]?.label || task.priority}
                        </Badge>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {task.assigned_to && task.profiles && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>
                              {task.profiles.first_name} {task.profiles.last_name}
                            </span>
                          </div>
                        )}
                        
                        {task.end_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {format(new Date(task.end_date), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {task.status !== 'done' && (
                      <ProtectedAction module="tasks" action="update">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleMarkAsDone(task.id, e)}
                          className="shrink-0"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Terminé
                        </Button>
                      </ProtectedAction>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune tâche pour ce projet. Cliquez sur "Ajouter une tâche" pour commencer.
            </p>
          )}
        </CardContent>
      </Card>

      <AddTaskDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId}
        onSuccess={fetchTasks}
      />

      {selectedTask && (
        <EditTaskDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          task={selectedTask}
          onSuccess={fetchTasks}
        />
      )}
    </div>
  );
}
