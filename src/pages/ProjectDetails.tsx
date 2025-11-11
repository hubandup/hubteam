import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Edit, Trash2, FileText, Calendar, Users, MessageSquare, Paperclip, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProjectTeamTab } from '@/components/project-details/ProjectTeamTab';
import { ProjectTasksTab } from '@/components/project-details/ProjectTasksTab';
import { ProjectCommentsTab } from '@/components/project-details/ProjectCommentsTab';
import { ProjectAttachmentsTab } from '@/components/project-details/ProjectAttachmentsTab';
import { SelectClientDialog } from '@/components/project-details/SelectClientDialog';
import { EditProjectInfoDialog } from '@/components/project-details/EditProjectInfoDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { ProtectedAction } from '@/components/ProtectedAction';

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projectProgress, setProjectProgress] = useState({ completed: 0, total: 0, percentage: 0 });
  const [showSelectClientDialog, setShowSelectClientDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [unreadCommentsCount, setUnreadCommentsCount] = useState(0);
  const [attachmentsCount, setAttachmentsCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProjectDetails();
      fetchBadgeCounts();
    }
  }, [id]);

  const fetchBadgeCounts = async () => {
    if (!id) return;

    try {
      // Count pending tasks (not done)
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', id);

      if (tasksError) throw tasksError;
      const pending = tasks?.filter(t => t.status !== 'done').length || 0;
      setPendingTasksCount(pending);

      // Count attachments
      const { count: attachments, error: attachmentsError } = await supabase
        .from('project_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      if (attachmentsError) throw attachmentsError;
      setAttachmentsCount(attachments || 0);

      // For comments, we'll show total count as "unread" indicator
      const { count: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      if (commentsError) throw commentsError;
      setUnreadCommentsCount(comments || 0);
    } catch (error) {
      console.error('Error fetching badge counts:', error);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_clients (
            clients (
              id,
              company,
              first_name,
              last_name
            )
          ),
          tasks (
            id,
            status
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Calculate progress
      const tasks = data.tasks || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t: any) => t.status === 'done').length;
      const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      setProjectProgress({
        completed: completedTasks,
        total: totalTasks,
        percentage
      });
      
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Erreur lors du chargement du projet');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  // Refresh badge counts when project details change
  useEffect(() => {
    if (project && id) {
      fetchBadgeCounts();
    }
  }, [project, id]);

  const handleClientSelected = () => {
    fetchProjectDetails();
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    
    setDeleting(true);
    try {
      // Delete project (cascade will handle related records)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Projet supprimé avec succès');
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression du projet');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const statusConfig = {
    'planning': { label: 'Planification', variant: 'secondary' as const },
    'active': { label: 'Actif', variant: 'default' as const },
    'completed': { label: 'Terminé', variant: 'outline' as const },
  };

  const statusInfo = statusConfig[project.status as keyof typeof statusConfig] || statusConfig['active'];
  const client = project.project_clients?.[0]?.clients;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/projects')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
            <Badge variant={statusInfo.variant}>
              {statusInfo.label}
            </Badge>
            <ProtectedAction module="projects" action="update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </ProtectedAction>
            <ProtectedAction module="projects" action="delete">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </ProtectedAction>
          </div>
          {client && (
            <p className="text-muted-foreground mt-1">
              {client.company} - {client.first_name} {client.last_name}
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {projectProgress.total > 0 && (
        <Card className="border-0">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progression du projet</span>
                <span className="text-muted-foreground">
                  {projectProgress.completed}/{projectProgress.total} tâches terminées
                </span>
              </div>
              <Progress value={projectProgress.percentage} className="h-3" />
              <p className="text-xs text-muted-foreground text-right">
                {projectProgress.percentage}% complété
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <ResponsiveTabs
        defaultValue="info"
        tabs={[
          {
            value: 'info',
            label: 'Informations',
            icon: <Info className="h-4 w-4" />,
            content: (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Informations générales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {client ? (
                      <div className="flex items-start gap-3">
                        <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Client</p>
                          <p className="font-medium">
                            {client.company} - {client.first_name} {client.last_name}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-2">Client</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowSelectClientDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Sélectionner un client
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Nom du projet</p>
                        <p className="font-medium">{project.name}</p>
                      </div>
                    </div>

                    {project.description && (
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Description</p>
                          <p className="font-medium">{project.description}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dates & Statut</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {project.start_date && (
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Date de début</p>
                          <p className="font-medium">
                            {format(new Date(project.start_date), 'dd MMMM yyyy', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    )}

                    {project.end_date && (
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Date de fin</p>
                          <p className="font-medium">
                            {format(new Date(project.end_date), 'dd MMMM yyyy', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Statut</p>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          },
          {
            value: 'tasks',
            label: 'Tâches',
            icon: <FileText className="h-4 w-4" />,
            badge: pendingTasksCount,
            badgeVariant: pendingTasksCount > 0 ? 'destructive' : undefined,
            content: <ProjectTasksTab projectId={id!} />
          },
          {
            value: 'comments',
            label: 'Commentaires',
            icon: <MessageSquare className="h-4 w-4" />,
            badge: unreadCommentsCount,
            badgeVariant: unreadCommentsCount > 0 ? 'secondary' : undefined,
            content: <ProjectCommentsTab projectId={id!} />
          },
          {
            value: 'team',
            label: 'Équipe',
            icon: <Users className="h-4 w-4" />,
            content: <ProjectTeamTab projectId={id!} />
          },
          {
            value: 'attachments',
            label: 'Pièces jointes',
            icon: <Paperclip className="h-4 w-4" />,
            badge: attachmentsCount,
            content: <ProjectAttachmentsTab projectId={id!} />
          }
        ]}
      />

      <SelectClientDialog 
        open={showSelectClientDialog}
        onOpenChange={setShowSelectClientDialog}
        projectId={id!}
        onClientSelected={handleClientSelected}
      />

      {isAdmin && (
        <>
          <EditProjectInfoDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            project={project}
            onSuccess={fetchProjectDetails}
          />
          
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer le projet "{project.name}" ? 
                  Cette action est irréversible et supprimera également toutes les tâches, 
                  membres d'équipe et pièces jointes associés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProject}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    'Supprimer'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
