import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientCard } from '@/components/ClientCard';
import { ClientKanbanView } from '@/components/ClientKanbanView';
import { ClientListView } from '@/components/ClientListView';
import { AddClientDialog } from '@/components/AddClientDialog';
import { ImportClientsValidationDialog } from '@/components/ImportClientsValidationDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, LayoutGrid, Columns3, ArrowDownUp, List } from 'lucide-react';
import { toast } from 'sonner';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { useClients } from '@/hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';

export default function CRM() {
  const navigate = useNavigate();
  const { canRead } = usePermissions();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: clients = [], isLoading: loading } = useClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'created_at' | 'revenue_current_year' | 'alphabetical'>('alphabetical');
  const [filterActive, setFilterActive] = useState(false);
  const [filterWithProjects, setFilterWithProjects] = useState(false);

  const filteredClients = useMemo(() => {
    let result = clients;
    
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
    
    // Apply active filter
    if (filterActive) {
      result = result.filter(client => client.active === true);
    }
    
    // Apply projects filter
    if (filterWithProjects) {
      result = result.filter(client => client.hasActiveProjects === true);
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
  }, [clients, searchQuery, sortBy, filterActive, filterWithProjects]);

  const handleStageChange = async (clientId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ kanban_stage: newStage })
        .eq('id', clientId);

      if (error) throw error;

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['clients'] });

      toast.success('Statut client mis à jour');
    } catch (error) {
      console.error('Error updating client stage:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!canRead('crm')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder au CRM</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header - Always visible */}
      <div className="flex-shrink-0 p-6 pb-4 bg-background">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground">Gérez vos clients et leurs projets</p>
          {isMobile && (
            <div className="mt-4">
              <ProtectedAction module="crm" action="create">
                <AddClientDialog onClientAdded={() => queryClient.invalidateQueries({ queryKey: ['clients'] })} />
              </ProtectedAction>
            </div>
          )}
        </div>
        {!isMobile && (
          <div className="flex gap-2 mt-4 justify-end">
            <div className="flex gap-1 border rounded-md">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                <Columns3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <ProtectedAction module="crm" action="create">
              <ImportClientsValidationDialog onClientsImported={() => queryClient.invalidateQueries({ queryKey: ['clients'] })} />
            </ProtectedAction>
            <ProtectedAction module="crm" action="create">
                <AddClientDialog onClientAdded={() => queryClient.invalidateQueries({ queryKey: ['clients'] })} />
            </ProtectedAction>
          </div>
        )}
      </div>

      {/* Search bar and filters - Always visible */}
      {clients.length > 0 && (
        <div className="flex-shrink-0 px-6 pb-4 bg-background space-y-3">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {!isMobile && (
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[240px]">
                  <ArrowDownUp className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trier par..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date de création</SelectItem>
                  <SelectItem value="alphabetical">Ordre alphabétique</SelectItem>
                  <SelectItem value="revenue_current_year">CA année fiscale ↓</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <Button
                variant={filterActive ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterActive(!filterActive)}
              >
                Actifs uniquement
              </Button>
              <Button
                variant={filterWithProjects ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterWithProjects(!filterWithProjects)}
              >
                Projets en cours
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Content area - Scrollable container */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {filteredClients.length === 0 && clients.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-muted-foreground">Aucun client pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">Commencez par ajouter un nouveau client</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-muted-foreground">Aucun client trouvé</p>
            <p className="text-sm text-muted-foreground mt-2">Essayez une autre recherche</p>
          </div>
        ) : isMobile ? (
          <div className="overflow-y-auto h-full px-6 pb-6">
            <div className="space-y-4">
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onClick={() => navigate(`/client/${client.id}?tab=info`)}
                />
              ))}
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-y-auto h-full px-6 pb-6">
            <ClientListView
              clients={filteredClients}
              onClientClick={(clientId) => navigate(`/client/${clientId}?tab=info`)}
            />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="h-full overflow-x-auto overflow-y-hidden px-6 pb-6 relative">
            <div className="min-w-max">
              <ClientKanbanView
                clients={filteredClients}
                onClientClick={(clientId) => navigate(`/client/${clientId}?tab=info`)}
                onStageChange={handleStageChange}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onClick={() => navigate(`/client/${client.id}?tab=info`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
