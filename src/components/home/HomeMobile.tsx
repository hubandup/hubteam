import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, FolderKanban, ListTodo, StickyNote, CalendarClock } from 'lucide-react';


import { TodoList } from './TodoList';
import { QuickNotes } from './QuickNotes';

interface ActiveProject {
  id: string;
  name: string;
  status: string;
  clientName: string;
}

interface UpcomingDeadline {
  id: string;
  title: string;
  end_date: string;
  projectName?: string;
}

const CARD_BORDER = '#ECECEE';
const TITLE_COLOR = '#0F1524';
const MUTED = '#8A8F98';
const STATUS_GREEN = '#1B9E5A';
const STATUS_VIOLET = '#7C4DD6';

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Calendar;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="w-full bg-white p-4"
      style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
    >
      <header className="flex items-center gap-2 mb-3">
        <Icon className="h-5 w-5 shrink-0" style={{ color: TITLE_COLOR }} strokeWidth={2} />
        <h2
          className="text-[15px] font-semibold leading-none"
          style={{
            color: TITLE_COLOR,
            fontFamily: "'Archivo', 'Instrument Sans', system-ui, sans-serif",
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
      </header>
      {children}
    </section>
  );

}

function statusMeta(status: string) {
  if (status === 'reco_in_progress') return { label: 'Reco', color: STATUS_VIOLET };
  if (status === 'planning') return { label: 'Planning', color: MUTED };
  return { label: 'Actif', color: STATUS_GREEN };
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

export function HomeMobile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [deadlines, setDeadlines] = useState<UpcomingDeadline[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) setUserName(profile.first_name || '');

      const [{ data: memberProjects }, { data: createdProjects }] = await Promise.all([
        supabase
          .from('project_team_members')
          .select('project_id')
          .eq('member_type', 'profile')
          .eq('member_id', user.id),
        supabase.from('projects').select('id').eq('created_by', user.id),
      ]);

      const ids = [
        ...new Set([
          ...(memberProjects || []).map((p: any) => p.project_id),
          ...(createdProjects || []).map((p: any) => p.id),
        ]),
      ];

      if (ids.length > 0) {
        const { data } = await supabase
          .from('projects')
          .select('id, name, status, project_clients(clients(company))')
          .in('id', ids)
          .eq('archived', false)
          .in('status', ['active', 'reco_in_progress', 'planning'])
          .order('updated_at', { ascending: false })
          .limit(6);
        setActiveProjects(
          (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            clientName: p.project_clients?.[0]?.clients?.company || 'N/A',
          })),
        );

        const in7 = addDays(new Date(), 7).toISOString();
        const now = new Date().toISOString();
        const { data: tks } = await supabase
          .from('tasks')
          .select('id, title, end_date, projects(name)')
          .gte('end_date', now)
          .lte('end_date', in7)
          .neq('status', 'done')
          .in('project_id', ids)
          .order('end_date', { ascending: true })
          .limit(6);
        setDeadlines(
          (tks || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            end_date: t.end_date,
            projectName: t.projects?.name,
          })),
        );
      }
    })();
  }, [user]);

  const today = format(new Date(), 'EEEE d MMMM', { locale: fr });

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Greeting */}
      <div>
        <h1
          className="text-[34px] leading-[1.02]"
          style={{
            fontFamily: "'Archivo', 'Instrument Sans', system-ui, sans-serif",
            fontWeight: 900,
            letterSpacing: '-0.035em',
            color: TITLE_COLOR,
          }}
        >
          Content de te revoir {userName || 'Charles'} !
        </h1>
        <p
          className="mt-2 text-[13px] capitalize"
          style={{ color: MUTED, fontFamily: "'Manrope', system-ui, sans-serif" }}
        >
          Nous sommes le {today}
        </p>
      </div>

      {/* Projets en cours */}
      <SectionCard icon={FolderKanban} title="Projets en cours">
        {activeProjects.length === 0 ? (
          <div className="py-6 text-center">
            <FolderKanban className="h-6 w-6 mx-auto mb-2" style={{ color: MUTED }} />
            <p className="text-[13px]" style={{ color: MUTED }}>
              Aucun projet en cours
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeProjects.map((p) => {
              const s = statusMeta(p.status);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/project/${p.id}`)}
                    className="w-full flex items-center gap-3 min-h-[44px] text-left"
                  >
                    <span
                      className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0 text-[11px] font-bold"
                      style={{ backgroundColor: '#F1F1F2', color: TITLE_COLOR }}
                    >
                      {initialsOf(p.clientName)}
                    </span>
                    <span
                      className="flex-1 min-w-0 truncate text-[14px] font-medium"
                      style={{ color: TITLE_COLOR }}
                    >
                      {p.name}
                    </span>
                    <span
                      className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${s.color}1A`,
                        color: s.color,
                      }}
                    >
                      {s.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Échéances à venir */}
      <SectionCard icon={Calendar} title="Échéances à venir">
        {deadlines.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center mb-2"
              style={{ backgroundColor: '#F4F4F3' }}
            >
              <CalendarClock className="h-5 w-5" style={{ color: MUTED }} />
            </div>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Aucune échéance cette semaine
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {deadlines.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 min-h-[44px]"
              >
                <span
                  className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#F4F4F3' }}
                >
                  <Calendar className="h-4 w-4" style={{ color: TITLE_COLOR }} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate" style={{ color: TITLE_COLOR }}>
                    {d.title}
                  </p>
                  {d.projectName && (
                    <p className="text-[12px] truncate" style={{ color: MUTED }}>
                      {d.projectName}
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: '#F1F1F2', color: TITLE_COLOR }}
                >
                  {format(new Date(d.end_date), 'd MMM', { locale: fr })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Ma to-do list — réutilise le composant, encapsulé pour matcher la carte mobile */}
      <SectionCard icon={ListTodo} title="Ma to-do list">
        <div className="[&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0 [&>div>div:first-child]:hidden">
          <TodoList />
        </div>
      </SectionCard>

      {/* Notes rapides */}
      <SectionCard icon={StickyNote} title="Notes rapides">
        <div className="[&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0 [&>div>div:first-child]:hidden">
          <QuickNotes />
        </div>
      </SectionCard>
    </div>
  );
}
