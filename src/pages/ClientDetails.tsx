import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, FileText, Receipt, Users, FolderKanban, Trash2, BarChart3 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { ClientInfoTab } from '@/components/client-details/ClientInfoTab';
import { ClientMeetingNotesTab } from '@/components/client-details/ClientMeetingNotesTab';
import { ClientProjectsTab } from '@/components/client-details/ClientProjectsTab';
import { ClientKDriveTab } from '@/components/client-details/ClientKDriveTab';
import { ClientInvoicesTab } from '@/components/client-details/ClientInvoicesTab';
import { ClientBoardTab } from '@/components/client-details/ClientBoardTab';
import { useUserRole } from '@/hooks/useUserRole';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meetingNotesCount, setMeetingNotesCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [kdriveFilesCount, setKdriveFilesCount] = useState(0);
  const [invoicesCount, setInvoicesCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchBadgeCounts();
    }
  }, [id]);

  const fetchBadgeCounts = async () => {
    if (!id) return;

    try {
      // Count invoices
      const { count: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id);

      if (invoicesError) throw invoicesError;
      setInvoicesCount(invoices || 0);

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

      // Count kDrive files if connected
      const { data: clientData } = await supabase
        .from('clients')
        .select('kdrive_folder_id, kdrive_drive_id')
        .eq('id', id)
        .single();

      if (clientData?.kdrive_folder_id && clientData?.kdrive_drive_id) {
        try {
          const { data: kdriveData } = await supabase.functions.invoke('kdrive-api', {
            body: {
              action: 'list-files',
              driveId: clientData.kdrive_drive_id,
              folderId: clientData.kdrive_folder_id,
            },
          });
          setKdriveFilesCount(Array.isArray(kdriveData?.data) ? kdriveData.data.length : 0);
        } catch (error) {
          console.error('Error fetching kDrive files:', error);
        }
      }
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
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Pas de ligne visible (RLS ou inexistant)
        setClient(null);
      } else {
        setClient(data);
      }
    } catch (error) {
      console.error('Error fetching client:', error);
      toast.error("Impossible d'afficher cette fiche client.");
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
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-2xl font-semibold">Fiche client introuvable</div>
          <p className="text-muted-foreground">
            Vous n’avez pas accès à cette fiche client ou elle n’existe pas.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Retour</Button>
            <Button onClick={() => navigate('/')}>Aller à l’accueil</Button>
          </div>
        </div>
      </div>
    );
  }

  const allTabs: TabItem[] = [
    {
      value: 'info',
      label: 'Infos',
      icon: <FileText className="h-4 w-4" />,
      content: <ClientInfoTab client={client} onUpdate={fetchClientDetails} />
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
    },
    {
      value: 'kdrive',
      label: 'kDrive',
      icon: <FolderKanban className="h-4 w-4" />,
      badge: kdriveFilesCount,
      content: <ClientKDriveTab clientId={client.id} />
    },
    {
      value: 'invoices',
      label: 'Factures',
      icon: <Receipt className="h-4 w-4" />,
      badge: invoicesCount,
      content: <ClientInvoicesTab clientId={client.id} />
    }
  ];

  // Filter out invoices tab for agency role
  const tabs = allTabs.filter(tab => 
    role !== 'agency' || tab.value !== 'invoices'
  );

  const handleDeleteClient = async () => {
    if (!id) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      toast.success('Client supprimé');
      navigate('/crm');
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors de la suppression du client');
    }
  };

  const canDelete = role === 'admin' || role === 'team';

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
            <h1 className="text-3xl font-bold text-foreground uppercase">
              {client.company}
            </h1>
            <p className="text-muted-foreground">{client.first_name} {client.last_name}</p>
          </div>
        </div>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-5 w-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Toutes les données associées (contacts, notes, factures) seront également supprimées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <ResponsiveTabs defaultValue="info" tabs={tabs} storageKey="client-tabs" />
    </div>
  );
}
