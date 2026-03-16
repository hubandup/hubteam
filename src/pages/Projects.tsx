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
import { Search, Archive, ArchiveRestore, Edit, Trash2 } from 'lucide-react';
import { ExportButton } from '@/components/exports/ExportButton';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, useArchivedProjects } from '@/hooks/useProjects';
import { PageLoader } from '@/components/PageLoader';
import { PendingQuoteActionsBanner } from '@/components/PendingQuoteActionsBanner';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list' | 'kanban';

const TABS = [
  { key: 'all',              label: 'Tous' },
  { key: 'planning',         label: 'À faire' },
  { key: 'reco_in_progress', label: 'Reco' },
  { key: 'active',           label: 'En cours' },
  { key: 'completed',        label: 'Terminés' },
  { key: 'lost',             label: 'Perdus' },
  { key: 'archived',         label: 'Archivés' },
];

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

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'active');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const urlQuery = searchParams.get('q');
    if (urlTab && urlTab !== activeTab) setActiveTab(urlTab);
    if (urlQuery !== null && urlQuery !== searchQuery) setSearchQuery(urlQuery);
  }, [searchParams]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams);
    if (newTab !== 'all') params.set('tab', newTab); else params.delete('tab');
    setSearchParams(params, { replace: true });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(searchParams);
    if (value) params.set('q', value); else params.delete('q');
    setSearchParams(params, { replace: true });
  };

  const unarchiveMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from('projects').update({ archived: false }).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
      toast.success(t('projects.unarchived'));
    },
    onError: () => toast.error(t('projects.unarchiveError')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
      toast.success(t('projects.deleted'));
      setProjectToDelete(null);
    },
    onError: () => { toast.error(t('projects.deleteError')); setProjectToDelete(null); },
  });

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('projects.statusUpdated'));
    } catch {
      toast.error(t('projects.statusUpdateError'));
    }
  };

  const filteredProjects = useMemo(() => {
    let filtered = activeTab === 'archived' ? archivedProjects : projects;
    if (activeTab !== 'all' && activeTab !== 'archived') {
      filtered = filtered.filter(project => project.status === activeTab);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.project_clients?.[0]?.clients?.company?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [projects, archivedProjects, activeTab, searchQuery]);

  // Stats counts
  const statusCounts = useMemo(() => ({
    all: projects.length,
    planning: projects.filter(p => p.status === 'planning').length,
    reco_in_progress: projects.filter(p => p.status === 'reco_in_progress').length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    lost: projects.filter(p => p.status === 'lost').length,
    archived: archivedProjects.length,
  }), [projects, archivedProjects]);

  if (loading) return <PageLoader />;
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
    <div className="space-y-0">
      <PendingQuoteActionsBanner />

      {/* Page title + actions */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-['Instrument_Sans'] font-bold text-[28px] text-foreground tracking-[-0.03em] leading-none mb-1">
            Projets
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble de tous vos projets actifs et archivés
          </p>
          {isMobile && !isClient && (
            <div className="mt-3">
              <ProtectedAction module="projects" action="create">
                <AddProjectDialog onProjectAdded={() => queryClient.invalidateQueries({ queryKey: ['projects'] })} />
              </ProtectedAction>
            </div>
          )}
        </div>
        {!isMobile && !isClient && (
          <div className="flex items-center gap-2">
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
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6">
        {[
          { num: statusCounts.all, label: 'Total projets' },
          { num: statusCounts.active, label: 'En cours' },
          { num: statusCounts.completed, label: 'Terminés' },
          { num: statusCounts.lost, label: 'Perdus' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-6">
            {i > 0 && <div className="w-px h-7 bg-border" />}
            <div>
              <div className="font-['Instrument_Sans'] font-bold text-[22px] text-foreground tracking-[-0.03em] leading-none">
                {s.num}
              </div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      {isMobile ? (
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-full mb-3 bg-card h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            {TABS.map(tab => (
              <SelectItem key={tab.key} value={tab.key}>
                {tab.label} ({statusCounts[tab.key as keyof typeof statusCounts] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex border-b border-border mb-5">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const count = statusCounts[tab.key as keyof typeof statusCounts] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "font-['Instrument_Sans'] font-semibold text-[13px] px-3.5 py-2.5 cursor-pointer border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 relative top-px",
                  isActive
                    ? "text-foreground border-foreground"
                    : "text-muted-foreground border-transparent hover:text-foreground/70"
                )}
              >
                {tab.key === 'archived' && <Archive className="h-3.5 w-3.5" />}
                {tab.label}
                <span className={cn(
                  "text-[11px] font-bold px-1.5 py-[1px] rounded-full",
                  isActive ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar: search + view toggle */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-muted border-border h-9 text-[13px] font-[Roboto,sans-serif] rounded-none"
          />
        </div>
        {!isMobile && (
          <div className="flex border border-border overflow-hidden">
            {(['grid', 'list', 'kanban'] as ViewMode[]).map((mode, i) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={mode}
                className={cn(
                  "px-2.5 py-[7px] flex items-center cursor-pointer transition-all duration-100",
                  i > 0 && "border-l border-border",
                  viewMode === mode
                    ? "bg-foreground text-accent"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === 'grid' && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" />
                    <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" />
                    <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" />
                    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
                  </svg>
                )}
                {mode === 'list' && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
                  </svg>
                )}
                {mode === 'kanban' && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor" opacity="0.5" />
                    <rect x="6" y="1" width="4" height="10" rx="1" fill="currentColor" />
                    <rect x="11" y="1" width="4" height="12" rx="1" fill="currentColor" opacity="0.7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'archived' ? (
          filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('projects.noArchivedProjects')}</p>
              <p className="text-sm text-muted-foreground mt-2">{t('projects.archivedAutoDescription')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{project.name}</CardTitle>
                        {project.project_clients?.[0]?.clients?.company && (
                          <CardDescription className="flex items-center gap-2">
                            {project.project_clients[0].clients.logo_url && (
                              <img src={project.project_clients[0].clients.logo_url} alt="" className="w-5 h-5 rounded object-cover" />
                            )}
                            {project.project_clients[0].clients.company}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary"><Archive className="h-3 w-3 mr-1" /> Archivé</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description}</p>}
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <ProtectedAction module="projects" action="update">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/project/${project.id}`)}>
                          <Edit className="h-4 w-4 mr-1" /> {t('common.edit')}
                        </Button>
                      </ProtectedAction>
                      <ProtectedAction module="projects" action="update">
                        <Button variant="outline" size="sm" onClick={() => unarchiveMutation.mutate(project.id)} disabled={unarchiveMutation.isPending}>
                          <ArchiveRestore className="h-4 w-4 mr-1" /> {t('common.unarchive')}
                        </Button>
                      </ProtectedAction>
                      <ProtectedAction module="projects" action="delete">
                        <Button variant="destructive" size="sm" onClick={() => setProjectToDelete(project.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
                        </Button>
                      </ProtectedAction>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 border border-border bg-card">
            <div className="font-['Instrument_Sans'] font-bold text-base text-foreground mb-1.5">
              Aucun projet trouvé
            </div>
            <div className="text-[13px] text-muted-foreground">
              Essayez d'autres mots-clés ou changez de filtre.
            </div>
          </div>
        ) : isMobile || viewMode === 'grid' ? (
          <div
            className="grid gap-px bg-border border border-border"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
          >
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
        )}
      </div>

      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('projects.confirmDeleteDescription')}</AlertDialogDescription>
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
