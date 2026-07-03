import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Loader2, FileText, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProjectTasksNotebookTab } from '@/components/project-details/ProjectTasksNotebookTab';
import { ProjectNotesTab } from '@/components/project-details/ProjectNotesTab';
import { ProjectTeamTab } from '@/components/project-details/ProjectTeamTab';
import { RecoTimeline } from '@/components/project-details/RecoTimeline';
import { useUserRole } from '@/hooks/useUserRole';

interface EmbeddedProjectViewProps {
  projectId: string;
  subtab: 'tasks' | 'notes';
  onSubtabChange: (t: 'tasks' | 'notes') => void;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'À faire',
  reco_in_progress: 'Reco en cours',
  active: 'En cours',
  urgent: 'Urgent',
  completed: 'Terminé',
  lost: 'Perdu',
};

export function EmbeddedProjectView({ projectId, subtab, onSubtabChange, onBack }: EmbeddedProjectViewProps) {
  const { isAdmin, isTeam } = useUserRole();
  const canEditProject = isAdmin || isTeam;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamOpen, setTeamOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setProject(data);
      } catch (e) {
        console.error(e);
        toast.error("Impossible de charger le projet");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-card border border-border bg-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Projet introuvable ou inaccessible.</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux projets
        </Button>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[project.status] || project.status;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={12} /> Retour aux projets
      </button>

      {/* Header */}
      <div className="rounded-card border border-border bg-card p-5 space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <h2 className="display text-foreground flex-1 min-w-0" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
            {project.name}
          </h2>
          <span
            className="font-semibold tracking-wider uppercase rounded-badge"
            style={{ background: 'hsl(var(--brand-yellow))', color: 'hsl(var(--brand-ink))', padding: '3px 10px', fontSize: 10 }}
          >
            {statusLabel}
          </span>
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {project.start_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} /> Début : {format(new Date(project.start_date), 'dd MMM yyyy', { locale: fr })}
            </span>
          )}
          {project.end_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} /> Fin : {format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
            </span>
          )}
        </div>

        {project.status === 'reco_in_progress' && (
          <div className="pt-2">
            <RecoTimeline
              projectId={project.id}
              dates={{
                date_brief: project.date_brief,
                date_prise_en_main: project.date_prise_en_main,
                date_concertation_agences: project.date_concertation_agences,
                date_montage_reco: project.date_montage_reco,
                date_restitution: project.date_restitution,
              }}
              canEdit={canEditProject}
              onDatesUpdate={() => { /* no-op, header will refresh on next mount */ }}
            />
          </div>
        )}

        {/* Team (collapsible) */}
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => setTeamOpen((v) => !v)}
            className="w-full flex items-center justify-between text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground py-2"
          >
            <span>Équipe & agences</span>
            {teamOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {teamOpen && (
            <div className="pt-2">
              <ProjectTeamTab projectId={project.id} />
            </div>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="rounded-card border border-border bg-card">
        <div className="border-b border-border px-4">
          <div className="flex items-center gap-6">
            {[
              { key: 'tasks' as const, label: 'Tâches', icon: <FileText size={14} /> },
              { key: 'notes' as const, label: 'Notes', icon: <StickyNote size={14} /> },
            ].map((tab) => {
              const active = subtab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onSubtabChange(tab.key)}
                  className={cn(
                    'py-3 text-sm inline-flex items-center gap-2 border-b-2 -mb-px transition-colors',
                    active ? 'font-semibold' : 'text-muted-foreground hover:text-foreground border-transparent',
                  )}
                  style={active ? { color: 'hsl(var(--brand-ink))', borderColor: 'hsl(var(--brand-ink))' } : undefined}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4">
          {subtab === 'tasks' ? (
            <ProjectTasksNotebookTab projectId={project.id} onTasksChange={() => { /* noop */ }} />
          ) : (
            <ProjectNotesTab projectId={project.id} />
          )}
        </div>
      </div>
    </div>
  );
}
