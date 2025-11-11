import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, FileText, Receipt, Users, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { ClientInfoTab } from '@/components/client-details/ClientInfoTab';
import { ClientQuotesInvoicesTab } from '@/components/client-details/ClientQuotesInvoicesTab';
import { ClientMeetingNotesTab } from '@/components/client-details/ClientMeetingNotesTab';
import { ClientProjectsTab } from '@/components/client-details/ClientProjectsTab';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quotesInvoicesCount, setQuotesInvoicesCount] = useState(0);
  const [meetingNotesCount, setMeetingNotesCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchBadgeCounts();
    }
  }, [id]);

  const fetchBadgeCounts = async () => {
    if (!id) return;

    try {
      // Count quotes and invoices
      const [quotesResult, invoicesResult] = await Promise.all([
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', id),
        supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', id)
      ]);

      const totalQuotesInvoices = (quotesResult.count || 0) + (invoicesResult.count || 0);
      setQuotesInvoicesCount(totalQuotesInvoices);

      // Count meeting notes
      const { count: notes, error: notesError } = await supabase
        .from('meeting_notes')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id);

      if (notesError) throw notesError;
      setMeetingNotesCount(notes || 0);

      // Count projects
      const { count: projects, error: projectsError } = await supabase
        .from('project_clients')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id);

      if (projectsError) throw projectsError;
      setProjectsCount(projects || 0);
    } catch (error) {
      console.error('Error fetching badge counts:', error);
    }
  };

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

  const tabs: TabItem[] = [
    {
      value: 'info',
      label: 'Infos',
      icon: <FileText className="h-4 w-4" />,
      content: <ClientInfoTab client={client} onUpdate={fetchClientDetails} />
    },
    {
      value: 'quotes-invoices',
      label: 'Devis & Factures',
      icon: <Receipt className="h-4 w-4" />,
      badge: quotesInvoicesCount,
      content: <ClientQuotesInvoicesTab clientId={client.id} />
    },
    {
      value: 'meeting-notes',
      label: 'Comptes rendus',
      icon: <Users className="h-4 w-4" />,
      badge: meetingNotesCount,
      content: <ClientMeetingNotesTab clientId={client.id} />
    },
    {
      value: 'projects',
      label: 'Projets',
      icon: <FolderKanban className="h-4 w-4" />,
      badge: projectsCount,
      content: <ClientProjectsTab clientId={client.id} />
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
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

      <ResponsiveTabs defaultValue="info" tabs={tabs} />
    </div>
  );
}
