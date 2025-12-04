import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Loader2, Plus, Trash2, Edit, Copy } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AddProjectDialog } from '@/components/AddProjectDialog';
import { EditProjectInfoDialog } from '@/components/project-details/EditProjectInfoDialog';
import { useUserRole } from '@/hooks/useUserRole';
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

interface ClientProjectsTabProps {
  clientId: string;
}

export function ClientProjectsTab({ clientId }: ClientProjectsTabProps) {
  const navigate = useNavigate();
  const { isAgency } = useUserRole();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);

  useEffect(() => {
    fetchProjects();
  }, [clientId]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('project_clients')
        .select(`
          project_id,
          projects (
            id,
            name,
            description,
            status,
            start_date,
            end_date,
            created_at
          )
        `)
        .eq('client_id', clientId);

      if (error) throw error;
      
      const projectsData = data?.map((item: any) => item.projects).filter(Boolean) || [];
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        {!isAgency && (
          <div className="flex justify-end">
            <AddProjectDialog onProjectAdded={fetchProjects} />
          </div>
        )}
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Aucun projet associé à ce client pour le moment
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      active: 'default',
      completed: 'secondary',
      planning: 'outline',
    };
    const labels: Record<string, string> = {
      active: 'En cours',
      completed: 'Terminé',
      planning: 'À faire',
      reco_in_progress: 'Reco en cours',
      lost: 'Perdu',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const isProjectOverdue = (project: any) => {
    return project.end_date && 
           project.status !== 'completed' && 
           isPast(new Date(project.end_date));
  };

  const handleEdit = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    setSelectedProject(project);
    setEditDialogOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);

      if (error) throw error;

      toast.success('Projet supprimé avec succès');
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression du projet');
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();

    try {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          name: `${project.name} (copie)`,
          description: project.description,
          status: 'planning',
          start_date: project.start_date,
          end_date: project.end_date,
        })
        .select()
        .single();

      if (error) throw error;

      // Duplicate project-client relationship
      const { error: clientError } = await supabase
        .from('project_clients' as any)
        .insert({
          project_id: newProject.id,
          client_id: clientId,
        });

      if (clientError) throw clientError;

      toast.success('Projet dupliqué avec succès');
      fetchProjects();
    } catch (error) {
      console.error('Error duplicating project:', error);
      toast.error('Erreur lors de la duplication du projet');
    }
  };

  return (
    <>
      <div className="space-y-4">
        {!isAgency && (
          <div className="flex justify-end">
            <AddProjectDialog onProjectAdded={fetchProjects} />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const isCompleted = project.status === 'completed';
            return (
              <Card 
                key={project.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className={`text-lg ${isCompleted ? 'text-muted-foreground' : ''}`}>
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className={`mt-2 ${isCompleted ? 'text-muted-foreground/70' : ''}`}>
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(project.status)}
                      {!isAgency && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => handleEdit(e, project)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => handleDuplicate(e, project)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => handleDelete(e, project)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {project.start_date && (
                    <div className={`flex items-center gap-2 text-sm ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      <Calendar className="h-4 w-4" />
                      <span>
                        Début: {format(new Date(project.start_date), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  )}
                  {project.end_date && (
                    <div className={`flex items-center gap-2 text-sm ${isProjectOverdue(project) ? 'text-destructive font-semibold' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      <Calendar className="h-4 w-4" />
                      <span>
                        Fin: {format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
                        {isProjectOverdue(project) && ' (En retard)'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {selectedProject && (
        <EditProjectInfoDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          project={selectedProject}
          onSuccess={() => {
            fetchProjects();
            setEditDialogOpen(false);
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le projet "{projectToDelete?.name}" ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
