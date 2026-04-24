import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Link2, Plus, Calendar, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { MeetingsCompactBlock } from './MeetingsCompactBlock';
import { ScrapeUrlsManagerModal } from './ScrapeUrlsManagerModal';

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
  if (days === 0) return 'auj.';
  return `${days}j`;
}

function SectionShell({
  icon, title, action, children,
}: { icon?: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-neutral-200">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2 leading-none">
          {icon && <span className="flex items-center justify-center shrink-0">{icon}</span>}
          <h3 className="uppercase tracking-wider font-bold display leading-none" style={{ color: '#0f1422', fontSize: 10 }}>
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
  const [urlsModalOpen, setUrlsModalOpen] = useState(false);

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

  // Team
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['client-team', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: links } = await supabase
        .from('project_clients').select('project_id').eq('client_id', clientId);
      const projectIds = (links || []).map((l: any) => l.project_id);
      if (projectIds.length === 0) return [];
      const { data: members } = await supabase
        .from('project_team_members')
        .select('member_id, member_type')
        .in('project_id', projectIds)
        .eq('member_type', 'profile');
      const memberIds = Array.from(new Set((members || []).map((m: any) => m.member_id))).filter(Boolean);
      if (memberIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url')
        .in('id', memberIds);
      return profiles || [];
    },
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ['client-owner', client?.main_contact_id],
    enabled: !!client?.main_contact_id && teamMembers.length === 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url')
        .eq('id', client.main_contact_id)
        .maybeSingle();
      return data;
    },
  });

  const team: any[] = teamMembers.length > 0
    ? teamMembers
    : (ownerProfile ? [{ ...(ownerProfile as any), _fallback: true }] : []);

  const currentStage = client?.kanban_stage || 'prospect';
  const currentIdx = useMemo(
    () => Math.max(0, PIPELINE_STAGES.findIndex((s) => s.id === currentStage)),
    [currentStage],
  );

  const qc = useQueryClient();
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);

  const updateStage = async (stageId: string) => {
    if (!client?.id || stageId === currentStage || updatingStage) return;
    setUpdatingStage(stageId);

    // Snapshots pour rollback
    const prevClient = qc.getQueryData<any>(['client', client.id]);
    const prevList = qc.getQueryData<any[]>(['clients']);

    // Patch optimiste : la pipeline se met à jour instantanément
    qc.setQueryData(['client', client.id], (old: any) =>
      old ? { ...old, kanban_stage: stageId } : old,
    );
    qc.setQueryData<any[]>(['clients'], (old) =>
      (old || []).map((c) => (c.id === client.id ? { ...c, kanban_stage: stageId } : c)),
    );

    const { error } = await supabase
      .from('clients')
      .update({ kanban_stage: stageId as any })
      .eq('id', client.id);
    setUpdatingStage(null);

    if (error) {
      // Rollback
      if (prevClient !== undefined) qc.setQueryData(['client', client.id], prevClient);
      if (prevList !== undefined) qc.setQueryData(['clients'], prevList);
      toast.error('Impossible de mettre à jour l\'étape');
      return;
    }
    toast.success('Étape mise à jour');
    qc.invalidateQueries({ queryKey: ['client', client.id] });
    qc.invalidateQueries({ queryKey: ['clients'] });
  };

  return (
    <div className="space-y-4">
      {/* 1. PIPELINE */}
      <SectionShell icon={<CheckCircle2 size={14} style={{ color: '#0f1422' }} />} title="Pipeline">
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
              : isDone ? 'text-neutral-700' : 'text-neutral-400';
            const isUpdating = updatingStage === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => updateStage(s.id)}
                  disabled={!!updatingStage || isCurrent}
                  className="w-full flex items-center gap-2.5 text-xs text-left hover:bg-neutral-50 -mx-1 px-1 py-0.5 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                  aria-label={`Passer à l'étape ${s.label}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 16, height: 16, border: '1px solid', ...stepStyle, opacity: isUpdating ? 0.5 : 1 }}
                  >
                    {isDone && <CheckCircle2 size={10} className="text-white" />}
                  </span>
                  <span className={labelClass}>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </SectionShell>

      {/* 2. ÉTAPES DE RENDEZ-VOUS */}
      {tracking?.id && <MeetingsCompactBlock trackingId={tracking.id} client={client} />}

      {/* 3. URLs VEILLE IA */}
      <SectionShell
        icon={<Link2 size={14} style={{ color: '#0f1422' }} />}
        title="URLs veille IA"
        action={
          <button
            type="button"
            className="text-neutral-400 hover:text-neutral-900"
            onClick={() => setUrlsModalOpen(true)}
            aria-label="Gérer les URLs"
            disabled={!tracking?.id}
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

      {/* URLs management modal */}
      {tracking?.id && (
        <ScrapeUrlsManagerModal
          open={urlsModalOpen}
          onOpenChange={setUrlsModalOpen}
          trackingId={tracking.id}
        />
      )}
    </div>
  );
}
