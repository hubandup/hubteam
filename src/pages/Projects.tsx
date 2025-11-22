import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectKanbanView } from '@/components/ProjectKanbanView';
import { ProjectListView } from '@/components/ProjectListView';
import { AddProjectDialog } from '@/components/AddProjectDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, LayoutGrid, List, Kanban, Archive, ArchiveRestore, Edit, Trash2 } from 'lucide-react';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, useArchivedProjects } from '@/hooks/useProjects';

export default function Projects() {
  const navigate = useNavigate();
  const { canRead } = usePermissions();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isClient } = useUserRole();
  const { user } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: archivedProjects = [], isLoading: archivedLoading } = useArchivedProjects();
  const loading = projectsLoading || archivedLoading;
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'kanban' | 'list'>('grid');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const unarchiveMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .update({ archived: false })
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
      toast.success('Projet désarchivé avec succès');
    },
    onError: (error) => {
      console.error('Error unarchiving project:', error);
      toast.error('Erreur lors de la désarchivage du projet');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
      toast.success('Projet supprimé définitivement');
      setProjectToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression du projet');
      setProjectToDelete(null);
    },
  });

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId);

      if (error) throw error;

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast.success('Statut du projet mis à jour');
    } catch (error) {
      console.error('Error updating project status:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(project => project.status === activeTab);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.project_clients?.[0]?.clients?.company?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [projects, activeTab, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canRead('projects')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder aux projets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-foreground mb-0.5">Projets</h1>
        <p className="text-muted-foreground text-xs md:text-base">Gérez tous vos projets</p>
        {isMobile && !isClient && (
          <div className="mt-3">
            <ProtectedAction module="projects" action="create">
              <AddProjectDialog onProjectAdded={() => queryClient.invalidateQueries({ queryKey: ['projects'] })} />
            </ProtectedAction>
          </div>
        )}
      </div>
      {!isMobile && !isClient && (
        <div className="flex justify-end">
          <ProtectedAction module="projects" action="create">
              <AddProjectDialog onProjectAdded={() => queryClient.invalidateQueries({ queryKey: ['projects'] })} />
          </ProtectedAction>
        </div>
      )}

      {projects.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-white dark:bg-background h-10 text-sm"
            />
          </div>
          {!isMobile && (
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                <Kanban className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

{isMobile ? (
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full mb-3 bg-background h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <SelectItem value="all">Tous ({projects.length})</SelectItem>
            <SelectItem value="planning">À faire ({projects.filter(p => p.status === 'planning').length})</SelectItem>
            <SelectItem value="reco_in_progress">Reco en cours ({projects.filter(p => p.status === 'reco_in_progress').length})</SelectItem>
            <SelectItem value="active">En cours ({projects.filter(p => p.status === 'active').length})</SelectItem>
            <SelectItem value="completed">Terminés ({projects.filter(p => p.status === 'completed').length})</SelectItem>
            <SelectItem value="lost">Perdu ({projects.filter(p => p.status === 'lost').length})</SelectItem>
            <SelectItem value="archived">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archivés ({archivedProjects.length})
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Tous ({projects.length})</TabsTrigger>
            <TabsTrigger value="planning">À faire ({projects.filter(p => p.status === 'planning').length})</TabsTrigger>
            <TabsTrigger value="reco_in_progress">Reco en cours ({projects.filter(p => p.status === 'reco_in_progress').length})</TabsTrigger>
            <TabsTrigger value="active">En cours ({projects.filter(p => p.status === 'active').length})</TabsTrigger>
            <TabsTrigger value="completed">Terminés ({projects.filter(p => p.status === 'completed').length})</TabsTrigger>
            <TabsTrigger value="lost">Perdu ({projects.filter(p => p.status === 'lost').length})</TabsTrigger>
            <TabsTrigger value="archived">
              <Archive className="h-4 w-4 mr-1" />
              Archivés ({archivedProjects.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="mt-6">
        {activeTab === 'archived' ? (
          archivedProjects.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun projet archivé</p>
              <p className="text-sm text-muted-foreground mt-2">
                Les projets soldés de l'année fiscale précédente seront automatiquement archivés
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {archivedProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{project.name}</CardTitle>
                        {project.project_clients?.[0]?.clients?.company && (
                          <CardDescription className="flex items-center gap-2">
                            {project.project_clients[0].clients.logo_url && (
                              <img 
                                src={project.project_clients[0].clients.logo_url} 
                                alt="" 
                                className="w-5 h-5 rounded object-cover"
                              />
                            )}
                            {project.project_clients[0].clients.company}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary">
                        <Archive className="h-3 w-3 mr-1" />
                        Archivé
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <ProtectedAction module="projects" action="update">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/project/${project.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                      </ProtectedAction>
                      <ProtectedAction module="projects" action="update">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unarchiveMutation.mutate(project.id)}
                          disabled={unarchiveMutation.isPending}
                        >
                          <ArchiveRestore className="h-4 w-4 mr-1" />
                          Désarchiver
                        </Button>
                      </ProtectedAction>
                      <ProtectedAction module="projects" action="delete">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setProjectToDelete(project.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Supprimer
                        </Button>
                      </ProtectedAction>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeTab === 'all' 
                  ? 'Aucun projet pour le moment' 
                  : `Aucun projet ${
                      activeTab === 'planning' ? 'à faire' : 
                      activeTab === 'reco_in_progress' ? 'en reco' :
                      activeTab === 'active' ? 'en cours' : 
                      activeTab === 'lost' ? 'perdu' :
                      'terminé'
                    }`
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Commencez par créer un nouveau projet
              </p>
            </div>
          ) : isMobile || viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => navigate(`/project/${project.id}`)}
                />
              ))}
            </div>
          ) : viewMode === 'kanban' ? (
            <ProjectKanbanView 
              projects={filteredProjects}
              onProjectClick={(id) => navigate(`/project/${id}`)}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <ProjectListView 
              projects={filteredProjects}
              onProjectClick={(id) => navigate(`/project/${id}`)}
            />
          )
        )}
      </div>

      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement ce projet ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && deleteMutation.mutate(projectToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
