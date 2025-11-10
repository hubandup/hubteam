import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientInfoTab } from '@/components/client-details/ClientInfoTab';
import { ClientQuotesInvoicesTab } from '@/components/client-details/ClientQuotesInvoicesTab';
import { ClientMeetingNotesTab } from '@/components/client-details/ClientMeetingNotesTab';
import { ClientProjectsTab } from '@/components/client-details/ClientProjectsTab';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchClientDetails();
    }
  }, [id]);

  const fetchClientDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setClient(data);
    } catch (error) {
      console.error('Error fetching client:', error);
      toast.error('Erreur lors du chargement du client');
      navigate('/');
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

  if (!client) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          {client.logo_url && (
            <img
              src={client.logo_url}
              alt={`${client.company} logo`}
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {client.company}
            </h1>
            <p className="text-muted-foreground">{client.first_name} {client.last_name}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">Infos</TabsTrigger>
          <TabsTrigger value="quotes-invoices">Devis & Factures</TabsTrigger>
          <TabsTrigger value="meeting-notes">Comptes rendus</TabsTrigger>
          <TabsTrigger value="projects">Projets</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <ClientInfoTab client={client} onUpdate={fetchClientDetails} />
        </TabsContent>

        <TabsContent value="quotes-invoices" className="mt-6">
          <ClientQuotesInvoicesTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="meeting-notes" className="mt-6">
          <ClientMeetingNotesTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <ClientProjectsTab clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
