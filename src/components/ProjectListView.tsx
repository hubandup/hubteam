import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectListViewProps {
  projects: any[];
  onProjectClick: (id: string) => void;
}

const statusConfig: Record<string, { bg: string; color: string; label: string; border?: string }> = {
  active:           { bg: 'bg-accent',            color: 'text-accent-foreground', label: 'En cours' },
  planning:         { bg: 'bg-muted',             color: 'text-muted-foreground',  label: 'À faire', border: 'border border-border' },
  reco_in_progress: { bg: 'bg-foreground',        color: 'text-accent',            label: 'Reco' },
  completed:        { bg: 'bg-muted',             color: 'text-muted-foreground',  label: 'Terminé' },
  lost:             { bg: 'bg-destructive/10',    color: 'text-destructive',       label: 'Perdu' },
  urgent:           { bg: 'bg-destructive',       color: 'text-destructive-foreground', label: 'Urgent' },
};

export function ProjectListView({ projects, onProjectClick }: ProjectListViewProps) {
  return (
    <div className="border border-border font-['Instrument_Sans']">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1.5fr_100px_120px_80px] px-5 py-2.5 border-b border-border bg-muted">
        {['Projet', 'Client', 'Statut', 'Date', 'Tâches'].map(h => (
          <span key={h} className="text-[11px] font-bold text-muted-foreground tracking-[0.04em] uppercase">
            {h}
          </span>
        ))}
      </div>
      {/* Rows */}
      {projects.map((project, i) => {
        const client = project.project_clients?.[0]?.clients;
        const clientName = client?.company || 'Sans client';
        const endDate = project.date_restitution || project.end_date;
        const isOverdue = endDate && new Date(endDate) < new Date() && project.status !== 'completed';
        const s = statusConfig[project.status as string] || statusConfig.active;
        const tasksTotal = project.tasks_total || 0;
        const tasksCompleted = project.tasks_completed || 0;
        const pct = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

        return (
          <div
            key={project.id}
            className={cn(
              "grid grid-cols-[2fr_1.5fr_100px_120px_80px] px-5 py-3.5 items-center cursor-pointer transition-colors hover:bg-muted/60",
              i < projects.length - 1 && "border-b border-border/50"
            )}
            onClick={() => onProjectClick(project.id)}
          >
            <span className="font-bold text-sm text-foreground tracking-[-0.01em] truncate pr-2">
              {project.name}
            </span>
            <span className="text-[13px] text-muted-foreground truncate pr-2">{clientName}</span>
            <span className={cn(
              "font-bold text-[10px] tracking-[0.06em] uppercase px-2 py-[3px] w-fit",
              s.bg, s.color, s.border
            )}>
              {s.label}
            </span>
            {endDate ? (
              <span className={cn(
                "text-xs flex items-center gap-1",
                isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
              )}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 1.5" strokeLinecap="round" />
                </svg>
                {format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}
              </span>
            ) : <span />}
            {tasksTotal > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-[3px] bg-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", pct === 100 ? "bg-accent" : "bg-foreground")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground font-[Roboto,sans-serif]">
                  {tasksCompleted}/{tasksTotal}
                </span>
              </div>
            ) : <span />}
          </div>
        );
      })}
    </div>
  );
}
