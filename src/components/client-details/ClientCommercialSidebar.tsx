import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Link2, Plus, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  client: any;
}

const PIPELINE_STAGES: { id: string; label: string }[] = [
  { id: 'prospect', label: 'Prospect' },
  { id: 'rdv_a_prendre', label: 'RDV à prendre' },
  { id: 'a_relancer', label: 'À relancer' },
  { id: 'rdv_hub_date', label: 'RDV Hub Date' },
  { id: 'rdv_pris', label: 'RDV Pris' },
  { id: 'reco_en_cours', label: 'Reco en cours' },
  { id: 'projet_valide', label: 'Projet validé' },
  { id: 'a_fideliser', label: 'À fidéliser' },
];

const CALENDLY_LINKS = [
  { name: 'Calendly Charles', duration: '30 min', url: 'https://calendly.com/charles-hubandup/30min' },
  { name: 'Calendly Amandine', duration: '30 min', url: 'https://calendly.com/amandine-hubandup/30min' },
];

const CALENDLY_OTHER = 'https://calendly.com/charles-hubandup';

function daysSince(iso?: string | null) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function ageLabel(days: number) {
  if (!isFinite(days)) return '—';
  if (days === 0) return "auj.";
  return `${days}j`;
}

function SectionShell({ icon, title, action, children }: { icon?: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-neutral-200">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3
            className="uppercase tracking-wider font-bold display"
            style={{ color: '#0f1422', fontSize: 10 }}
          >
            {title}
          </h3>
        </div>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function ClientCommercialSidebar({ client }: Props) {
  const clientId = client?.id;

  // Tracking row → URLs
  const { data: tracking } = useQuery({
    queryKey: ['commercial-tracking-by-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_tracking')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle();
      return data;
    },
  });

  const { data: urls = [] } = useQuery({
    queryKey: ['commercial-scrape-urls', tracking?.id],
    enabled: !!tracking?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_scrape_urls')
        .select('id, url, label, last_scraped_at')
        .eq('tracking_id', tracking!.id)
        .order('last_scraped_at', { ascending: false, nullsFirst: false });
      return data || [];
    },
  });

  // Team: from project_team_members of projects linked to this client
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['client-team', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // 1. project ids linked to this client
      const { data: links, error: linksErr } = await supabase
        .from('project_clients')
        .select('project_id')
        .eq('client_id', clientId);
      console.log('[ClientCommercialSidebar] project_clients →', { links, linksErr, clientId });
      const projectIds = (links || []).map((l: any) => l.project_id);
      if (projectIds.length === 0) return [];
      // 2. profile-type team members on those projects
      const { data: members, error: membersErr } = await supabase
        .from('project_team_members')
        .select('member_id, member_type')
        .in('project_id', projectIds)
        .eq('member_type', 'profile');
      console.log('[ClientCommercialSidebar] project_team_members →', { members, membersErr });
      const memberIds = Array.from(new Set((members || []).map((m: any) => m.member_id))).filter(Boolean);
      if (memberIds.length === 0) return [];
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url')
        .in('id', memberIds);
      console.log('[ClientCommercialSidebar] profiles →', { profiles, profilesErr });
      return profiles || [];
    },
  });

  // Fallback: client owner / main_contact_id profile
  const { data: ownerProfile } = useQuery({
    queryKey: ['client-owner', client?.main_contact_id],
    enabled: !!client?.main_contact_id && teamMembers.length === 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url')
        .eq('id', client.main_contact_id)
        .maybeSingle();
      console.log('[ClientCommercialSidebar] owner fallback →', { data, error, main_contact_id: client?.main_contact_id });
      return data;
    },
  });

  const team: any[] = teamMembers.length > 0
    ? teamMembers
    : (ownerProfile ? [{ ...(ownerProfile as any), _fallback: true }] : []);

  // Pipeline progression
  const currentStage = client?.kanban_stage || 'prospect';
  const currentIdx = useMemo(
    () => Math.max(0, PIPELINE_STAGES.findIndex((s) => s.id === currentStage)),
    [currentStage],
  );

  return (
    <div className="space-y-4">
      {/* PIPELINE */}
      <SectionShell
        icon={<CheckCircle2 size={14} style={{ color: '#0f1422' }} />}
        title="Pipeline"
      >
        <ul className="space-y-2.5">
          {PIPELINE_STAGES.map((s, i) => {
            const isDone = i < currentIdx;
            const isCurrent = i === currentIdx;
            const stepStyle = isDone
              ? { background: '#0f1422', borderColor: '#0f1422' }
              : isCurrent
                ? { background: '#E8FF4C', borderColor: '#0f1422' }
                : { background: '#fff', borderColor: '#d4d4d4' };
            const labelClass = isCurrent
              ? 'font-semibold text-neutral-900'
              : isDone
                ? 'text-neutral-700'
                : 'text-neutral-400';
            return (
              <li key={s.id} className="flex items-center gap-2.5 text-xs">
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 16, height: 16, border: '1px solid', ...stepStyle }}
                >
                  {isDone && <CheckCircle2 size={10} className="text-white" />}
                </span>
                <span className={labelClass}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </SectionShell>

      {/* URLs VEILLE IA */}
      <SectionShell
        icon={<Link2 size={14} style={{ color: '#0f1422' }} />}
        title="URLs veille IA"
        action={
          <button
            type="button"
            className="text-neutral-400 hover:text-neutral-900"
            onClick={() => {
              // Switch to Commercial tab (where the URL manager lives)
              const params = new URLSearchParams(window.location.search);
              params.set('tab', 'commercial');
              window.history.pushState({}, '', `${window.location.pathname}?${params}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            aria-label="Ajouter une URL"
          >
            <Plus size={14} />
          </button>
        }
      >
        {urls.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">Aucune URL configurée.</p>
        ) : (
          <ul className="space-y-2">
            {urls.slice(0, 6).map((u: any) => {
              const d = daysSince(u.last_scraped_at);
              return (
                <li key={u.id} className="flex items-center gap-2">
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-neutral-700 hover:text-neutral-900 truncate flex-1"
                    title={u.url}
                  >
                    {u.label || u.url}
                  </a>
                  <span className="text-neutral-400" style={{ fontSize: 10 }}>{ageLabel(d)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionShell>

      {/* PRÉPARER UN RDV */}
      <SectionShell
        icon={<Calendar size={14} style={{ color: '#0f1422' }} />}
        title="Préparer un RDV"
      >
        <div className="space-y-2">
          {CALENDLY_LINKS.map((c) => (
            <a
              key={c.name}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-xs text-neutral-800 hover:text-neutral-900 w-full transition-colors"
              style={{ border: '1px solid #e5e5e5', padding: '8px 12px' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0f1422')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e5e5')}
            >
              <span>{c.name} · {c.duration}</span>
              <ChevronRight size={12} />
            </a>
          ))}
          <a
            href={CALENDLY_OTHER}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 pt-1 text-xs text-neutral-500 hover:text-neutral-900"
          >
            <Plus size={12} /> Autre durée / visio
          </a>
        </div>
      </SectionShell>

      {/* ÉQUIPE SUR LE COMPTE */}
      <SectionShell title="Équipe sur le compte">
        {team.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">Aucun membre assigné</p>
        ) : (
          <ul className="space-y-2">
            {team.map((m: any) => {
              const initials = `${(m.first_name?.[0] || '').toUpperCase()}${(m.last_name?.[0] || '').toUpperCase()}` || '?';
              const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Membre';
              return (
                <li key={m.id} className="flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 24, height: 24, borderRadius: '9999px',
                      background: '#e5e5e5', color: '#0f1422',
                      fontSize: 10, fontWeight: 600,
                    }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-900 truncate" style={{ fontSize: 12 }}>
                      {fullName}
                    </p>
                    <p className="text-neutral-500 capitalize" style={{ fontSize: 10 }}>
                      {m._fallback ? 'Lead par défaut' : (m.role || 'Équipe')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionShell>
    </div>
  );
}
