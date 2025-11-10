import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientCard } from '@/components/ClientCard';
import { ClientKanbanView } from '@/components/ClientKanbanView';
import { AddClientDialog } from '@/components/AddClientDialog';
import { ImportClientsDialog } from '@/components/ImportClientsDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LayoutGrid, Columns3 } from 'lucide-react';
import { toast } from 'sonner';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';

export default function CRM() {
  const navigate = useNavigate();
  const { canRead } = usePermissions();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'grid'>('kanban');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      client.company?.toLowerCase().includes(query) ||
      client.first_name?.toLowerCase().includes(query) ||
      client.last_name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const handleStageChange = async (clientId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ kanban_stage: newStage })
        .eq('id', clientId);

      if (error) throw error;

      setClients((prev) =>
        prev.map((client) =>
          client.id === clientId ? { ...client, kanban_stage: newStage } : client
        )
      );

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">CRM</h1>
            <p className="text-muted-foreground">Gérez vos clients et leurs projets</p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 border rounded-md">
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
              <ImportClientsDialog onClientsImported={fetchClients} />
            </ProtectedAction>
            <ProtectedAction module="crm" action="create">
              <AddClientDialog onClientAdded={fetchClients} />
            </ProtectedAction>
          </div>
        </div>
      </div>

      {/* Search bar - Always visible */}
      {clients.length > 0 && (
        <div className="flex-shrink-0 px-6 pb-4 bg-background">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
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
        ) : viewMode === 'kanban' ? (
          <div className="h-full px-6 pb-6">
            <div className="h-full overflow-x-auto overflow-y-hidden">
              <div className="min-w-max">
                <ClientKanbanView
                  clients={filteredClients}
                  onClientClick={(clientId) => navigate(`/client/${clientId}`)}
                  onStageChange={handleStageChange}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onClick={() => navigate(`/client/${client.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
