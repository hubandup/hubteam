import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { Search, LayoutGrid, List, Kanban, Archive, ArchiveRestore, Edit, Trash2 } from 'lucide-react';
import { ExportButton } from '@/components/exports/ExportButton';
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
import { PageLoader } from '@/components/PageLoader';
import { PendingQuoteActionsBanner } from '@/components/PendingQuoteActionsBanner';

export default function Projects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isClient } = useUserRole();
  const { user } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: archivedProjects = [], isLoading: archivedLoading } = useArchivedProjects();
  const loading = projectsLoading || archivedLoading || permissionsLoading;
  
  // Persist tab and search in URL params
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'all');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'kanban' | 'list'>('grid');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Sync state from URL on mount (when navigating back)
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const urlQuery = searchParams.get('q');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
    if (urlQuery !== null && urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
  }, [searchParams]);

  // Update URL when tab or search changes (user interaction)
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams);
    if (newTab !== 'all') {
      params.set('tab', newTab);
    } else {
      params.delete('tab');
    }
    setSearchParams(params, { replace: true });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  };

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
      toast.success(t('projects.unarchived'));
    },
    onError: (error) => {
      console.error('Error unarchiving project:', error);
      toast.error(t('projects.unarchiveError'));
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
      toast.success(t('projects.deleted'));
      setProjectToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting project:', error);
      toast.error(t('projects.deleteError'));
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

      toast.success(t('projects.statusUpdated'));
    } catch (error) {
      console.error('Error updating project status:', error);
      toast.error(t('projects.statusUpdateError'));
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
    return <PageLoader />;
  }

  if (!canRead('projects')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{t('common.accessDenied')}</p>
          <p className="text-muted-foreground">{t('projects.noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <PendingQuoteActionsBanner />
      
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-foreground mb-0.5">{t('projects.title')}</h1>
        <p className="text-muted-foreground text-xs md:text-base">{t('projects.subtitle')}</p>
        {isMobile && !isClient && (
          <div className="mt-3">
            <ProtectedAction module="projects" action="create">
              <AddProjectDialog onProjectAdded={() => queryClient.invalidateQueries({ queryKey: ['projects'] })} />
            </ProtectedAction>
          </div>
        )}
      </div>
      {!isMobile && !isClient && (
        <div className="flex justify-end gap-2">
          <ExportButton
            data={filteredProjects}
            columns={[
              { key: 'name', label: 'Projet' },
              { key: 'status', label: 'Statut' },
              { key: 'description', label: 'Description' },
              { key: 'start_date', label: 'Date début' },
              { key: 'end_date', label: 'Date fin' },
            ]}
            filename="projets"
          />
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
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
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
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-full mb-3 bg-background h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
             <SelectItem value="all">{t('projects.statuses.all')} ({projects.length})</SelectItem>
            <SelectItem value="planning">{t('projects.statuses.planning')} ({projects.filter(p => p.status === 'planning').length})</SelectItem>
            <SelectItem value="reco_in_progress">{t('projects.statuses.reco_in_progress')} ({projects.filter(p => p.status === 'reco_in_progress').length})</SelectItem>
            <SelectItem value="active">{t('projects.statuses.active')} ({projects.filter(p => p.status === 'active').length})</SelectItem>
            <SelectItem value="completed">{t('projects.statuses.completed')} ({projects.filter(p => p.status === 'completed').length})</SelectItem>
            <SelectItem value="lost">{t('projects.statuses.lost')} ({projects.filter(p => p.status === 'lost').length})</SelectItem>
            <SelectItem value="archived">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                {t('projects.statuses.archived')} ({archivedProjects.length})
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">{t('projects.statuses.all')} ({projects.length})</TabsTrigger>
            <TabsTrigger value="planning">{t('projects.statuses.planning')} ({projects.filter(p => p.status === 'planning').length})</TabsTrigger>
            <TabsTrigger value="reco_in_progress">{t('projects.statuses.reco_in_progress')} ({projects.filter(p => p.status === 'reco_in_progress').length})</TabsTrigger>
            <TabsTrigger value="active">{t('projects.statuses.active')} ({projects.filter(p => p.status === 'active').length})</TabsTrigger>
            <TabsTrigger value="completed">{t('projects.statuses.completed')} ({projects.filter(p => p.status === 'completed').length})</TabsTrigger>
            <TabsTrigger value="lost">{t('projects.statuses.lost')} ({projects.filter(p => p.status === 'lost').length})</TabsTrigger>
            <TabsTrigger value="archived">
              <Archive className="h-4 w-4 mr-1" />
              {t('projects.statuses.archived')} ({archivedProjects.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="mt-6">
        {activeTab === 'archived' ? (
          archivedProjects.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('projects.noArchivedProjects')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('projects.archivedAutoDescription')}
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
                           {t('common.edit')}
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
                           {t('common.unarchive')}
                        </Button>
                      </ProtectedAction>
                      <ProtectedAction module="projects" action="delete">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setProjectToDelete(project.id)}
                        >
                           <Trash2 className="h-4 w-4 mr-1" />
                           {t('common.delete')}
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
                  ? t('projects.noProjects')
                  : `${t('projects.noProjects')} ${t(`projects.noProjectStatus.${activeTab}`, '')}`
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('projects.startCreateProject')}
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
            <AlertDialogTitle>{t('projects.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projects.confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && deleteMutation.mutate(projectToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.deleteForever')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
