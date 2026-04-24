import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, FileText, Receipt, Users, FolderKanban, Trash2,
  BarChart3, Briefcase, MoreHorizontal, User as UserIcon, Mail, Phone, Clock, Pencil,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClientInfoTab } from '@/components/client-details/ClientInfoTab';
import { ClientMeetingNotesTab } from '@/components/client-details/ClientMeetingNotesTab';
import { ClientProjectsTab } from '@/components/client-details/ClientProjectsTab';
import { ClientKDriveTab } from '@/components/client-details/ClientKDriveTab';
import { ClientInvoicesTab } from '@/components/client-details/ClientInvoicesTab';
import { ClientBoardTab } from '@/components/client-details/ClientBoardTab';
import { CommercialTrackingTab } from '@/components/client-details/CommercialTrackingTab';
import { ClientFollowupBanner } from '@/components/client-details/ClientFollowupBanner';
import { ClientCommercialSidebar } from '@/components/client-details/ClientCommercialSidebar';
import { EditClientDialog } from '@/components/EditClientDialog';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useUserRole } from '@/hooks/useUserRole';

interface TabDef {
  value: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  content: React.ReactNode;
}

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
  const [sectorName, setSectorName] = useState<string>('');
  const [statusName, setStatusName] = useState<string>('');
  const [sourceName, setSourceName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('commercial');

  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchBadgeCounts();
    }
  }, [id]);

  useEffect(() => {
    if (client) fetchTagsMeta();
  }, [client?.activity_sector_id, client?.status_id, client?.source_id]);

  const fetchTagsMeta = async () => {
    if (client?.activity_sector_id) {
      const { data } = await supabase.from('activity_sectors').select('name').eq('id', client.activity_sector_id).maybeSingle();
      setSectorName(data?.name || '');
    } else setSectorName('');
    if (client?.status_id) {
      const { data } = await supabase.from('client_statuses').select('name').eq('id', client.status_id).maybeSingle();
      setStatusName(data?.name || '');
    } else setStatusName('');
    if (client?.source_id) {
      const { data } = await supabase.from('client_sources').select('name').eq('id', client.source_id).maybeSingle();
      setSourceName(data?.name || '');
    } else setSourceName('');
  };

  const fetchBadgeCounts = async () => {
    if (!id) return;
    try {
      const { count: invoices } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('client_id', id);
      setInvoicesCount(invoices || 0);
      const { count: notes } = await supabase.from('meeting_notes').select('*', { count: 'exact', head: true }).eq('client_id', id);
      setMeetingNotesCount(notes || 0);
      const { count: projects } = await supabase.from('project_clients').select('*', { count: 'exact', head: true }).eq('client_id', id);
      setProjectsCount(projects || 0);
      const { data: clientData } = await supabase.from('clients').select('kdrive_folder_id, kdrive_drive_id').eq('id', id).single();
      if (clientData?.kdrive_folder_id && clientData?.kdrive_drive_id) {
        try {
          const { data: kdriveData } = await supabase.functions.invoke('kdrive-api', {
            body: { action: 'list-files', driveId: clientData.kdrive_drive_id, folderId: clientData.kdrive_folder_id },
          });
          setKdriveFilesCount(Array.isArray(kdriveData?.data) ? kdriveData.data.length : 0);
        } catch (e) { console.error(e); }
      }
    } catch (error) { console.error('Error fetching badge counts:', error); }
  };

  const fetchClientDetails = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      setClient(data || null);
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
          <div className="text-2xl font-semibold display">Fiche client introuvable</div>
          <p className="text-neutral-600">Vous n'avez pas accès à cette fiche client ou elle n'existe pas.</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Retour</Button>
            <Button onClick={() => navigate('/')}>Aller à l'accueil</Button>
          </div>
        </div>
      </div>
    );
  }

  const clientEmailDomain = client.email ? client.email.split('@')[1] : '';
  const hasBoardDomain = ['groupeseb.com', 'hubandup.com'].includes(clientEmailDomain);
  const canManageBoard = role === 'admin' || role === 'team' || role === 'agency';
  const hasBoardTab = hasBoardDomain && canManageBoard;
  const canDelete = role === 'admin' || role === 'team';

  const allTabs: TabDef[] = [
    ...(role === 'admin' ? [{
      value: 'commercial', label: 'Commercial', icon: <Briefcase className="h-4 w-4" />,
      content: <CommercialTrackingTab clientId={client.id} client={client} />,
    }] : []),
    { value: 'info', label: 'Infos', icon: <FileText className="h-4 w-4" />, content: <ClientInfoTab client={client} onUpdate={fetchClientDetails} /> },
    { value: 'meeting-notes', label: 'Comptes rendus', icon: <Users className="h-4 w-4" />, badge: meetingNotesCount, content: <ClientMeetingNotesTab clientId={client.id} /> },
    { value: 'projects', label: 'Projets', icon: <FolderKanban className="h-4 w-4" />, badge: projectsCount, content: <ClientProjectsTab clientId={client.id} /> },
    { value: 'kdrive', label: 'Documents', icon: <FolderKanban className="h-4 w-4" />, badge: kdriveFilesCount, content: <ClientKDriveTab clientId={client.id} /> },
    { value: 'invoices', label: 'Factures', icon: <Receipt className="h-4 w-4" />, badge: invoicesCount, content: <ClientInvoicesTab clientId={client.id} /> },
    ...(hasBoardTab ? [{ value: 'board', label: 'Board', icon: <BarChart3 className="h-4 w-4" />, content: <ClientBoardTab clientId={client.id} clientEmailDomain={clientEmailDomain} /> }] : []),
  ];
  const tabs = allTabs.filter(tab => role !== 'agency' || tab.value !== 'invoices');
  const currentTab = tabs.find(t => t.value === activeTab) ?? tabs[0];

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

  const initial = (client.company || '?').charAt(0).toUpperCase();
  const mainContactName = [client.first_name, client.last_name].filter(Boolean).join(' ');
  const lastInteractionLabel = client.last_contact
    ? `Dernière interaction : ${formatDistanceToNow(new Date(client.last_contact), { addSuffix: true, locale: fr })}`
    : null;

  const metaTags = [sectorName, statusName, sourceName ? `Source : ${sourceName}` : '', lastInteractionLabel || '']
    .filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
        {/* Back button */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-none -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
        </div>

        {/* HEADER + TABS dans le même conteneur blanc */}
        <div className="bg-white border border-neutral-200">
          {/* Header */}
          <div className="p-6 flex items-start gap-4">
            {/* Logo carré */}
            {client.logo_url ? (
              <img src={client.logo_url} alt={`${client.company} logo`} className="w-14 h-14 object-cover flex-shrink-0" />
            ) : (
              <div
                className="w-14 h-14 flex items-center justify-center flex-shrink-0 display"
                style={{ background: '#0f1422', color: '#ffffff', fontWeight: 700, fontSize: 20 }}
              >
                {initial}
              </div>
            )}

            {/* Bloc principal */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Ligne 1 : nom + badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="display" style={{ fontSize: 30, fontWeight: 700, color: '#0f1422', lineHeight: 1.1 }}>
                  {client.company}
                </h1>
                {statusName && (
                  <span
                    className="font-semibold tracking-wider uppercase"
                    style={{ background: '#E8FF4C', color: '#0f1422', padding: '2px 8px', fontSize: 10 }}
                  >
                    {statusName}
                  </span>
                )}
              </div>

              {/* Ligne 2 : contact / email / phone */}
              <div className="flex items-center flex-wrap text-[14px] text-neutral-600" style={{ gap: 20 }}>
                {mainContactName && (
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon size={14} /> {mainContactName}
                  </span>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-neutral-900">
                    <Mail size={14} /> {client.email}
                  </a>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-neutral-900">
                    <Phone size={14} /> {client.phone}
                  </a>
                )}
              </div>

              {/* Ligne 3 : tags meta */}
              {metaTags.length > 0 && (
                <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                  {metaTags.map((t, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-700"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                    >
                      {t.startsWith('Dernière interaction') && <Clock size={12} />}
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Menu actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-none flex-shrink-0">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-none">
                {canDelete && (
                  <>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Supprimer le client
                        </DropdownMenuItem>
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
                  </>
                )}
                {!canDelete && (
                  <DropdownMenuItem disabled>Aucune action disponible</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tabs sous le header dans le même conteneur */}
          <div className="border-t border-neutral-200 px-6">
            <div className="flex items-center overflow-x-auto" style={{ gap: 24 }}>
              {tabs.map((tab) => {
                const isActive = currentTab?.value === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      'py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px inline-flex items-center gap-2',
                      isActive
                        ? 'font-semibold'
                        : 'text-neutral-500 hover:text-neutral-800 border-transparent',
                    )}
                    style={isActive ? { color: '#0f1422', borderColor: '#0f1422' } : undefined}
                  >
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className="inline-flex items-center justify-center text-[11px] font-semibold"
                        style={{
                          minWidth: 18, height: 18, padding: '0 5px',
                          background: isActive ? '#0f1422' : '#e5e5e5',
                          color: isActive ? '#fff' : '#525252',
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* STRUCTURE PRÉPARÉE pour les prochaines étapes */}
        <div className="space-y-4">
          {/* Zone "actions commerciales" : bandeau Excuse de relance IA (admin only, onglet Commercial uniquement) */}
          {role === 'admin' && activeTab === 'commercial' && (
            <div data-zone="commercial-actions">
              <ClientFollowupBanner clientId={client.id} />
            </div>
          )}

          {/* Grid 2/3 + 1/3 (corps) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 min-w-0">
              {currentTab?.content}
            </div>
            <aside className="lg:col-span-1 min-w-0" data-zone="commercial-sidebar">
              <ClientCommercialSidebar client={client} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
