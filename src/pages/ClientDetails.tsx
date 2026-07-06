import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, FileText, Receipt, Users, FolderKanban, Trash2,
  BarChart3, Briefcase, MoreHorizontal, User as UserIcon, Mail, Phone, Clock, Pencil, CheckSquare,
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
import { PillButton } from '@/components/ui/pill-button';
import { cn } from '@/lib/utils';
import { ClientInfoTab } from '@/components/client-details/ClientInfoTab';
import { ClientMeetingNotesTab } from '@/components/client-details/ClientMeetingNotesTab';
import { ClientProjectsTab } from '@/components/client-details/ClientProjectsTab';
import { ClientKDriveTab } from '@/components/client-details/ClientKDriveTab';
import { ClientInvoicesTab } from '@/components/client-details/ClientInvoicesTab';
import { ClientBoardTab } from '@/components/client-details/ClientBoardTab';
import { ClientTasksTab } from '@/components/client-details/ClientTasksTab';
import { EmbeddedProjectView } from '@/components/client-details/EmbeddedProjectView';
import { CommercialTrackingTab } from '@/components/client-details/CommercialTrackingTab';
import { ClientFollowupBanner } from '@/components/client-details/ClientFollowupBanner';
import { ClientCommercialSidebar } from '@/components/client-details/ClientCommercialSidebar';
import { EditClientDialog } from '@/components/EditClientDialog';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';


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
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useUserRole();
  const { canRead } = usePermissions();

  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meetingNotesCount, setMeetingNotesCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [kdriveFilesCount, setKdriveFilesCount] = useState(0);
  const [invoicesCount, setInvoicesCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [sectorName, setSectorName] = useState<string>('');
  const [statusName, setStatusName] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sourceName, setSourceName] = useState<string>('');
  const [hubOwner, setHubOwner] = useState<{ first_name: string | null; last_name: string | null; avatar_url: string | null } | null>(null);

  // Tab + embedded-project state driven by URL (?tab=... & project=... & subtab=...)
  const rawTab = searchParams.get('tab') || 'commercial';
  // Backwards compat: old links used ?tab=kdrive → new key is "documents"
  const activeTab = rawTab === 'kdrive' ? 'documents' : rawTab;
  const embeddedProjectId = searchParams.get('project');
  const rawSubtab = searchParams.get('subtab');
  const subtab: 'tasks' | 'notes' = rawSubtab === 'notes' ? 'notes' : 'tasks';

  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    // Leaving the projects tab clears the embedded project context
    if (value !== 'projects') {
      next.delete('project');
      next.delete('subtab');
    }
    setSearchParams(next, { replace: true });
  };

  const setSubtab = (v: 'tasks' | 'notes') => {
    const next = new URLSearchParams(searchParams);
    next.set('subtab', v);
    setSearchParams(next, { replace: true });
  };

  const closeEmbeddedProject = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('project');
    next.delete('subtab');
    next.set('tab', 'projects');
    setSearchParams(next, { replace: true });
  };

  // Rewrite legacy ?tab=kdrive to ?tab=documents (preserve other params)
  useEffect(() => {
    if (rawTab === 'kdrive') {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'documents');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTab]);


  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchBadgeCounts();
    }
  }, [id]);

  useEffect(() => {
    if (client) fetchTagsMeta();
  }, [client?.activity_sector_id, client?.status_id, client?.source_id]);

  useEffect(() => {
    (async () => {
      if (!client?.main_contact_id) { setHubOwner(null); return; }
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', client.main_contact_id)
        .maybeSingle();
      setHubOwner(data || null);
    })();
  }, [client?.main_contact_id]);

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

      // Tasks across all projects of this client
      const { data: pc } = await supabase.from('project_clients').select('project_id').eq('client_id', id);
      const projectIds = (pc || []).map((r: any) => r.project_id).filter(Boolean);
      if (projectIds.length > 0) {
        const { count: tCount } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .in('project_id', projectIds);
        setTasksCount(tCount || 0);
      } else {
        setTasksCount(0);
      }

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
          <p className="text-foreground">Vous n'avez pas accès à cette fiche client ou elle n'existe pas.</p>
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

  const projectsTabContent = embeddedProjectId ? (
    <EmbeddedProjectView
      projectId={embeddedProjectId}
      subtab={subtab}
      onSubtabChange={setSubtab}
      onBack={closeEmbeddedProject}
    />
  ) : (
    <ClientProjectsTab clientId={client.id} />
  );

  // Tab visibility is driven by the Permissions matrix (Settings → Permissions).
  // A tab is only rendered when the user role has at least the "read" permission
  // on the corresponding module. Factures reste réservé à l'admin.
  const rawTabs: (TabDef & { visible: boolean })[] = [
    {
      value: 'commercial', label: 'Commercial', icon: <Briefcase className="h-4 w-4" />,
      content: <CommercialTrackingTab clientId={client.id} client={client} />,
      // Commercial data is admin-only (contient scoring, excuses, suivi).
      visible: role === 'admin',
    },
    {
      value: 'info', label: 'Infos', icon: <FileText className="h-4 w-4" />,
      content: <ClientInfoTab client={client} onUpdate={fetchClientDetails} />,
      visible: canRead('crm'),
    },
    {
      value: 'projects', label: 'Projets', icon: <FolderKanban className="h-4 w-4" />,
      badge: projectsCount, content: projectsTabContent,
      visible: canRead('projects'),
    },
    {
      value: 'tasks', label: 'Tâches', icon: <CheckSquare className="h-4 w-4" />,
      badge: tasksCount, content: <ClientTasksTab clientId={client.id} />,
      visible: canRead('tasks'),
    },
    {
      value: 'documents', label: 'Documents', icon: <FolderKanban className="h-4 w-4" />,
      badge: kdriveFilesCount, content: <ClientKDriveTab clientId={client.id} />,
      // Pas de module dédié Documents dans la matrice → on hérite du droit CRM
      // (l'accès physique aux fichiers est de toute façon protégé côté kDrive).
      visible: canRead('crm'),
    },
    {
      value: 'invoices', label: 'Factures', icon: <Receipt className="h-4 w-4" />,
      badge: invoicesCount, content: <ClientInvoicesTab clientId={client.id} />,
      // Factures : administrateur uniquement, conformément à la règle métier.
      visible: role === 'admin',
    },
    {
      value: 'board', label: 'Board', icon: <BarChart3 className="h-4 w-4" />,
      content: <ClientBoardTab clientId={client.id} clientEmailDomain={clientEmailDomain} />,
      visible: hasBoardTab,
    },
  ];
  const tabs: TabDef[] = rawTabs.filter(t => t.visible).map(({ visible: _v, ...t }) => t);
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
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
        {/* Back button */}
        <div className="flex items-center gap-2">
          <PillButton variant="ghost" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft size={16} strokeWidth={1.8} />
            Retour
          </PillButton>
        </div>


        {/* HEADER + TABS dans le même conteneur blanc */}
        <div className="bg-card border border-border overflow-hidden" style={{ borderRadius: 18 }}>
          {/* Header */}

          <div className="p-6 flex items-start gap-4">
            {/* Logo carré */}
            {client.logo_url ? (
              <img src={client.logo_url} alt={`${client.company} logo`} className="w-14 h-14 object-cover flex-shrink-0" />
            ) : (
              <div
                className="w-14 h-14 flex items-center justify-center flex-shrink-0 display bg-foreground text-background"
                style={{ fontWeight: 700, fontSize: 20 }}
              >
                {initial}
              </div>
            )}

            {/* Bloc principal */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Ligne 1 : nom + badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="display text-foreground" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
                  {client.company}
                </h1>
                {statusName && (
                  <span
                    className="font-semibold tracking-wider uppercase"
                    style={{ background: 'hsl(var(--brand-yellow) / 0.35)', color: 'hsl(var(--brand-ink))', padding: '4px 10px', fontSize: 10, borderRadius: 999 }}
                  >
                    {statusName}
                  </span>

                )}
              </div>

              {/* Ligne 2 : contact / email / phone */}
              <div className="flex items-center flex-wrap text-[14px] text-foreground" style={{ gap: 20 }}>
                {mainContactName && (
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon size={14} /> {mainContactName}
                  </span>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <Mail size={14} /> {client.email}
                  </a>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <Phone size={14} /> {client.phone}
                  </a>
                )}
                {hubOwner && (
                  <span className="inline-flex items-center gap-2" title="Interlocuteur Hub & Up">
                    {hubOwner.avatar_url ? (
                      <img
                        src={hubOwner.avatar_url}
                        alt={[hubOwner.first_name, hubOwner.last_name].filter(Boolean).join(' ')}
                        className="w-6 h-6 object-cover flex-shrink-0 border border-foreground"
                      />
                    ) : (
                      <span
                        className="w-6 h-6 inline-flex items-center justify-center flex-shrink-0 display bg-foreground text-background"
                        style={{ fontWeight: 700, fontSize: 10 }}
                      >
                        {(hubOwner.first_name?.[0] || '?').toUpperCase()}
                      </span>
                    )}
                    <span className="text-foreground">
                      {[hubOwner.first_name, hubOwner.last_name].filter(Boolean).join(' ')}
                    </span>
                  </span>
                )}
              </div>

              {/* Ligne 3 : tags meta */}
              {metaTags.length > 0 && (
                <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                  {metaTags.map((t, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-muted text-foreground"
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
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="">
                <ProtectedAction module="crm" action="update">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditDialogOpen(true); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Modifier
                  </DropdownMenuItem>
                </ProtectedAction>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>
            <EditClientDialog
              client={client}
              onClientUpdated={fetchClientDetails}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              hideTrigger
            />
          </div>

          {/* Tabs sous le header dans le même conteneur */}
          <div className="border-t border-border px-6">
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
                        : 'text-muted-foreground hover:text-foreground border-transparent',
                    )}
                    style={isActive ? { color: 'hsl(var(--brand-ink))', borderColor: 'hsl(var(--brand-ink))' } : undefined}
                  >
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className="inline-flex items-center justify-center text-[11px] font-semibold"
                        style={{
                          minWidth: 18, height: 18, padding: '0 5px',
                          background: isActive ? 'hsl(var(--brand-ink))' : '#e5e5e5',
                          color: isActive ? 'hsl(var(--card))' : '#525252',
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

        <div className="space-y-4">
          {/* Grid 2/3 + 1/3 (corps) — sidebar Commercial uniquement sur l'onglet Commercial */}
          {activeTab === 'commercial' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 min-w-0 space-y-4">
                {role === 'admin' && (
                  <div data-zone="commercial-actions">
                    <ClientFollowupBanner clientId={client.id} />
                  </div>
                )}
                {currentTab?.content}
              </div>
              <aside className="lg:col-span-1 min-w-0" data-zone="commercial-sidebar">
                <ClientCommercialSidebar client={client} />
              </aside>
            </div>
          ) : (
            <div className="min-w-0">
              {currentTab?.content}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
