import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClientCard } from '@/components/ClientCard';
import { AddClientDialog } from '@/components/AddClientDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erreur lors du chargement des clients');
      console.error(error);
    } else {
      setClients(data || []);
    }
    setLoading(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">Gérez vos clients et leurs projets</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau client
        </Button>
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
              onClick={() => toast.info('Détails du client à venir')}
            />
          ))}
        </div>
      )}

      <AddClientDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onClientAdded={fetchClients}
      />
    </div>
  );
}
