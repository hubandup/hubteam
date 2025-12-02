import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, Trash2, FileText, Calendar, Users, MessageSquare, Info, User, ExternalLink, ChevronDown } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProjectTeamTab } from '@/components/project-details/ProjectTeamTab';
import { ProjectTasksTab } from '@/components/project-details/ProjectTasksTab';
import { ProjectTasksNotebookTab } from '@/components/project-details/ProjectTasksNotebookTab';

import { ClientKDriveTab } from '@/components/client-details/ClientKDriveTab';
import { SelectClientDialog } from '@/components/project-details/SelectClientDialog';
import { EditProjectInfoDialog } from '@/components/project-details/EditProjectInfoDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowLeft } from 'lucide-react';
import { RecoTimeline } from '@/components/project-details/RecoTimeline';

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projectProgress, setProjectProgress] = useState({ completed: 0, total: 0, percentage: 0 });
  const [showSelectClientDialog, setShowSelectClientDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProjectDetails();
      fetchBadgeCounts();
    }

    // Écoute temps réel pour les changements de tâches
    const channel = supabase
      .channel('project-details-tasks')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks', 
        filter: `project_id=eq.${id}` 
      }, () => {
        fetchProjectDetails();
        fetchBadgeCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success('Statut mis à jour avec succès');
      fetchProjectDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise à jour du statut');
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
    'planning': { label: 'À faire', variant: 'secondary' as const, color: 'bg-[hsl(var(--status-planning))] text-[hsl(var(--status-planning-foreground))]' },
    'reco_in_progress': { label: 'Reco en cours', variant: 'default' as const, color: 'bg-[hsl(var(--status-reco-in-progress))] text-[hsl(var(--status-reco-in-progress-foreground))]' },
    'active': { label: 'En cours', variant: 'default' as const, color: 'bg-[hsl(var(--status-active))] text-[hsl(var(--status-active-foreground))]' },
    'urgent': { label: 'Urgent', variant: 'destructive' as const, color: 'bg-[hsl(var(--status-urgent))] text-[hsl(var(--status-urgent-foreground))]' },
    'completed': { label: 'Terminé', variant: 'outline' as const, color: 'bg-[hsl(var(--status-completed))] text-[hsl(var(--status-completed-foreground))]' },
    'lost': { label: 'Perdu', variant: 'destructive' as const, color: 'bg-[hsl(var(--status-lost))] text-[hsl(var(--status-lost-foreground))]' },
  };

  const statusInfo = statusConfig[project.status as keyof typeof statusConfig] || statusConfig['active'];
  const client = project.project_clients?.[0]?.clients;

  const StatusBadge = () => (
    <ProtectedAction module="projects" action="update">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={`h-auto px-3 py-1 rounded-full border-0 hover:opacity-80 ${statusInfo.color}`}
          >
            <span className="font-semibold text-sm">{statusInfo.label}</span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-background">
          {Object.entries(statusConfig).map(([key, config]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handleStatusChange(key)}
              className="cursor-pointer"
            >
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${config.color}`}>
                {config.label}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ProtectedAction>
  );

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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
            <StatusBadge />
            {!isMobile && (
              <>
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
              </>
            )}
          </div>
          {client && (
            <p className="text-muted-foreground mt-1">
              <span className="uppercase">{client.company}</span> - {client.first_name} {client.last_name}
            </p>
          )}
        </div>
      </div>

      {/* Progress Display - Conditional based on project status */}
      {project.status === 'reco_in_progress' ? (
        <RecoTimeline
          projectId={project.id}
          dates={{
            date_brief: project.date_brief,
            date_prise_en_main: project.date_prise_en_main,
            date_concertation_agences: project.date_concertation_agences,
            date_montage_reco: project.date_montage_reco,
            date_restitution: project.date_restitution,
          }}
          canEdit={isAdmin}
          onDatesUpdate={fetchProjectDetails}
        />
      ) : (
        <Card className="border-0 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-foreground">Progression du projet</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-primary">
                    {projectProgress.percentage}%
                  </span>
                </div>
              </div>
              <Progress value={projectProgress.percentage} className="h-4" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {projectProgress.completed} tâche{projectProgress.completed !== 1 ? 's' : ''} terminée{projectProgress.completed !== 1 ? 's' : ''}
                </span>
                <span>
                  {projectProgress.total} tâche{projectProgress.total !== 1 ? 's' : ''} au total
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <ResponsiveTabs
        defaultValue="tasks"
        storageKey="project-tabs"
        tabs={[
          {
            value: 'tasks',
            label: 'Tâches',
            icon: <FileText className="h-4 w-4" />,
            badge: pendingTasksCount,
            badgeVariant: pendingTasksCount > 0 ? 'destructive' : undefined,
            content: <ProjectTasksNotebookTab 
              projectId={id!} 
              onTasksChange={() => {
                fetchProjectDetails();
                fetchBadgeCounts();
              }}
            />
          },
          {
            value: 'team',
            label: 'Équipe',
            icon: <Users className="h-4 w-4" />,
            content: <ProjectTeamTab projectId={id!} />
          },
          {
            value: 'kdrive',
            label: 'kDrive',
            icon: <ExternalLink className="h-4 w-4" />,
            content: client ? (
              <ClientKDriveTab clientId={client.id} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucun client associé à ce projet
              </div>
            )
          },
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
                            <span className="uppercase">{client.company}</span> - {client.first_name} {client.last_name}
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground">Description</p>
                          <p className="font-medium break-words whitespace-pre-wrap">{project.description}</p>
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
                      <StatusBadge />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
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
