import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, ChevronRight } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { AddProjectDialog } from '@/components/AddProjectDialog';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useProjects } from '@/hooks/useProjects';
import { useQueryClient } from '@tanstack/react-query';
import { buildProjectNavPath } from '@/lib/project-nav';
import { getLogoFallback } from '@/components/targets/targetUtils';

const NAVY = '#0C1320';
const LIME = '#DDF247';
const CARD_BORDER = '#ECECEE';
const TITLE = '#0F1524';
const MUTED = '#8A8F98';
const DANGER = '#E5484D';

type FilterKey = 'all' | 'planning' | 'reco_in_progress' | 'active' | 'completed' | 'lost';

const CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'planning', label: 'À faire' },
  { key: 'reco_in_progress', label: 'Reco' },
  { key: 'active', label: 'En cours' },
  { key: 'completed', label: 'Terminés' },
  { key: 'lost', label: 'Perdus' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: 'EN COURS', color: '#1B9E5A' },
  reco_in_progress: { label: 'RECO', color: '#7C4DD6' },
  planning: { label: 'À FAIRE', color: '#3B6FE0' },
  completed: { label: 'TERMINÉ', color: '#8A8F98' },
  lost: { label: 'PERDU', color: '#E5484D' },
};

interface Props {
  addProjectOpen: boolean;
  onAddProjectOpenChange: (open: boolean) => void;
}

export function ProjectsMobile({ addProjectOpen, onAddProjectOpenChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => ({
    all: projects.length,
    planning: projects.filter((p: any) => p.status === 'planning').length,
    reco_in_progress: projects.filter((p: any) => p.status === 'reco_in_progress').length,
    active: projects.filter((p: any) => p.status === 'active' || p.status === 'reco_in_progress').length,
    completed: projects.filter((p: any) => p.status === 'completed').length,
    lost: projects.filter((p: any) => p.status === 'lost').length,
  }), [projects]);

  const filtered = useMemo(() => {
    if (filter === 'all') return projects;
    if (filter === 'active') return projects.filter((p: any) => p.status === 'active' || p.status === 'reco_in_progress');
    return projects.filter((p: any) => p.status === filter);
  }, [projects, filter]);

  const selected = useMemo(
    () => projects.find((p: any) => p.id === selectedId) || null,
    [selectedId, projects],
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header */}
      <div
        className="rounded-2xl p-4 flex items-start justify-between gap-3"
        style={{ backgroundColor: NAVY }}
      >
        <div className="min-w-0">
          <h1
            className="text-white text-[26px] leading-tight"
            style={{
              fontFamily: "'Archivo', 'Instrument Sans', system-ui, sans-serif",
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}
          >
            Projets
          </h1>
          <p className="text-white/60 text-[13px] mt-1" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
            {counts.all} projet{counts.all > 1 ? 's' : ''} · pilote ta production
          </p>
        </div>
        <ProtectedAction module="projects" action="create">
          <button
            type="button"
            onClick={() => onAddProjectOpenChange(true)}
            aria-label="Nouveau projet"
            className="h-11 w-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{ backgroundColor: LIME, color: NAVY }}
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </ProtectedAction>
      </div>

      {/* Mini stats */}
      <div
        className="grid grid-cols-4 bg-white"
        style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
      >
        {[
          { label: 'Total', value: counts.all, color: TITLE },
          { label: 'En cours', value: counts.active, color: '#1B9E5A' },
          { label: 'Terminés', value: counts.completed, color: '#3B6FE0' },
          { label: 'Perdus', value: counts.lost, color: '#E5484D' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center py-3"
            style={i > 0 ? { borderLeft: `1px solid ${CARD_BORDER}` } : undefined}
          >
            <span
              className="text-[20px] leading-none"
              style={{
                color: s.color,
                fontFamily: "'Archivo', system-ui, sans-serif",
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </span>
            <span className="text-[11px] mt-1 uppercase tracking-wide" style={{ color: MUTED }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Chips */}
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max pb-1">
          {CHIPS.map((c) => {
            const active = filter === c.key;
            const count = counts[c.key];
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className="h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors min-h-[36px] flex items-center gap-2"
                style={{
                  backgroundColor: active ? NAVY : 'white',
                  color: active ? 'white' : TITLE,
                  border: `1px solid ${active ? NAVY : CARD_BORDER}`,
                }}
              >
                {c.label}
                <span
                  className="text-[11px] font-bold px-1.5 rounded-full"
                  style={{
                    backgroundColor: active ? 'rgba(255,255,255,0.15)' : '#F4F4F3',
                    color: active ? 'white' : MUTED,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[14px]" style={{ color: MUTED }}>
          Aucun projet
        </div>
      ) : (
        <ul className="flex flex-col gap-2 w-full min-w-0">
          {filtered.map((p: any) => (
            <ProjectSummaryCard key={p.id} project={p} onOpen={() => setSelectedId(p.id)} />
          ))}
        </ul>
      )}

      {/* Detail sheet */}
      <MobileBottomSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        variant="light"
        ariaLabel={selected ? `Détail ${selected.name}` : undefined}
      >
        {selected && (
          <ProjectDetailContent
            project={selected}
            onOpenFull={() => {
              const p = selected;
              setSelectedId(null);
              navigate(buildProjectNavPath(p));
            }}
          />
        )}
      </MobileBottomSheet>

      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={onAddProjectOpenChange}
        hideTrigger
        onProjectAdded={() => {
          void queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' });
        }}
      />
    </div>
  );
}

/* ---------------- Summary card ---------------- */

function ProjectSummaryCard({ project, onOpen }: { project: any; onOpen: () => void }) {
  const client = project.project_clients?.[0]?.clients;
  const clientName = client?.company || 'Sans client';
  const fallback = getLogoFallback(clientName);
  const status = STATUS_META[project.status] || STATUS_META.active;

  const endDate = project.date_restitution || project.end_date;
  const overdue = endDate && isPast(new Date(endDate)) && project.status !== 'completed';
  const total = project.tasks_total || 0;
  const done = project.tasks_completed || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <li className="w-full min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="w-full min-w-0 max-w-full bg-white p-3 text-left active:bg-black/[0.02] transition-colors overflow-hidden flex flex-col items-stretch justify-start"
        style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
      >
        {/* Row 1 */}
        <div className="flex items-center gap-3 min-h-[44px]">
          <span
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
            style={{ backgroundColor: fallback.bg, color: fallback.text }}
          >
            {fallback.initials}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-semibold truncate min-w-0" style={{ color: TITLE }}>
              {project.name}
            </p>
            <p className="text-[12px] truncate min-w-0" style={{ color: MUTED }}>
              {clientName}
            </p>
          </div>
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-full tracking-wide shrink-0"
            style={{
              backgroundColor: `${status.color}1A`,
              color: status.color,
            }}
          >
            {status.label}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
        </div>

        {/* Row 2 */}
        <div
          className="mt-3 pt-3 flex items-center justify-between gap-3"
          style={{ borderTop: `1px solid ${CARD_BORDER}` }}
        >
          <span
            className="flex items-center gap-1.5 text-[12px] font-medium shrink-0"
            style={{ color: overdue ? DANGER : MUTED }}
          >
            <Clock className="h-3.5 w-3.5" />
            {endDate ? format(new Date(endDate), 'd MMM', { locale: fr }) : '—'}
          </span>

          {total > 0 && (
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              <div
                className="h-[6px] rounded-full overflow-hidden flex-1 max-w-[120px]"
                style={{ backgroundColor: '#F1F1F2' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: LIME }}
                />
              </div>
              <span className="text-[12px] font-semibold shrink-0" style={{ color: TITLE }}>
                {done}/{total}
              </span>
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

/* ---------------- Detail sheet ---------------- */

function ProjectDetailContent({ project, onOpenFull }: { project: any; onOpenFull: () => void }) {
  const client = project.project_clients?.[0]?.clients;
  const clientName = client?.company || 'Sans client';
  const status = STATUS_META[project.status] || STATUS_META.active;
  const endDate = project.date_restitution || project.end_date;
  const overdue = endDate && isPast(new Date(endDate)) && project.status !== 'completed';
  const total = project.tasks_total || 0;
  const done = project.tasks_completed || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="pt-2 pb-4">
      <h2
        className="text-[22px] leading-tight"
        style={{
          color: TITLE,
          fontFamily: "'Archivo', 'Instrument Sans', system-ui, sans-serif",
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        {project.name}
      </h2>
      <p className="text-[13.5px] mt-1" style={{ color: MUTED }}>
        {clientName}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold"
          style={{ backgroundColor: `${status.color}1A`, color: status.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
          {status.label}
        </span>
      </div>

      <ul
        className="mt-5 bg-white overflow-hidden"
        style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
      >
        <li className="px-4 py-3 flex items-center justify-between">
          <span className="text-[11.5px] uppercase tracking-wide" style={{ color: MUTED }}>
            Échéance
          </span>
          <span
            className="text-[14px] font-medium"
            style={{ color: overdue ? DANGER : TITLE }}
          >
            {endDate ? format(new Date(endDate), 'd MMMM yyyy', { locale: fr }) : '—'}
          </span>
        </li>
        <li className="px-4 py-3" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11.5px] uppercase tracking-wide" style={{ color: MUTED }}>
              Avancement
            </span>
            <span className="text-[14px] font-semibold" style={{ color: TITLE }}>
              {done}/{total} {total > 0 && `· ${pct}%`}
            </span>
          </div>
          <div className="h-[8px] rounded-full overflow-hidden" style={{ backgroundColor: '#F1F1F2' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: LIME }}
            />
          </div>
        </li>
      </ul>

      <button
        type="button"
        onClick={onOpenFull}
        className="mt-5 w-full h-12 rounded-full text-[14px] font-semibold active:scale-[0.99] transition-transform"
        style={{ backgroundColor: NAVY, color: 'white' }}
      >
        Voir le projet
      </button>
    </div>
  );
}
