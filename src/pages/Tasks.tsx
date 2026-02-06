import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { EditTaskDialog } from '@/components/project-details/EditTaskDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserRole } from '@/hooks/useUserRole';
import { useTasks } from '@/hooks/useTasks';
import { PageLoader } from '@/components/PageLoader';
import { useTranslation } from 'react-i18next';

export default function Tasks() {
  const navigate = useNavigate();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const { isClient } = useUserRole();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const loading = tasksLoading || permissionsLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : fr;

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
    todo: { label: t('tasks.statuses.todo'), variant: 'secondary' as const },
    in_progress: { label: t('tasks.statuses.in_progress'), variant: 'default' as const },
    done: { label: t('tasks.statuses.done'), variant: 'outline' as const },
  };

  const priorityConfig = {
    low: { label: t('tasks.priorities.low'), variant: 'secondary' as const },
    medium: { label: t('tasks.priorities.medium'), variant: 'default' as const },
    high: { label: t('tasks.priorities.high'), variant: 'destructive' as const },
  };

  const handleTaskClick = (task: any) => {
    if (isClient) return; // Clients cannot edit tasks
    setSelectedTask(task);
    setShowEditDialog(true);
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!canRead('tasks')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{t('common.accessDenied')}</p>
          <p className="text-muted-foreground">{t('tasks.noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('tasks.title')}</h1>
        <p className="text-muted-foreground">{t('tasks.subtitle')}</p>
      </div>

      {tasks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('tasks.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {tasks.length === 0 ? t('tasks.noTasks') : t('tasks.noTaskFound')}
          </p>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">{t('common.tryAnotherSearch')}</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={isClient ? "" : "cursor-pointer hover:bg-accent/50 transition-colors"}
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
                            {format(new Date(task.end_date), 'dd MMM yyyy', { locale: dateLocale })}
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
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
