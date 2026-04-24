import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, Mail, Trash2, Sparkles, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  trackingId: string;
}

const ACTION_BADGES: Record<string, string> = {
  propose_slot: 'Créneau RDV',
  send_quote: 'Devis',
  schedule_call: 'Call',
  share_case_study: 'Cas client',
  invite_event: 'Événement',
  ask_feedback: 'Retour / avis',
  just_hello: 'Coucou 👋',
  custom: 'Personnalisé',
};

const toneLabel = (t: string) =>
  t === 'friendly' ? 'Chaleureux' : t === 'formal' ? 'Formel' : t === 'direct' ? 'Direct' : t;

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

export function FollowupHistoryList({ trackingId }: Props) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['followup-suggestions', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_followup_suggestions')
        .select('id, tone, recipient_email, recipient_name, subject, body_html, angles, sources, action_key, action_label, created_at')
        .eq('tracking_id', trackingId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const opened = history.find((h: any) => h.id === openId);

  const availableKeys = useMemo(
    () => Array.from(new Set((history as any[]).map((h) => h.action_key).filter(Boolean))) as string[],
    [history],
  );
  const filtered = filter === 'all'
    ? history
    : (history as any[]).filter((h) => (h.action_key || 'unknown') === filter);

  const copyHtml = async (html: string) => {
    try {
      await navigator.clipboard.writeText(html);
      toast.success('HTML copié');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const sendMail = (to: string | null, subject: string | null, html: string) => {
    if (!to) return;
    const plain = htmlToPlain(html);
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject || 'Suite à notre échange')}&body=${encodeURIComponent(plain)}`;
    window.location.href = url;
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_followup_suggestions').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['followup-suggestions', trackingId] });
    qc.invalidateQueries({ queryKey: ['followup-latest', trackingId] });
    toast.success('Suggestion supprimée');
    if (openId === id) setOpenId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500 py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-neutral-500 italic py-4">
        Aucune excuse générée pour ce client.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {availableKeys.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">
            {filtered.length} excuse{filtered.length > 1 ? 's' : ''}
            {filtered.length !== history.length && ` / ${history.length}`}
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-neutral-500">Filtrer :</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs rounded-none">
                <SelectValue placeholder="Toutes les actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                {availableKeys.map((k) => (
                  <SelectItem key={k} value={k}>{ACTION_BADGES[k] || k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-500 italic py-2">Aucune excuse pour ce filtre.</p>
        ) : filtered.map((h: any) => (
          <div key={h.id} className="flex items-start gap-2 border border-neutral-200 p-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate" style={{ color: '#0f1422' }}>
                  {h.subject || '(sans objet)'}
                </p>
                {h.action_key && (
                  <span
                    className="inline-flex items-center font-semibold uppercase tracking-wider"
                    style={{ background: '#0f1422', color: '#E8FF4C', padding: '1px 6px', fontSize: 9 }}
                  >
                    {ACTION_BADGES[h.action_key] || h.action_key}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {format(new Date(h.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                {' · '}{toneLabel(h.tone)}
                {h.recipient_email && (<> · <span className="font-mono">{h.recipient_email}</span></>)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenId(h.id)}
              className="p-1.5 text-neutral-400 hover:text-neutral-900"
              title="Consulter"
              aria-label="Consulter"
            >
              <FileText size={14} />
            </button>
            {h.recipient_email && (
              <button
                type="button"
                onClick={() => sendMail(h.recipient_email, h.subject, h.body_html)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900"
                title="Renvoyer par email"
                aria-label="Renvoyer par email"
              >
                <Mail size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(h.id)}
              className="p-1.5 text-neutral-400 hover:text-red-600"
              title="Supprimer"
              aria-label="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 display">
              <Sparkles className="h-5 w-5" style={{ color: '#0f1422' }} />
              {opened?.subject || 'Excuse de relance'}
            </DialogTitle>
            <DialogDescription>
              {opened && (
                <>
                  {format(new Date(opened.created_at), 'd MMMM yyyy à HH:mm', { locale: fr })}
                  {' · Ton : '}{toneLabel(opened.tone)}
                  {opened.recipient_email && <> · {opened.recipient_email}</>}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {opened && (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="border border-neutral-200 p-4 bg-white">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: opened.body_html || '' }}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
                <Button size="sm" variant="outline" onClick={() => copyHtml(opened.body_html || '')} className="rounded-none">
                  <Copy className="h-4 w-4 mr-1" /> Copier le HTML
                </Button>
                {opened.recipient_email && (
                  <Button
                    size="sm"
                    onClick={() => sendMail(opened.recipient_email, opened.subject, opened.body_html)}
                    className="rounded-none"
                    style={{ background: '#0f1422', color: '#fff' }}
                  >
                    <Mail className="h-4 w-4 mr-1" /> Envoyer par email
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
