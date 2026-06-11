import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { EntityCard } from '@/components/layout';
import { STATUS_TOKENS, type StatusKey } from '@/lib/design-tokens';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
    start_date?: string;
    end_date?: string;
    created_at: string;
    date_restitution?: string;
    project_clients?: Array<{
      clients: {
        company: string;
        logo_url?: string | null;
      };
    }>;
    tasks_total?: number;
    tasks_completed?: number;
  };
  onClick: () => void;
}

const PROJECT_STATUS_MAP: Record<string, StatusKey> = {
  active: 'project_active',
  planning: 'project_planning',
  reco_in_progress: 'project_reco',
  completed: 'project_completed',
  lost: 'project_lost',
  urgent: 'project_urgent',
};

function TaskBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-[3px] bg-border rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-accent' : 'bg-foreground')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground font-roboto">
        {completed}/{total}
      </span>
    </div>
  );
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const client = project.project_clients?.[0]?.clients;
  const clientName = client?.company || 'Sans client';

  const endDate = project.date_restitution || project.end_date;
  const isOverdue = endDate && new Date(endDate) < new Date() && project.status !== 'completed';
  const isAuto = !!project.date_restitution;

  const tasksTotal = project.tasks_total || 0;
  const tasksCompleted = project.tasks_completed || 0;

  const status = STATUS_TOKENS[PROJECT_STATUS_MAP[project.status] || 'project_active'];

  return (
    <EntityCard
      title={project.name}
      subtitle={clientName}
      logoUrl={client?.logo_url}
      logoSize="xl"
      status={status}
      onClick={onClick}
      footerLeft={
        endDate ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-roboto',
              isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground',
            )}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 1.5" strokeLinecap="round" />
            </svg>
            {format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}
          </span>
        ) : (
          <TaskBar completed={tasksCompleted} total={tasksTotal} />
        )
      }
      footerRight={
        <>
          {endDate && tasksTotal > 0 && <TaskBar completed={tasksCompleted} total={tasksTotal} />}
          {isAuto && (
            <span className="text-[10px] font-display text-muted-foreground border border-border px-1.5 py-[2px] tracking-[0.03em] rounded-badge">
              AUTO
            </span>
          )}
        </>
      }
    />
  );
}
