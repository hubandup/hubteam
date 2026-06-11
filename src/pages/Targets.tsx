import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientKanbanView } from '@/components/ClientKanbanView';
import { ClientListView } from '@/components/ClientListView';
import { Input } from '@/components/ui/input';
import { LayoutGrid, Columns3, List, Star, Plus } from 'lucide-react';
import { useTargets } from '@/hooks/useTargets';
import { PageLoader } from '@/components/PageLoader';
import { toast } from 'sonner';
import { TargetCard } from '@/components/targets/TargetCard';
import { getUrgency, getStatusBucket, type UrgencyBucket } from '@/components/targets/targetUtils';
import { AddClientDialog } from '@/components/AddClientDialog';
import { PageHeader, ViewToggle, SearchFilterBar, SectionHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


type ViewMode = 'list' | 'kanban' | 'grid';
type StatusFilter = 'all' | 'prospect' | 'client' | 'relancer';

const PAGE_SIZE = 50;

const SECTION_META: Record<Exclude<UrgencyBucket, 'none'> | 'noneOrFuture', {
  title: string;
  color: string;
}> = {
  late: { title: 'En retard', color: '#DC2626' },
  week: { title: 'Cette semaine', color: '#EA580C' },
  month: { title: 'À venir / Sans échéance', color: 'hsl(var(--muted-foreground))' },
  noneOrFuture: { title: 'À venir / Sans échéance', color: 'hsl(var(--muted-foreground))' },
};

export default function Targets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: targetIds, isLoading: targetsLoading } = useTargets();
  

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('targets-view-mode') as ViewMode) || 'grid'
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['targets-clients', Array.from(targetIds || [])],
    enabled: !!targetIds,
    queryFn: async () => {
      const ids = Array.from(targetIds || []);
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from('clients').select('*').in('id', ids);
      if (error) throw error;
      return data || [];
    },
  });

  // Recherche temps réel sur company / first_name / last_name
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c: any) =>
        c.company?.toLowerCase().includes(q) ||
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  // Compteurs (sur la base recherche, avant filtre statut)
  const counts = useMemo(() => {
    const c = { all: searched.length, prospect: 0, client: 0, relancer: 0 };
    for (const cl of searched as any[]) {
      const b = getStatusBucket(cl.kanban_stage, cl.follow_up_date);
      c[b]++;
    }
    return c;
  }, [searched]);

  // Filtre statut
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return searched;
    return (searched as any[]).filter(
      (c) => getStatusBucket(c.kanban_stage, c.follow_up_date) === statusFilter,
    );
  }, [searched, statusFilter]);

  // Regroupement par urgence pour la grille
  const sections = useMemo(() => {
    const late: any[] = [];
    const week: any[] = [];
    const rest: any[] = []; // month + none

    for (const cl of filtered as any[]) {
      const u = getUrgency(cl.follow_up_date);
      if (u.bucket === 'late') late.push(cl);
      else if (u.bucket === 'week') week.push(cl);
      else rest.push(cl);
    }

    const byDeadlineAsc = (a: any, b: any) => {
      const da = a.follow_up_date ? new Date(a.follow_up_date).getTime() : Infinity;
      const db = b.follow_up_date ? new Date(b.follow_up_date).getTime() : Infinity;
      return da - db;
    };
    late.sort(byDeadlineAsc);
    week.sort(byDeadlineAsc);
    rest.sort(byDeadlineAsc); // none → Infinity → naturellement à la fin

    return { late, week, rest };
  }, [filtered]);

  // Pagination plate (à travers les sections)
  const paginatedFlat = useMemo(() => {
    const order = [...sections.late, ...sections.week, ...sections.rest];
    return order.slice(0, visibleCount);
  }, [sections, visibleCount]);

  const paginatedSet = useMemo(() => new Set(paginatedFlat.map((c: any) => c.id)), [paginatedFlat]);

  const visibleSections = useMemo(
    () => ({
      late: sections.late.filter((c: any) => paginatedSet.has(c.id)),
      week: sections.week.filter((c: any) => paginatedSet.has(c.id)),
      rest: sections.rest.filter((c: any) => paginatedSet.has(c.id)),
    }),
    [sections, paginatedSet],
  );

  const totalAfterFilters = filtered.length;
  const hasMore = totalAfterFilters > paginatedFlat.length;

  const handleStageChange = async (clientId: string, newStage: string) => {
    try {
      const { error } = await supabase.from('clients').update({ kanban_stage: newStage }).eq('id', clientId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['targets-clients'] });
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Erreur de mise à jour');
    }
  };

  const handleViewChange = (v: ViewMode) => {
    setViewMode(v);
    localStorage.setItem('targets-view-mode', v);
  };

  const handleClientCreated = async (created?: { id: string }) => {
    setAddOpen(false);
    if (created?.id) {
      // Pin automatiquement comme target
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from('client_targets').insert({
          client_id: created.id,
          starred_by: userData.user?.id,
        });
        qc.invalidateQueries({ queryKey: ['client-targets'] });
        qc.invalidateQueries({ queryKey: ['targets-clients'] });
        toast.success('Client ajouté aux Targets');
      } catch (e: any) {
        toast.error(e?.message || "Impossible d'épingler ce client");
      }
    }
  };

  if (targetsLoading || isLoading) return <PageLoader />;

  const goClient = (id: string) => navigate(`/client/${id}?tab=info`);

  return (
    <div className="flex flex-col min-h-full -mx-5 md:-mx-8 -mt-4 px-5 md:px-8 pt-4 pb-8 bg-background">
      <PageHeader
        title="Targets"
        subtitle={`Vos prospects et clients prioritaires (${totalAfterFilters})`}
        actions={
          <>
            <ViewToggle
              options={[
                { value: 'list', icon: List, label: 'Vue liste' },
                { value: 'kanban', icon: Columns3, label: 'Vue kanban' },
                { value: 'grid', icon: LayoutGrid, label: 'Vue grille' },
              ]}
              value={viewMode}
              onChange={handleViewChange}
            />
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus />
              Ajouter un target
            </Button>
          </>
        }
      />

      {clients.length > 0 && (
        <SearchFilterBar
          className="mb-4"
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setVisibleCount(PAGE_SIZE);
          }}
          searchPlaceholder="Rechercher une entreprise ou un contact..."
          activeFilter={statusFilter}
          onFilterChange={(k) => {
            setStatusFilter(k as StatusFilter);
            setVisibleCount(PAGE_SIZE);
          }}
          filters={[
            { key: 'all', label: 'Tous', count: counts.all },
            { key: 'prospect', label: 'Prospects', count: counts.prospect },
            { key: 'client', label: 'Clients actifs', count: counts.client },
            { key: 'relancer', label: 'À relancer', count: counts.relancer },
          ]}
        />
      )}

      </div>

      {/* Contenu */}
      <div className="min-w-0">
        {clients.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Aucun client dans Targets</p>
            <p className="text-sm text-muted-foreground mt-2">
              Cliquez sur l'étoile d'une fiche client dans le CRM pour l'ajouter ici.
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="pb-6">
            <ClientListView clients={filtered as any} onClientClick={goClient} />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="overflow-x-auto pb-6">
            <div className="min-w-max">
              <ClientKanbanView
                clients={filtered as any}
                onClientClick={goClient}
                onStageChange={handleStageChange}
              />
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border p-12 text-center">
            <p className="text-sm text-muted-foreground font-roboto">
              Aucun target ne correspond à ces filtres.
            </p>
          </div>
        ) : (
          <div className="space-y-8 pb-8">
            {visibleSections.late.length > 0 && (
              <SectionBlock
                title="En retard"
                color="#DC2626"
                count={sections.late.length}
                items={visibleSections.late}
                onClick={goClient}
              />
            )}
            {visibleSections.week.length > 0 && (
              <SectionBlock
                title="Cette semaine"
                color="#EA580C"
                count={sections.week.length}
                items={visibleSections.week}
                onClick={goClient}
              />
            )}
            {visibleSections.rest.length > 0 && (
              <SectionBlock
                title="À venir / Sans échéance"
                color="hsl(var(--muted-foreground))"
                count={sections.rest.length}
                items={visibleSections.rest}
                onClick={goClient}
              />
            )}

            {hasMore && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-4 py-2 text-xs font-semibold bg-card text-foreground border border-border hover:border-foreground/40 transition-colors"
                >
                  Charger plus ({totalAfterFilters - paginatedFlat.length} restants)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add client dialog (controlled, no trigger button rendered) */}
      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} onClientAdded={handleClientCreated} />
    </div>
  );
}

function SectionBlock({
  title,
  color,
  count,
  items,
  onClick,
}: {
  title: string;
  color: string;
  count: number;
  items: any[];
  onClick: (id: string) => void;
}) {
  return (
    <section>
      <header className="flex items-center gap-3 mb-3">
        <span className="block" style={{ width: 4, height: 20, background: color }} />
        <h2 className="font-display font-bold uppercase tracking-wider text-sm text-foreground">
          {title}
        </h2>
        <span className="text-xs font-semibold px-1.5 py-0.5 bg-foreground text-background">
          {count}
        </span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((c: any) => (
          <TargetCard key={c.id} client={c} onClick={() => onClick(c.id)} />
        ))}
      </div>
    </section>
  );
}
