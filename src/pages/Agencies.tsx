import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AgencyCard } from '@/components/AgencyCard';
import { AddAgencyDialog } from '@/components/AddAgencyDialog';
import { toast } from 'sonner';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';

export default function Agencies() {
  const navigate = useNavigate();
  const { canRead } = usePermissions();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast.error('Erreur lors du chargement des agences');
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

  if (!canRead('agencies')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder aux agences</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agences</h1>
          <p className="text-muted-foreground">Gérez vos agences partenaires</p>
        </div>
        <ProtectedAction module="agencies" action="create">
          <AddAgencyDialog onAgencyAdded={fetchAgencies} />
        </ProtectedAction>
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
              onClick={() => navigate(`/agency/${agency.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
