import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditTaskDialog } from '@/components/project-details/EditTaskDialog';
import { usePermissions } from '@/hooks/usePermissions';

export default function Tasks() {
  const navigate = useNavigate();
  const { canRead } = usePermissions();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          projects (
            id,
            name,
            project_clients (
              clients (
                company,
                first_name,
                last_name
              )
            )
          ),
          profiles (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    
    const query = searchQuery.toLowerCase();
    return tasks.filter(task =>
      task.title?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.projects?.name?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

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

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setShowEditDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canRead('tasks')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder aux tâches</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tâches</h1>
        <p className="text-muted-foreground">Suivez toutes vos tâches</p>
      </div>

      {tasks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une tâche..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {tasks.length === 0 ? 'Aucune tâche pour le moment' : 'Aucune tâche trouvée'}
          </p>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">Essayez une autre recherche</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleTaskClick(task)}
            >
              <CardContent className="p-4">
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

                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      {task.projects && (
                        <>
                          {task.projects.project_clients?.[0]?.clients && (
                            <span className="font-medium text-primary">
                              {task.projects.project_clients[0].clients.company}
                            </span>
                          )}
                          <span className="font-medium">{task.projects.name}</span>
                        </>
                      )}
                      
                      {task.profiles && (
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
