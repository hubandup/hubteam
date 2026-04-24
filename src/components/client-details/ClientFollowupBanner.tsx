import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Sparkles, RefreshCw, Copy, Send, ChevronRight, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { FollowupGeneratorModal } from './FollowupGeneratorModal';

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
  const [showSources, setShowSources] = useState(false);

  // Get tracking id for this client
  const { data: tracking } = useQuery({
    queryKey: ['commercial-tracking-by-client', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_tracking')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle();
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
    const subject = latest.subject || '';
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
    window.open(url, '_blank');
  };

  const sourcesList = useMemo(() => {
    if (!latest?.sources) return [];
    const s: any = latest.sources;
    const urls = Array.isArray(s) ? s : (s?.urls || []);
    const meetingNotes = Array.isArray(s) ? [] : (s?.meeting_notes || []);
    const meetings = Array.isArray(s) ? [] : (s?.meetings || []);
    return [
      ...urls.map((u: any) => ({ kind: 'URL', label: u.label || u.url })),
      ...meetingNotes.map((m: any) => ({ kind: 'CR', label: m.title || 'Compte rendu' })),
      ...meetings.map((m: any) => ({ kind: 'RDV', label: m.label || m.meeting_type })),
    ];
  }, [latest]);

  return (
    <>
      <div
        className="relative"
        style={{ background: '#0f1422', border: '2px solid #0f1422', marginBottom: 20 }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
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
              <p
                className="uppercase tracking-wider text-white/50"
                style={{ fontSize: 10 }}
              >
                Générée par l'IA · {dateLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={12} />
            Régénérer
          </button>
        </div>

        {/* Body */}
        <div className="relative px-5 py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-white/60 text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : !latest ? (
            <p className="text-sm text-white/70 mb-4 leading-relaxed">
              Aucune excuse générée pour ce client. Cliquez sur <strong className="text-white">Régénérer</strong> pour en créer une à partir des URLs veille, des comptes rendus et du site Hub & Up.
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
              <Send size={14} /> Envoyer via Gmail
            </button>
            {sourcesList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSources((s) => !s)}
                className="ml-auto inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
              >
                {showSources ? 'Masquer les sources' : 'Voir les sources utilisées'}
                <ChevronRight size={14} className={showSources ? 'rotate-90 transition-transform' : 'transition-transform'} />
              </button>
            )}
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
      </div>

      {trackingId && (
        <FollowupGeneratorModal
          open={openModal}
          onOpenChange={setOpenModal}
          trackingId={trackingId}
        />
      )}
    </>
  );
}
