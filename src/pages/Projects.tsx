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
      queryClient.refetchQueries({ queryKey: ['projects'] });
      queryClient.refetchQueries({ queryKey: ['archived-projects'] });
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
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 16, color: '#000', marginBottom: 6 }}>
            {t('common.accessDenied')}
          </p>
          <p style={{ fontSize: 13, color: '#9A9A9A' }}>{t('projects.noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 bg-white min-h-screen p-7">
      <PendingQuoteActionsBanner />

      {/* ── Page title + actions ──────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 700,
            fontSize: 28,
            color: '#000',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: 4,
          }}>
            Projets
          </h1>
          <p style={{ fontSize: 13, color: '#9A9A9A' }}>
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

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
        {[
          { num: statusCounts.all,       label: 'Total projets' },
          { num: statusCounts.active,    label: 'En cours'      },
          { num: statusCounts.completed, label: 'Terminés'      },
          { num: statusCounts.lost,      label: 'Perdus'        },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {i > 0 && <div style={{ width: 1, height: 28, background: '#E8E8E8' }} />}
            <div>
              <div style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 700,
                fontSize: 22,
                color: '#000',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}>
                {s.num}
              </div>
              <div style={{ fontSize: 11, color: '#9A9A9A', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      {isMobile ? (
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-full mb-3 rounded-none border-[#D4D4D4] h-10 font-['Instrument_Sans'] font-semibold text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none border-[#D4D4D4]">
            {TABS.map(tab => (
              <SelectItem key={tab.key} value={tab.key} className="font-['Instrument_Sans'] font-semibold text-[13px]">
                {tab.label} ({statusCounts[tab.key as keyof typeof statusCounts] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E8E8', marginBottom: 20 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const count = statusCounts[tab.key as keyof typeof statusCounts] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  color: isActive ? '#000' : '#9A9A9A',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #000' : '2px solid transparent',
                  cursor: 'pointer',
                  position: 'relative',
                  top: 1,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.12s',
                }}
              >
                {tab.key === 'archived' && <Archive size={13} />}
                {tab.label}
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 99,
                  background: isActive ? '#E8FF4C' : '#F5F5F5',
                  color: isActive ? '#000' : '#6B6B6B',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9A9A9A' }} size={14} />
          <input
            type="text"
            placeholder="Rechercher un projet..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 36,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              border: '1px solid #D4D4D4',
              background: '#F5F5F5',
              fontFamily: 'Roboto, sans-serif',
              fontSize: 13,
              color: '#000',
              outline: 'none',
            }}
          />
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', border: '1px solid #D4D4D4', overflow: 'hidden' }}>
            {(['grid', 'list', 'kanban'] as ViewMode[]).map((mode, i) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={mode}
                style={{
                  padding: '7px 10px',
                  background: viewMode === mode ? '#000' : 'transparent',
                  color: viewMode === mode ? '#E8FF4C' : '#9A9A9A',
                  border: 'none',
                  borderLeft: i > 0 ? '1px solid #D4D4D4' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.1s',
                }}
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

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div>
        {activeTab === 'archived' ? (
          filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', border: '1px solid #E8E8E8' }}>
              <Archive size={40} style={{ margin: '0 auto 12px', color: '#C0C0C0' }} />
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#000', marginBottom: 4 }}>
                {t('projects.noArchivedProjects')}
              </p>
              <p style={{ fontSize: 12, color: '#9A9A9A' }}>{t('projects.archivedAutoDescription')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filteredProjects.map((project) => (
                <div key={project.id} style={{ border: '1px solid #E8E8E8', background: '#fff', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 15, color: '#000', letterSpacing: '-0.02em', marginBottom: 4 }}>
                        {project.name}
                      </div>
                      {project.project_clients?.[0]?.clients?.company && (
                        <div style={{ fontSize: 12, color: '#9A9A9A' }}>
                          {project.project_clients[0].clients.company}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      background: '#E8E8E8',
                      color: '#6B6B6B',
                    }}>
                      Archivé
                    </span>
                  </div>
                  {project.description && (
                    <p style={{ fontSize: 12, color: '#9A9A9A', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {project.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <ProtectedAction module="projects" action="update">
                      <button
                        onClick={() => navigate(`/project/${project.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 12, color: '#000', padding: '6px 12px', border: '1px solid #D4D4D4', background: 'transparent', cursor: 'pointer' }}
                      >
                        <Edit size={11} /> {t('common.edit')}
                      </button>
                    </ProtectedAction>
                    <ProtectedAction module="projects" action="update">
                      <button
                        onClick={() => unarchiveMutation.mutate(project.id)}
                        disabled={unarchiveMutation.isPending}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 12, color: '#000', padding: '6px 12px', border: '1px solid #D4D4D4', background: 'transparent', cursor: 'pointer' }}
                      >
                        <ArchiveRestore size={11} /> {t('common.unarchive')}
                      </button>
                    </ProtectedAction>
                    <ProtectedAction module="projects" action="delete">
                      <button
                        onClick={() => setProjectToDelete(project.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 12, color: '#fff', padding: '6px 12px', border: 'none', background: '#DC2626', cursor: 'pointer' }}
                      >
                        <Trash2 size={11} /> {t('common.delete')}
                      </button>
                    </ProtectedAction>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredProjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px', border: '1px solid #E8E8E8', background: '#fff' }}>
            <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 15, color: '#000', marginBottom: 6 }}>
              Aucun projet trouvé
            </div>
            <div style={{ fontSize: 13, color: '#9A9A9A' }}>
              Essayez d'autres mots-clés ou changez de filtre.
            </div>
          </div>
        ) : isMobile || viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
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

      {/* ── Dialog suppression ────────────────────────────────────────── */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent className="rounded-none border-[#E8E8E8]">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 16, color: '#000' }}>
              {t('projects.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: 'Roboto, sans-serif', fontSize: 13, color: '#6B6B6B' }}>
              {t('projects.confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-[#D4D4D4] font-['Instrument_Sans'] font-semibold text-sm">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && deleteMutation.mutate(projectToDelete)}
              className="rounded-none bg-[#DC2626] hover:bg-[#B91C1C] font-['Instrument_Sans'] font-bold text-sm"
            >
              {t('common.deleteForever')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
