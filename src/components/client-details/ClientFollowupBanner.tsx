import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Sparkles, RefreshCw, Copy, Send, ChevronRight, Loader2, Check, Clock,
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
  const [copied, setCopied] = useState(false);

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
    : null;

  const copy = async () => {
    if (!plainBody) return;
    try {
      await navigator.clipboard.writeText(plainBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
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
    if (Array.isArray(s)) return s.map((u: any) => ({ kind: 'URL', label: u.label || u.url }));
    const list: { kind: string; label: string }[] = [];
    (s.urls || []).forEach((u: any) => list.push({ kind: 'URL', label: u.label || u.url }));
    (s.meeting_notes || []).forEach((m: any) => list.push({ kind: 'CR', label: m.title || 'Compte rendu' }));
    (s.meetings || []).forEach((m: any) => list.push({ kind: 'RDV', label: m.label || m.meeting_type }));
    (s.projects || []).forEach((p: any) => list.push({ kind: 'PROJET', label: p.name }));
    if (s.qualification?.length) list.push({ kind: 'QUALIF', label: `Qualification (${s.qualification.length})` });
    return list;
  }, [latest]);

  const hasExcuse = !!latest && !!plainBody;

  return (
    <>
      <section
        className="bg-card border border-border overflow-hidden animate-fade-in"
        style={{ borderRadius: 18, marginBottom: 20 }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, hsl(var(--brand-ink)), hsl(216 60% 18%))',
            }}
          >
            <Sparkles size={16} style={{ color: 'hsl(var(--brand-yellow))' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="display font-bold text-foreground leading-none" style={{ fontSize: 16 }}>
                Assistant de relance
              </h3>
              <span
                className="font-semibold tracking-wider uppercase"
                style={{
                  background: 'hsl(var(--brand-ink))',
                  color: 'hsl(var(--brand-yellow))',
                  padding: '2px 7px',
                  fontSize: 9,
                  borderRadius: 6,
                }}
              >
                IA
              </span>
            </div>
            <p className="text-muted-foreground mt-1" style={{ fontSize: 12 }}>
              Génère un message de relance personnalisé pour ce contact
            </p>
          </div>
          {hasExcuse && dateLabel && (
            <div
              className="inline-flex items-center gap-1.5 flex-shrink-0"
              style={{
                background: 'hsl(145 55% 93%)',
                color: 'hsl(154 76% 30%)',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <span
                className="inline-block"
                style={{ width: 6, height: 6, borderRadius: 999, background: 'hsl(154 76% 36%)' }}
              />
              Généré {dateLabel}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 pb-5">
          {isLoading ? (
            <div className="space-y-2 py-2">
              <div className="h-3 bg-muted rounded-full animate-pulse w-11/12" />
              <div className="h-3 bg-muted rounded-full animate-pulse w-full" />
              <div className="h-3 bg-muted rounded-full animate-pulse w-4/5" />
              <div className="flex items-center gap-2 text-muted-foreground pt-2" style={{ fontSize: 12 }}>
                <Loader2 size={12} className="animate-spin" /> Rédaction en cours…
              </div>
            </div>
          ) : !hasExcuse ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4" style={{ fontSize: 13 }}>
                Aucune relance générée pour ce contact. Lance la génération pour obtenir un message contextualisé.
              </p>
              <button
                type="button"
                onClick={() => setOpenModal(true)}
                disabled={!trackingId}
                className="inline-flex items-center gap-2 font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: 'hsl(var(--brand-yellow))',
                  color: 'hsl(var(--brand-ink))',
                  padding: '12px 24px',
                  borderRadius: 999,
                  fontSize: 14,
                }}
              >
                <Sparkles size={15} /> Générer une relance
              </button>
            </div>
          ) : (
            <>
              <div
                className="whitespace-pre-line text-foreground"
                style={{
                  background: 'hsl(220 14% 97%)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 13.5,
                  lineHeight: 1.65,
                }}
              >
                {plainBody}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 font-semibold transition-colors"
                  style={{
                    background: copied ? 'hsl(145 55% 93%)' : 'hsl(var(--brand-yellow))',
                    color: copied ? 'hsl(154 76% 30%)' : 'hsl(var(--brand-ink))',
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 12.5,
                  }}
                >
                  {copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
                </button>
                <button
                  type="button"
                  onClick={sendMail}
                  className="inline-flex items-center gap-1.5 font-semibold transition-colors hover:opacity-90"
                  style={{
                    background: 'hsl(var(--brand-ink))',
                    color: 'hsl(0 0% 100%)',
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 12.5,
                  }}
                >
                  <Send size={13} /> Envoyer par email
                </button>

                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenModal(true)}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ fontSize: 12 }}
                  >
                    <RefreshCw size={12} /> Régénérer
                  </button>
                  {historyCount > 1 && (
                    <button
                      type="button"
                      onClick={() => setOpenHistory(true)}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      <Clock size={12} /> Historique ({historyCount})
                    </button>
                  )}
                  {sourcesList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSources((s) => !s)}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      Sources
                      <ChevronRight size={12} className={showSources ? 'rotate-90 transition-transform' : 'transition-transform'} />
                    </button>
                  )}
                </div>
              </div>

              {showSources && sourcesList.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <ul className="space-y-1.5">
                    {sourcesList.map((s, i) => (
                      <li key={i} className="text-muted-foreground flex items-center gap-2" style={{ fontSize: 11.5 }}>
                        <span
                          className="uppercase font-semibold tracking-wider"
                          style={{
                            background: 'hsl(var(--brand-ink))',
                            color: 'hsl(var(--brand-yellow))',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 9,
                          }}
                        >
                          {s.kind}
                        </span>
                        <span className="truncate">{s.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {trackingId && (
        <>
          <FollowupGeneratorModal open={openModal} onOpenChange={setOpenModal} trackingId={trackingId} />
          <FollowupHistoryModal open={openHistory} onOpenChange={setOpenHistory} trackingId={trackingId} />
        </>
      )}
    </>
  );
}
