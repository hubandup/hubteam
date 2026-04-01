import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, Trash2, FileText, Calendar, Users, MessageSquare, Info, User, ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProjectTeamTab } from '@/components/project-details/ProjectTeamTab';
import { ProjectTasksTab } from '@/components/project-details/ProjectTasksTab';
import { ProjectTasksNotebookTab } from '@/components/project-details/ProjectTasksNotebookTab';
import { ProjectNotesTab } from '@/components/project-details/ProjectNotesTab';
import { ClientKDriveTab } from '@/components/client-details/ClientKDriveTab';
import { SelectClientDialog } from '@/components/project-details/SelectClientDialog';
import { EditProjectInfoDialog } from '@/components/project-details/EditProjectInfoDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowLeft, StickyNote } from 'lucide-react';
import { RecoTimeline } from '@/components/project-details/RecoTimeline';

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projectProgress, setProjectProgress] = useState({ completed: 0, total: 0, percentage: 0 });
  const [showSelectClientDialog, setShowSelectClientDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProjectDetails();
      fetchBadgeCounts();
    }

    const channel = supabase
      .channel('project-details-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${id}`
      }, () => {
        fetchProjectDetails();
        fetchBadgeCounts();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_clients',
        filter: `project_id=eq.${id}`
      }, () => {
        fetchProjectDetails();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${id}`
      }, () => {
        fetchProjectDetails();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchBadgeCounts = async () => {
    if (!id) return;
    try {
      const { data: tasks, error } = await supabase
        .from('tasks').select('id, status').eq('project_id', id);
      if (error) throw error;
      setPendingTasksCount(tasks?.filter(t => t.status !== 'done').length || 0);
    } catch (error) {
      console.error('Error fetching badge counts:', error);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`*, project_clients(clients(id, company, first_name, last_name)), tasks(id, status)`)
        .eq('id', id).single();
      if (error) throw error;
      const tasks = data.tasks || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t: any) => t.status === 'done').length;
      const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      setProjectProgress({ completed: completedTasks, total: totalTasks, percentage });
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Erreur lors du chargement du projet');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project && id) fetchBadgeCounts();
  }, [project, id]);

  const handleClientSelected = () => { fetchProjectDetails(); };

  const handleDeleteProject = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      toast.success('Projet supprimé avec succès');
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression du projet');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    try {
      const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success('Statut mis à jour avec succès');
      fetchProjectDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-black" />
      </div>
    );
  }

  if (!project) return null;

  // ── Status config ─────────────────────────────────────────────────────────
  const statusConfig = {
    'planning':         { label: 'À faire',       bg: '#F5F5F5', color: '#6B6B6B', border: '1px solid #D4D4D4' },
    'reco_in_progress': { label: 'Reco en cours',  bg: '#000000', color: '#E8FF4C', border: 'none' },
    'active':           { label: 'En cours',       bg: '#E8FF4C', color: '#000000', border: 'none' },
    'urgent':           { label: 'Urgent',         bg: '#000000', color: '#E8FF4C', border: 'none' },
    'completed':        { label: 'Terminé',        bg: '#E8E8E8', color: '#6B6B6B', border: 'none' },
    'lost':             { label: 'Perdu',          bg: '#FEE2E2', color: '#991B1B', border: 'none' },
  };

  const statusInfo = statusConfig[project.status as keyof typeof statusConfig] || statusConfig['active'];
  const client = project.project_clients?.[0]?.clients;

  // ── Status badge (dropdown) ───────────────────────────────────────────────
  const StatusBadge = () => (
    <ProtectedAction module="projects" action="update">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              background: statusInfo.bg,
              color: statusInfo.color,
              border: statusInfo.border,
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {statusInfo.label}
            <ChevronDown size={11} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-white border border-[#E8E8E8] shadow-sm rounded-none p-1 min-w-[160px]">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handleStatusChange(key)}
              className="cursor-pointer rounded-none focus:bg-[#F5F5F5] px-3 py-2"
            >
              <span style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                background: cfg.bg,
                color: cfg.color,
                border: cfg.border,
              }}>
                {cfg.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ProtectedAction>
  );

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[960px] px-7 py-7 space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[#9A9A9A] hover:text-black transition-colors"
            style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ArrowLeft size={14} />
            Retour
          </button>

          {/* Title row */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#000',
              margin: 0,
            }}>
              {project.name}
            </h1>

            <StatusBadge />

            {!isMobile && (
              <div className="ml-auto flex items-center gap-2">
                <ProtectedAction module="projects" action="update">
                  <button
                    onClick={() => setShowEditDialog(true)}
                    className="flex items-center gap-1.5 hover:bg-[#F5F5F5] transition-colors"
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: 600, fontSize: 12,
                      color: '#000',
                      padding: '7px 14px',
                      border: '1px solid #D4D4D4',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit size={12} /> Modifier
                  </button>
                </ProtectedAction>
                <ProtectedAction module="projects" action="delete">
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="flex items-center gap-1.5 transition-colors hover:opacity-90"
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: 700, fontSize: 12,
                      color: '#fff',
                      padding: '7px 14px',
                      border: 'none',
                      background: '#DC2626',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} /> Supprimer
                  </button>
                </ProtectedAction>
              </div>
            )}
          </div>

          {/* Client */}
          {client && (
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 13, color: '#9A9A9A', margin: 0 }}>
              <span className="uppercase">{client.company}</span> – {client.first_name} {client.last_name}
            </p>
          )}
        </div>

        {/* ── Progress ─────────────────────────────────────────────────── */}
        {project.status === 'reco_in_progress' ? (
          <RecoTimeline
            projectId={project.id}
            dates={{
              date_brief: project.date_brief,
              date_prise_en_main: project.date_prise_en_main,
              date_concertation_agences: project.date_concertation_agences,
              date_montage_reco: project.date_montage_reco,
              date_restitution: project.date_restitution,
            }}
            canEdit={isAdmin}
            onDatesUpdate={fetchProjectDetails}
          />
        ) : (
          <div style={{
            background: '#000',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}>
            {/* Pourcentage en jaune fluo */}
            <span style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: '-0.04em',
              color: '#E8FF4C',
              lineHeight: 1,
              flexShrink: 0,
            }}>
              {projectProgress.percentage}%
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 10 }}>
                Progression du projet
              </div>
              {/* Barre jaune sur fond sombre */}
              <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%',
                  width: `${projectProgress.percentage}%`,
                  background: '#E8FF4C',
                  borderRadius: 99,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {projectProgress.completed} tâche{projectProgress.completed !== 1 ? 's' : ''} terminée{projectProgress.completed !== 1 ? 's' : ''}
                </span>
                <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {projectProgress.total} tâche{projectProgress.total !== 1 ? 's' : ''} au total
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <ResponsiveTabs
          defaultValue="tasks"
          storageKey="project-tabs"
          tabs={[
            {
              value: 'tasks',
              label: 'Tâches',
              icon: <FileText className="h-4 w-4" />,
              badge: pendingTasksCount,
              badgeVariant: pendingTasksCount > 0 ? 'destructive' : undefined,
              content: (
                <ProjectTasksNotebookTab
                  projectId={id!}
                  onTasksChange={() => { fetchProjectDetails(); fetchBadgeCounts(); }}
                />
              )
            },
            {
              value: 'notes',
              label: 'Notes',
              icon: <StickyNote className="h-4 w-4" />,
              content: <ProjectNotesTab projectId={id!} />
            },
            {
              value: 'team',
              label: 'Équipe',
              icon: <Users className="h-4 w-4" />,
              content: <ProjectTeamTab projectId={id!} />
            },
            {
              value: 'kdrive',
              label: 'kDrive',
              icon: <ExternalLink className="h-4 w-4" />,
              content: client ? (
                <ClientKDriveTab clientId={client.id} />
              ) : (
                <div style={{ fontFamily: 'Roboto, sans-serif', fontSize: 13, color: '#9A9A9A', padding: '32px 0', textAlign: 'center' }}>
                  Aucun client associé à ce projet
                </div>
              )
            },
            {
              value: 'info',
              label: 'Informations',
              icon: <Info className="h-4 w-4" />,
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Infos générales */}
                  <div style={{ background: '#fff', border: '1px solid #E8E8E8', padding: '20px' }}>
                    <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#000', marginBottom: 16 }}>
                      Informations générales
                    </div>
                    <div className="space-y-4">
                      {client ? (
                        <div>
                          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, color: '#9A9A9A', marginBottom: 4 }}>Client</p>
                          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#000' }}>
                            <span className="uppercase">{client.company}</span> – {client.first_name} {client.last_name}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, color: '#9A9A9A', marginBottom: 8 }}>Client</p>
                          <button
                            onClick={() => setShowSelectClientDialog(true)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 12,
                              color: '#000', padding: '7px 14px',
                              border: '1px solid #D4D4D4', background: 'transparent', cursor: 'pointer',
                            }}
                          >
                            <Plus size={12} /> Sélectionner un client
                          </button>
                        </div>
                      )}

                      <div>
                        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, color: '#9A9A9A', marginBottom: 4 }}>Nom du projet</p>
                        <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#000' }}>
                          {project.name}
                        </p>
                      </div>

                      {project.description && (
                        <div>
                          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, color: '#9A9A9A', marginBottom: 4 }}>Description</p>
                          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 13, color: '#000', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {project.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates & Statut */}
                  <div style={{ background: '#fff', border: '1px solid #E8E8E8', padding: '20px' }}>
                    <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#000', marginBottom: 16 }}>
                      Dates & Statut
                    </div>
                    <div className="space-y-4">
                      {project.start_date && (
                        <div>
                          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, color: '#9A9A9A', marginBottom: 4 }}>Date de début</p>
                          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#000' }}>
                            {format(new Date(project.start_date), 'dd MMMM yyyy', { locale: fr })}
                          </p>
                        </div>
                      )}
                      {project.end_date && (
                        <div>
                          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, color: '#9A9A9A', marginBottom: 4 }}>Date de fin</p>
                          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#000' }}>
                            {format(new Date(project.end_date), 'dd MMMM yyyy', { locale: fr })}
                          </p>
                        </div>
                      )}
                      <div>
                        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, color: '#9A9A9A', marginBottom: 8 }}>Statut</p>
                        <StatusBadge />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
          ]}
        />

        {/* ── Dialogs (inchangés) ───────────────────────────────────────── */}
        <SelectClientDialog
          open={showSelectClientDialog}
          onOpenChange={setShowSelectClientDialog}
          projectId={id!}
          onClientSelected={handleClientSelected}
        />

        {isAdmin && (
          <>
            <EditProjectInfoDialog
              open={showEditDialog}
              onOpenChange={setShowEditDialog}
              project={project}
              onSuccess={fetchProjectDetails}
            />

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent className="rounded-none border-[#E8E8E8]">
                <AlertDialogHeader>
                  <AlertDialogTitle style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 16, color: '#000' }}>
                    Confirmer la suppression
                  </AlertDialogTitle>
                  <AlertDialogDescription style={{ fontFamily: 'Roboto, sans-serif', fontSize: 13, color: '#6B6B6B' }}>
                    Êtes-vous sûr de vouloir supprimer le projet "{project.name}" ?
                    Cette action est irréversible et supprimera également toutes les tâches,
                    membres d'équipe et pièces jointes associés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    disabled={deleting}
                    className="rounded-none border-[#D4D4D4] font-['Instrument_Sans'] font-semibold text-sm"
                  >
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteProject}
                    disabled={deleting}
                    className="rounded-none bg-[#DC2626] hover:bg-[#B91C1C] font-['Instrument_Sans'] font-bold text-sm"
                  >
                    {deleting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suppression...</>
                    ) : 'Supprimer'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
