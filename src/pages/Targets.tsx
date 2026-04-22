import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientCard } from '@/components/ClientCard';
import { ClientKanbanView } from '@/components/ClientKanbanView';
import { ClientListView } from '@/components/ClientListView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LayoutGrid, Columns3, List, Search, Star, X } from 'lucide-react';
import { useTargets, useToggleTarget } from '@/hooks/useTargets';
import { PageLoader } from '@/components/PageLoader';
import { toast } from 'sonner';
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

export default function Targets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: targetIds, isLoading: targetsLoading } = useTargets();
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'grid'>(
    () => (localStorage.getItem('targets-view-mode') as any) || 'kanban'
  );
  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['targets-clients', Array.from(targetIds || [])],
    enabled: !!targetIds,
    queryFn: async () => {
      const ids = Array.from(targetIds || []);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .in('id', ids);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c: any) =>
        c.company?.toLowerCase().includes(q) ||
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const handleStageChange = async (clientId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ kanban_stage: newStage })
        .eq('id', clientId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['targets-clients'] });
      toast.success('Statut mis à jour');
    } catch (e) {
      toast.error('Erreur de mise à jour');
    }
  };

  const handleViewChange = (v: 'list' | 'kanban' | 'grid') => {
    setViewMode(v);
    localStorage.setItem('targets-view-mode', v);
  };

  if (targetsLoading || isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-shrink-0 pb-4 bg-background">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground mb-0.5 flex items-center gap-2">
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
              Targets
            </h1>
            <p className="text-muted-foreground text-xs md:text-base">
              Vos prospects/clients épinglés ({filtered.length})
            </p>
          </div>
          <div className="flex gap-1 border rounded-md">
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('kanban')}>
              <Columns3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('grid')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {clients.length > 0 && (
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-10"
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        {clients.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Aucun client dans Targets</p>
            <p className="text-sm text-muted-foreground mt-2">
              Cliquez sur l'étoile d'une fiche client dans le CRM pour l'ajouter ici.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun résultat</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-y-auto h-full pb-6">
            <ClientListView clients={filtered as any} onClientClick={(id) => navigate(`/client/${id}?tab=info`)} />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="h-full overflow-x-auto overflow-y-hidden pb-6">
            <div className="min-w-max">
              <ClientKanbanView
                clients={filtered as any}
                onClientClick={(id) => navigate(`/client/${id}?tab=info`)}
                onStageChange={handleStageChange}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((client: any) => (
                <ClientCard key={client.id} client={client} onClick={() => navigate(`/client/${client.id}?tab=info`)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
