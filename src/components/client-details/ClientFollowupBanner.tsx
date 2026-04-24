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
    const hubandup = s.hubandup || [];
    const googleAlerts = s.google_alerts || [];
    const calendly = s.calendly;
    return [
      ...urls.map((u: any) => ({ kind: 'URL', label: u.label || u.url })),
      ...meetingNotes.map((m: any) => ({ kind: 'CR', label: m.title || 'Compte rendu' })),
      ...meetings.map((m: any) => ({ kind: 'RDV', label: m.label || m.meeting_type })),
      ...projects.map((p: any) => ({ kind: 'PROJET', label: p.name })),
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

  return (
    <>
      <div
        className="relative"
        style={{ background: '#0f1422', border: '2px solid #0f1422', marginBottom: 20 }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between px-5 py-4"
          style={{ borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 28, height: 28, background: '#E8FF4C' }}
            >
              <Sparkles size={14} style={{ color: '#0f1422' }} />
            </div>
            <div className="min-w-0">
              <p className="display text-white font-bold truncate" style={{ fontSize: 14 }}>
                Excuse de relance
              </p>
              <p className="uppercase tracking-wider text-white/50" style={{ fontSize: 10 }}>
                Générée par l'IA · {dateLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpenModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
            >
              <RefreshCw size={12} />
              Régénérer
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed((s) => !s)}
              className="text-white/60 hover:text-white transition-colors"
              aria-label={isCollapsed ? 'Déplier' : 'Replier'}
            >
              <ChevronDown
                size={14}
                className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
          </div>
        </div>

        {/* Body — collapsed mode */}
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="w-full flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
            style={{ padding: '12px 20px' }}
          >
            <span className="flex-1 truncate text-white/70 text-xs">
              {collapsedPreview || 'Aucune excuse générée.'}
            </span>
            {latest && (
              <span
                className="inline-flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={copy}
                  disabled={!plainBody}
                  className="inline-flex items-center gap-1 font-semibold text-xs disabled:opacity-50"
                  style={{ background: '#E8FF4C', color: '#0f1422', padding: '6px 12px' }}
                >
                  <Copy size={12} /> Copier
                </button>
                <button
                  type="button"
                  onClick={sendMail}
                  className="inline-flex items-center gap-1 text-xs text-white hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px' }}
                >
                  <Send size={12} /> Envoyer par email
                </button>
              </span>
            )}
          </button>
        ) : (
          /* Body — expanded mode */
          <div className="relative px-5 py-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </div>
            ) : !latest ? (
              <p className="text-sm text-white/70 mb-4 leading-relaxed">
                Aucune excuse générée pour ce client. Cliquez sur <strong className="text-white">Régénérer</strong> pour en créer une.
              </p>
            ) : (
              <p className="text-sm text-white/90 mb-4 leading-relaxed whitespace-pre-wrap">
                {plainBody}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={copy}
                disabled={!plainBody}
                className="inline-flex items-center gap-1.5 font-semibold text-sm disabled:opacity-50"
                style={{ background: '#E8FF4C', color: '#0f1422', padding: '8px 16px' }}
              >
                <Copy size={14} /> Copier
              </button>
              <button
                type="button"
                onClick={sendMail}
                disabled={!latest}
                className="inline-flex items-center gap-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-50"
                style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '8px 16px' }}
              >
                <Send size={14} /> Envoyer par email
              </button>

              <div className="ml-auto flex items-center gap-4">
                {historyCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenHistory(true)}
                    className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
                  >
                    <Clock size={12} /> Historique ({historyCount})
                  </button>
                )}
                {sourcesList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSources((s) => !s)}
                    className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
                  >
                    {showSources ? 'Masquer les sources' : 'Voir les sources utilisées'}
                    <ChevronRight
                      size={14}
                      className={showSources ? 'rotate-90 transition-transform' : 'transition-transform'}
                    />
                  </button>
                )}
              </div>
            </div>

            {showSources && sourcesList.length > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <ul className="space-y-1">
                  {sourcesList.map((s, i) => (
                    <li key={i} className="text-xs text-white/70 flex items-center gap-2">
                      <span
                        className="uppercase font-semibold tracking-wider"
                        style={{ background: 'rgba(232,255,76,0.15)', color: '#E8FF4C', padding: '1px 6px', fontSize: 9 }}
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
