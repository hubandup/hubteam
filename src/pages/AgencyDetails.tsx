import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgencyInfoTab } from '@/components/agency-details/AgencyInfoTab';
import { AgencyProjectsTab } from '@/components/agency-details/AgencyProjectsTab';

export default function AgencyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchAgencyDetails();
    }
  }, [id]);

  const fetchAgencyDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAgency(data);
    } catch (error) {
      console.error('Error fetching agency:', error);
      toast.error("Erreur lors du chargement de l'agence");
      navigate('/agencies');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agency) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/agencies')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{agency.name}</h1>
          <p className="text-muted-foreground">Agence partenaire</p>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="projects">Projets</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <AgencyInfoTab agency={agency} onUpdate={fetchAgencyDetails} />
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <AgencyProjectsTab agencyId={agency.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
