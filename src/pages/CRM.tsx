import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { ClientCard } from '@/components/ClientCard';
import { ClientKanbanView } from '@/components/ClientKanbanView';
import { ClientListView } from '@/components/ClientListView';
import { AddClientDialog } from '@/components/AddClientDialog';
import { ImportClientsValidationDialog } from '@/components/ImportClientsValidationDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, LayoutGrid, Columns3, ArrowDownUp, List, Archive, Plus, Download, Upload } from 'lucide-react';
import { ExportButton } from '@/components/exports/ExportButton';
import { toast } from 'sonner';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { useClients } from '@/hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchClientDetails } from '@/hooks/usePrefetchAppData';
import { useUserRole } from '@/hooks/useUserRole';
import { PageLoader } from '@/components/PageLoader';
import { PageHeader } from '@/components/layout';
import { PillButton, PillCounter, ToolbarSeparator } from '@/components/ui/pill-button';
import { PillSegmented } from '@/components/ui/pill-segmented';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  type ClientProjectFilterKey,
  type ProjectStatusKey,
} from '@/lib/project-status';
import { CRMMobile } from '@/components/crm/CRMMobile';
import { useProgressiveList } from '@/hooks/useProgressiveList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';




export default function CRM() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const { isAgency, loading: roleLoading } = useUserRole();
  const showRevenue = !roleLoading && !isAgency;
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const loading = clientsLoading || permissionsLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'grid'>(() => {
    return (localStorage.getItem('crm-view-mode') as 'list' | 'kanban' | 'grid') || 'kanban';
  });
  const [sortBy, setSortBy] = useState<'created_at' | 'revenue_current_year' | 'alphabetical'>(() => {
    return (localStorage.getItem('crm-sort-by') as 'created_at' | 'revenue_current_year' | 'alphabetical') || 'alphabetical';
  });
  const [filterWithProjects, setFilterWithProjects] = useState(() => {
    return localStorage.getItem('crm-filter-projects') === 'true';
  });
  const [showArchived, setShowArchived] = useState(() => {
    return localStorage.getItem('crm-show-archived') === 'true';
  });
  const [projectStatusFilter, setProjectStatusFilter] = useState<ClientProjectFilterKey>(() => {
    return (localStorage.getItem('crm-project-status-filter') as ClientProjectFilterKey) || 'all';
  });

  // Persist preferences to localStorage
  useEffect(() => { localStorage.setItem('crm-view-mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('crm-sort-by', sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem('crm-filter-projects', String(filterWithProjects)); }, [filterWithProjects]);
  useEffect(() => { localStorage.setItem('crm-show-archived', String(showArchived)); }, [showArchived]);
  useEffect(() => { localStorage.setItem('crm-project-status-filter', projectStatusFilter); }, [projectStatusFilter]);

  const filteredClients = useMemo(() => {
    let result = clients;
    
    // Filter by archived status (inactive = archived)
    if (showArchived) {
      result = result.filter(client => client.active === false);
    } else {
      result = result.filter(client => client.active === true);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(client =>
        client.company?.toLowerCase().includes(query) ||
        client.first_name?.toLowerCase().includes(query) ||
        client.last_name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply projects filter
    if (filterWithProjects) {
      result = result.filter(client => client.hasActiveProjects === true);
    }

    // Apply project state filter (multi-projects: keep client if ANY project matches)
    if (projectStatusFilter !== 'all') {
      result = result.filter((client) => {
        const statuses = client.projectStatuses || [];
        if (projectStatusFilter === 'none') return statuses.length === 0;
        return statuses.includes(projectStatusFilter as ProjectStatusKey);
      });
    }

    // Apply sorting
    if (sortBy === 'revenue_current_year') {
      result = [...result].sort((a, b) => {
        const aRevenue = a.revenue_current_year ?? 0;
        const bRevenue = b.revenue_current_year ?? 0;
        return bRevenue - aRevenue; // Descending order
      });
    } else if (sortBy === 'alphabetical') {
      result = [...result].sort((a, b) => {
        const aName = a.company?.toLowerCase() || '';
        const bName = b.company?.toLowerCase() || '';
        return aName.localeCompare(bName);
      });
    }
    
    return result;
  }, [clients, searchQuery, sortBy, filterWithProjects, showArchived, projectStatusFilter]);

  const archivedCount = useMemo(() => {
    return clients.filter(client => client.active === false).length;
  }, [clients]);

  // Progressive rendering for list/grid views (kanban stays complete for drag-drop).
  const {
    visible: visibleClients,
    hasMore: hasMoreClients,
    loadMore: loadMoreClients,
    sentinelRef: clientsSentinelRef,
    visibleCount: visibleClientsCount,
    total: totalClients,
  } = useProgressiveList(filteredClients, 30);


  const handleStageChange = async (clientId: string, newStage: string) => {
    // Snapshot pour rollback éventuel
    const previousClients = queryClient.getQueryData<any[]>(['clients']);

    // Patch optimiste : la card change de colonne instantanément
    queryClient.setQueryData<any[]>(['clients'], (old) =>
      (old || []).map((c) => (c.id === clientId ? { ...c, kanban_stage: newStage } : c)),
    );

    const { error } = await supabase
      .from('clients')
      .update({ kanban_stage: newStage })
      .eq('id', clientId);

    if (error) {
      // Rollback
      if (previousClients) queryClient.setQueryData(['clients'], previousClients);
      console.error('Error updating client stage:', error);
      toast.error(t('crm.statusUpdateError'));
      return;
    }

    // Sync final avec la base
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast.success(t('crm.statusUpdated'));
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!canRead('crm')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{t('common.accessDenied')}</p>
          <p className="text-muted-foreground">{t('crm.noPermission')}</p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <CRMMobile
        addClientOpen={addClientOpen}
        onAddClientOpenChange={setAddClientOpen}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* Header - Always visible */}
      <div className="flex-shrink-0 pb-2 md:pb-4 bg-background">
        <PageHeader
          title={showArchived ? t('crm.archivesTitle') : t('crm.title')}
          subtitle={showArchived ? t('crm.archivesSubtitle') : t('crm.subtitle')}
        />
        {!isMobile ? (
          <div className="flex items-center gap-2 flex-wrap w-full">
            <PillSegmented<'list' | 'kanban' | 'grid'>
              options={[
                { value: 'list', icon: List, label: 'Vue liste' },
                { value: 'kanban', icon: Columns3, label: 'Vue colonnes' },
                { value: 'grid', icon: LayoutGrid, label: 'Vue grille' },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />

            <ToolbarSeparator />

            <ExportButton
              data={filteredClients}
              columns={[
                { key: 'company', label: 'Société' },
                { key: 'first_name', label: 'Prénom' },
                { key: 'last_name', label: 'Nom' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Téléphone' },
                { key: 'kanban_stage', label: 'Étape' },
                ...(showRevenue ? [{ key: 'revenue_current_year', label: 'CA Année Fiscale', formatter: (v: any) => v ?? 0 }] : []),
              ]}
              filename="clients"
              renderTrigger={({ isExporting }) => (
                <PillButton type="button" disabled={isExporting}>
                  <Download size={16} strokeWidth={1.8} />
                  Exporter
                </PillButton>
              )}
            />

            <ProtectedAction module="crm" action="create">
              <ImportClientsValidationDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                hideTrigger
                onClientsImported={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
              />
              <PillButton type="button" onClick={() => setImportOpen(true)}>
                <Upload size={16} strokeWidth={1.8} />
                Importer
              </PillButton>
            </ProtectedAction>

            <PillButton
              type="button"
              variant={showArchived ? 'toggle-on' : 'outline'}
              aria-pressed={showArchived}
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive size={16} strokeWidth={1.8} />
              {t('crm.archives')}
              {archivedCount > 0 && (
                <PillCounter active={showArchived}>{archivedCount}</PillCounter>
              )}
            </PillButton>

            <ProtectedAction module="crm" action="create">
              <AddClientDialog
                open={addClientOpen}
                onOpenChange={setAddClientOpen}
                onClientAdded={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
              />
              <PillButton
                type="button"
                variant="primary"
                className="ml-auto"
                onClick={() => setAddClientOpen(true)}
              >
                <Plus size={16} strokeWidth={1.8} />
                Nouveau client
              </PillButton>
            </ProtectedAction>
          </div>
        ) : (
          <ProtectedAction module="crm" action="create">
            <AddClientDialog
              open={addClientOpen}
              onOpenChange={setAddClientOpen}
              onClientAdded={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
            />
            <PillButton type="button" variant="primary" onClick={() => setAddClientOpen(true)}>
              <Plus size={16} strokeWidth={1.8} />
              Nouveau client
            </PillButton>
          </ProtectedAction>
        )}

      </div>





      {/* Search bar and filters - Always visible */}
      {clients.length > 0 && (
        <div className="flex-shrink-0 pb-2 md:pb-4 bg-background space-y-2">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-card dark:bg-background h-10 text-sm"
            />
            </div>
            {!isMobile && (
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[240px]">
                  <ArrowDownUp className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trier par..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">{t('common.creationDate')}</SelectItem>
                  <SelectItem value="alphabetical">{t('common.alphabetical')}</SelectItem>
                  {showRevenue && (
                    <SelectItem value="revenue_current_year">{t('crm.revenueCurrentYear')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          {!isMobile && !showArchived && (
            <div className="flex gap-2 flex-wrap items-center">
              <Button
                variant={projectStatusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProjectStatusFilter('all')}
              >
                Tous
              </Button>
              {PROJECT_STATUS_ORDER.map((key) => (
                <Button
                  key={key}
                  variant={projectStatusFilter === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProjectStatusFilter(key)}
                >
                  {PROJECT_STATUS_LABELS[key]}
                </Button>
              ))}
              <Button
                variant={projectStatusFilter === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProjectStatusFilter('none')}
              >
                Sans projet
              </Button>
              <div className="mx-1 h-5 w-px bg-border" aria-hidden />
              <Button
                variant={filterWithProjects ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterWithProjects(!filterWithProjects)}
              >
                {t('common.ongoingProjects')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Content area - Scrollable container */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {filteredClients.length === 0 && clients.length === 0 ? (
          <div className="text-center py-12 px-4 md:px-6">
            <p className="text-muted-foreground">{t('crm.noClients')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('crm.startAddClient')}</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 px-4 md:px-6">
            <p className="text-muted-foreground">{t('crm.noClientFound')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('common.tryAnotherSearch')}</p>
          </div>
        ) : isMobile ? (
          <div className="overflow-y-auto h-full">
            <div className="space-y-3">
              {visibleClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onClick={() => navigate(`/client/${client.id}?tab=commercial`)}
                  onMouseEnter={() => prefetchClientDetails(queryClient, client.id)}
                />
              ))}
            </div>
            <LoadMoreSentinel
              ref={clientsSentinelRef}
              hasMore={hasMoreClients}
              onLoadMore={loadMoreClients}
              visible={visibleClientsCount}
              total={totalClients}
            />
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-y-auto h-full px-6 pb-6">
            <ClientListView
              clients={visibleClients}
              onClientClick={(clientId) => navigate(`/client/${clientId}?tab=commercial`)}
              onClientHover={(clientId) => prefetchClientDetails(queryClient, clientId)}
            />
            <LoadMoreSentinel
              ref={clientsSentinelRef}
              hasMore={hasMoreClients}
              onLoadMore={loadMoreClients}
              visible={visibleClientsCount}
              total={totalClients}
            />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="h-full overflow-x-auto overflow-y-hidden px-6 pb-6 relative">
            <div className="min-w-max">
              <ClientKanbanView
                clients={filteredClients}
                onClientClick={(clientId) => navigate(`/client/${clientId}?tab=commercial`)}
                onClientHover={(clientId) => prefetchClientDetails(queryClient, clientId)}
                onStageChange={handleStageChange}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onClick={() => navigate(`/client/${client.id}?tab=commercial`)}
                    onMouseEnter={() => prefetchClientDetails(queryClient, client.id)}
                  />
                ))}
            </div>
            <LoadMoreSentinel
              ref={clientsSentinelRef}
              hasMore={hasMoreClients}
              onLoadMore={loadMoreClients}
              visible={visibleClientsCount}
              total={totalClients}
            />
          </div>
        )}
      </div>
    </div>
  );
}
