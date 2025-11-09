import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientCard } from '@/components/ClientCard';
import { AgencyCard } from '@/components/AgencyCard';
import { AddClientDialog } from '@/components/AddClientDialog';
import { AddAgencyDialog } from '@/components/AddAgencyDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function CRM() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsResult, agenciesResult] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('agencies')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (agenciesResult.error) throw agenciesResult.error;

      setClients(clientsResult.data || []);
      setAgencies(agenciesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">CRM</h1>
        <p className="text-muted-foreground">Gérez vos clients et agences partenaires</p>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList>
          <TabsTrigger value="clients">Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="agencies">Agences ({agencies.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <AddClientDialog onClientAdded={fetchData} />
          </div>

          {clients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucun client pour le moment</p>
              <p className="text-sm text-muted-foreground mt-2">Commencez par ajouter un nouveau client</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onClick={() => navigate(`/client/${client.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agencies" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <AddAgencyDialog onAgencyAdded={fetchData} />
          </div>

          {agencies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucune agence pour le moment</p>
              <p className="text-sm text-muted-foreground mt-2">Commencez par ajouter une nouvelle agence</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agencies.map((agency) => (
                <AgencyCard
                  key={agency.id}
                  agency={agency}
                  onClick={() => toast.info('Détails de l\'agence à venir')}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
