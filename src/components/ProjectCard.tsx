import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

const statusConfig: Record<string, { bg: string; color: string; label: string; border?: string }> = {
  active:           { bg: 'bg-accent',                    color: 'text-accent-foreground', label: 'En cours' },
  planning:         { bg: 'bg-muted',                     color: 'text-muted-foreground',  label: 'À faire', border: 'border border-border' },
  reco_in_progress: { bg: 'bg-foreground',                color: 'text-accent',            label: 'Reco' },
  completed:        { bg: 'bg-muted',                     color: 'text-muted-foreground',  label: 'Terminé' },
  lost:             { bg: 'bg-destructive/10',            color: 'text-destructive',       label: 'Perdu' },
  urgent:           { bg: 'bg-destructive',               color: 'text-destructive-foreground', label: 'Urgent' },
};

function getInitials(name: string): string {
  return name
    .split(/[\s&]+/)
    .filter(w => w.length > 0)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function getColor(name: string): string {
  const colors = ['#E8232A', '#6B4EFF', '#CC0000', '#0A7CFF', '#1B4FBB', '#1DB954', '#FF6B00', '#00897B', '#FFC200', '#111111'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function TaskBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-[3px] bg-border rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", pct === 100 ? "bg-accent" : "bg-foreground")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground font-[Roboto,sans-serif]">
        {completed}/{total}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = statusConfig[status] || statusConfig.active;
  return (
    <span className={cn(
      "font-['Instrument_Sans'] font-bold text-[10px] tracking-[0.06em] uppercase px-2 py-[3px]",
      s.bg, s.color, s.border
    )}>
      {s.label}
    </span>
  );
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);
  const client = project.project_clients?.[0]?.clients;
  const clientName = client?.company || 'Sans client';
  const initials = getInitials(clientName);
  const color = getColor(clientName);

  const endDate = project.date_restitution || project.end_date;
  const isOverdue = endDate && new Date(endDate) < new Date() && project.status !== 'completed';

  const tasksTotal = project.tasks_total || 0;
  const tasksCompleted = project.tasks_completed || 0;

  // Determine if "auto" - project has a restitution date
  const isAuto = !!project.date_restitution;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "p-5 cursor-pointer flex flex-col gap-3.5 transition-all duration-150 bg-white",
        hovered ? "shadow-md" : "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]"
      )}
    >
      {/* Top: logo + badge + arrow */}
      <div className="flex items-center justify-between gap-2">
        {client?.logo_url ? (
          <img
            src={client.logo_url}
            alt={clientName}
            className="w-10 h-10 rounded object-contain flex-shrink-0"
          />
        ) : (
          <div
            className="w-8 h-8 rounded flex items-center justify-center font-['Instrument_Sans'] font-bold text-[11px] leading-none flex-shrink-0"
            style={{
              backgroundColor: `${color}18`,
              border: `1px solid ${color}30`,
              color: color,
            }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1">
          <StatusBadge status={project.status} />
        </div>
        <span
          className={cn(
            "text-[13px] text-muted-foreground select-none flex-shrink-0 leading-none transition-all duration-150",
            hovered ? "opacity-100 translate-x-0 translate-y-0" : "opacity-0 -translate-x-[3px] translate-y-[3px]"
          )}
        >
          ↗
        </span>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="font-['Instrument_Sans'] font-bold text-[17px] text-foreground tracking-[-0.02em] leading-tight mb-1 truncate max-w-[220px]">
          {project.name}
        </div>
        <div className="font-[Roboto,sans-serif] text-xs text-muted-foreground">
          {clientName}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          {endDate && (
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-[Roboto,sans-serif]",
              isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
            )}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 1.5" strokeLinecap="round" />
              </svg>
              {format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}
            </div>
          )}
          <TaskBar completed={tasksCompleted} total={tasksTotal} />
        </div>
        {isAuto && (
          <span className="text-[10px] font-['Instrument_Sans'] text-muted-foreground border border-border px-1.5 py-[2px] tracking-[0.03em]">
            AUTO
          </span>
        )}
      </div>
    </div>
  );
}
