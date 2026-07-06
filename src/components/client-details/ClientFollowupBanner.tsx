import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Sparkles, RefreshCw, Copy, Send, ChevronRight, ChevronDown, Loader2, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { FollowupGeneratorModal } from './FollowupGeneratorModal';
import { FollowupHistoryModal } from './FollowupHistoryModal';

interface Props {
  clientId: string;
}

function htmlToPlain(html: string) {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

export function ClientFollowupBanner({ clientId }: Props) {
  const [openModal, setOpenModal] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { data: tracking } = useQuery({
    queryKey: ['commercial-tracking-by-client', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_tracking').select('id').eq('client_id', clientId).maybeSingle();
      return data;
    },
  });
  const trackingId = tracking?.id;

  const { data: latest, isLoading } = useQuery({
    queryKey: ['followup-latest', trackingId],
    enabled: !!trackingId,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_followup_suggestions')
        .select('id, subject, body_html, recipient_email, recipient_name, sources, created_at')
        .eq('tracking_id', trackingId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: historyCount = 0 } = useQuery({
    queryKey: ['followup-count', trackingId],
    enabled: !!trackingId,
    queryFn: async () => {
      const { count } = await supabase
        .from('commercial_followup_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('tracking_id', trackingId!);
      return count || 0;
    },
  });

  const plainBody = useMemo(() => latest ? htmlToPlain(latest.body_html || '') : '', [latest]);
  const dateLabel = latest?.created_at
    ? formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: fr })
    : '—';

  const copy = async () => {
    if (!plainBody) return;
    try {
      await navigator.clipboard.writeText(plainBody);
      toast.success('Excuse copiée');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const sendMail = () => {
    if (!latest) return;
    const to = latest.recipient_email || '';
    const subject = 'Suite à notre échange';
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
    window.location.href = mailto;
  };

  const sourcesList = useMemo(() => {
    if (!latest?.sources) return [];
    const s: any = latest.sources;
    if (Array.isArray(s)) {
      return s.map((u: any) => ({ kind: 'URL', label: u.label || u.url }));
    }
    const urls = s.urls || [];
    const meetingNotes = s.meeting_notes || [];
    const meetings = s.meetings || [];
    const projects = s.projects || [];
    const qualification = s.qualification || [];
    const hubandup = s.hubandup || [];
    const googleAlerts = s.google_alerts || [];
    const calendly = s.calendly;
    return [
      ...urls.map((u: any) => ({ kind: 'URL', label: u.label || u.url })),
      ...meetingNotes.map((m: any) => ({ kind: 'CR', label: m.title || 'Compte rendu' })),
      ...meetings.map((m: any) => ({ kind: 'RDV', label: m.label || m.meeting_type })),
      ...projects.map((p: any) => ({ kind: 'PROJET', label: p.name })),
      ...(qualification.length > 0 ? [{ kind: 'QUALIF', label: `Qualification du besoin (${qualification.length} réponse${qualification.length > 1 ? 's' : ''})` }] : []),
      ...hubandup.map((h: any) => ({ kind: 'HUB+UP', label: h.url?.replace(/^https?:\/\//, '') || 'Site Hub & Up' })),
      ...googleAlerts.map((g: any) => ({ kind: 'ALERT', label: `Google Alerts (${g.entries_count || 0} entrées)` })),
      ...(calendly && calendly.used ? [{ kind: 'CALENDLY', label: `${calendly.owner === 'amandine' ? 'Amandine' : 'Charles'} — ${calendly.url}` }] : []),
    ];
  }, [latest]);

  const collapsedPreview = useMemo(() => {
    if (!plainBody) return '';
    const single = plainBody.replace(/\s+/g, ' ').trim();
    return single.length > 80 ? single.slice(0, 80) + '…' : single;
  }, [plainBody]);

  const hasExcuse = !!latest && !!plainBody;

  return (
    <>
      <div
        className="relative rounded-card overflow-hidden"
        style={{
          background: 'hsl(var(--brand-ink))',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 20,
          padding: '20px 24px',
        }}
      >
        {/* Header — icône + titre + méta */}
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center flex-shrink-0 rounded-full"
            style={{ width: 32, height: 32, background: 'hsl(var(--brand-yellow))' }}
          >
            <Sparkles size={15} style={{ color: 'hsl(var(--brand-ink))' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="display text-background font-bold" style={{ fontSize: 14, lineHeight: 1.2 }}>
              Excuse de relance
            </p>
            <p
              className="uppercase tracking-[0.14em] text-background/45 mt-1"
              style={{ fontSize: 10 }}
            >
              Générée par l'IA · {dateLabel}
            </p>
          </div>
          {hasExcuse && (
            <button
              type="button"
              onClick={() => setIsCollapsed((s) => !s)}
              className="text-background/40 hover:text-background transition-colors shrink-0"
              aria-label={isCollapsed ? 'Déplier' : 'Replier'}
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
          )}
        </div>

        {/* Zone centrale */}
        <div className="relative" style={{ minHeight: 96, padding: '20px 0 4px' }}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-background/60 text-sm py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : !hasExcuse ? (
            <div className="flex items-center justify-center py-4">
              <button
                type="button"
                onClick={() => setOpenModal(true)}
                className="inline-flex items-center gap-2 font-semibold rounded-button transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'hsl(var(--brand-yellow))',
                  color: 'hsl(var(--brand-ink))',
                  padding: '14px 28px',
                  fontSize: 15,
                }}
              >
                Générer une excuse
              </button>
            </div>
          ) : isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="w-full text-left text-background/70 text-sm hover:text-background/90 transition-colors truncate"
            >
              {collapsedPreview}
            </button>
          ) : (
            <p className="text-sm text-background/90 leading-relaxed whitespace-pre-wrap">
              {plainBody}
            </p>
          )}
        </div>

        {/* Barre d'actions bas */}
        <div
          className="flex items-center gap-2 flex-wrap pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            type="button"
            onClick={copy}
            disabled={!plainBody}
            className="inline-flex items-center gap-1.5 font-semibold text-xs rounded-button transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: hasExcuse ? 'hsl(var(--brand-yellow))' : 'rgba(232,255,76,0.25)',
              color: hasExcuse ? 'hsl(var(--brand-ink))' : 'hsl(var(--brand-yellow))',
              padding: '7px 14px',
            }}
          >
            <Copy size={13} /> Copier
          </button>
          <button
            type="button"
            onClick={sendMail}
            disabled={!latest}
            className="inline-flex items-center gap-1.5 text-xs text-background/80 hover:bg-card/10 rounded-button transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '7px 14px',
            }}
          >
            <Send size={13} /> Envoyer par email
          </button>

          <div className="ml-auto flex items-center gap-3">
            {hasExcuse && (
              <button
                type="button"
                onClick={() => setOpenModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-background/60 hover:text-background transition-colors"
              >
                <RefreshCw size={12} /> Régénérer
              </button>
            )}
            {historyCount > 0 && (
              <button
                type="button"
                onClick={() => setOpenHistory(true)}
                className="inline-flex items-center gap-1 text-xs text-background/60 hover:text-background transition-colors"
              >
                <Clock size={12} /> Historique ({historyCount})
              </button>
            )}
            {sourcesList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSources((s) => !s)}
                className="inline-flex items-center gap-1 text-xs text-background/60 hover:text-background transition-colors"
              >
                {showSources ? 'Masquer sources' : 'Sources'}
                <ChevronRight
                  size={12}
                  className={showSources ? 'rotate-90 transition-transform' : 'transition-transform'}
                />
              </button>
            )}
          </div>
        </div>

        {showSources && sourcesList.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <ul className="space-y-1">
              {sourcesList.map((s, i) => (
                <li key={i} className="text-xs text-background/70 flex items-center gap-2">
                  <span
                    className="uppercase font-semibold tracking-wider rounded-badge"
                    style={{ background: 'rgba(232,255,76,0.15)', color: 'hsl(var(--brand-yellow))', padding: '1px 6px', fontSize: 9 }}
                  >
                    {s.kind}
                  </span>
                  <span className="truncate">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {trackingId && (
        <>
          <FollowupGeneratorModal
            open={openModal}
            onOpenChange={setOpenModal}
            trackingId={trackingId}
          />
          <FollowupHistoryModal
            open={openHistory}
            onOpenChange={setOpenHistory}
            trackingId={trackingId}
          />
        </>
      )}
    </>
  );
}
