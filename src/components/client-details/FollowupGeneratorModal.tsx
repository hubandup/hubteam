import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Sparkles, History, CalendarClock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FollowupHistoryList } from './FollowupHistoryList';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trackingId: string;
}

const ACTION_LABELS: Record<string, string> = {
  propose_slot: 'Proposer un créneau de rendez-vous',
  send_quote: 'Envoyer ou relancer un devis',
  schedule_call: 'Planifier un call de découverte',
  share_case_study: 'Partager un cas client / une référence pertinente',
  invite_event: 'Inviter à un événement HUB+UP',
  ask_feedback: 'Demander un retour / un avis',
  just_hello: 'Juste un coucou amical, sans objectif commercial direct',
};

export function FollowupGeneratorModal({ open, onOpenChange, trackingId }: Props) {
  const qc = useQueryClient();
  const [tone, setTone] = useState<'friendly' | 'formal' | 'direct'>('friendly');
  const [address, setAddress] = useState<'vous' | 'tu'>('vous');
  const [action, setAction] = useState<string>('propose_slot');
  const [customAction, setCustomAction] = useState('');
  const [recipientChoice, setRecipientChoice] = useState<string>('main');
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: tracking } = useQuery({
    queryKey: ['commercial-tracking-row', trackingId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_tracking')
        .select('client_id, clients(id, company, first_name, last_name, email)')
        .eq('id', trackingId)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: extraContacts = [] } = useQuery({
    queryKey: ['commercial-contacts', trackingId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_contacts')
        .select('id, first_name, last_name, email, job_title')
        .eq('tracking_id', trackingId)
        .order('display_order');
      return data || [];
    },
  });

  // Configuration Calendly (app_config) — utilisée pour afficher l'attribution
  // uniquement quand l'action choisie nécessite un lien de réservation.
  const { data: calendlyCfg } = useQuery({
    queryKey: ['app-config-calendly'],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
          'calendly_charles_email',
          'calendly_charles_url',
          'calendly_amandine_email',
          'calendly_amandine_url',
        ]);
      const cfg: Record<string, string> = {};
      (data || []).forEach((r: any) => { cfg[r.key] = r.value || ''; });
      return cfg;
    },
  });

  const ACTIONS_REQUIRING_BOOKING = ['propose_slot', 'schedule_call'];
  const wantsBookingLink = ACTIONS_REQUIRING_BOOKING.includes(action);

  const calendlyAttribution = useMemo(() => {
    if (!wantsBookingLink) return null;
    const cfg = calendlyCfg || {};
    const userEmail = (supabase.auth.getSession ? null : null); // placeholder, see below
    // Resolve via current session email
    return null as null | { owner: 'charles' | 'amandine'; url: string; email: string };
  }, [wantsBookingLink, calendlyCfg]);

  // Resolve attribution using the current authenticated user's email
  const [resolvedCalendly, setResolvedCalendly] = useState<
    null | { owner: 'charles' | 'amandine'; url: string; email: string }
  >(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!wantsBookingLink || !calendlyCfg) { setResolvedCalendly(null); return; }
      const { data: { user } } = await supabase.auth.getUser();
      const me = (user?.email || '').toLowerCase();
      const cfg = calendlyCfg;
      const charlesEmail = (cfg.calendly_charles_email || '').toLowerCase();
      const amandineEmail = (cfg.calendly_amandine_email || '').toLowerCase();
      let pick: typeof resolvedCalendly = null;
      if (me && me === amandineEmail && cfg.calendly_amandine_url) {
        pick = { owner: 'amandine', email: cfg.calendly_amandine_email, url: cfg.calendly_amandine_url };
      } else if (me && me === charlesEmail && cfg.calendly_charles_url) {
        pick = { owner: 'charles', email: cfg.calendly_charles_email, url: cfg.calendly_charles_url };
      } else if (cfg.calendly_charles_url) {
        pick = { owner: 'charles', email: cfg.calendly_charles_email, url: cfg.calendly_charles_url };
      }
      if (!cancelled) setResolvedCalendly(pick);
    })();
    return () => { cancelled = true; };
  }, [wantsBookingLink, calendlyCfg]);

  const clientRow: any = tracking?.clients || {};

  useEffect(() => {
    if (!open) {
      setBusy(false);
    }
  }, [open]);

  const resolveRecipient = () => {
    if (recipientChoice === 'main') {
      return {
        email: clientRow.email || '',
        name: `${clientRow.first_name || ''} ${clientRow.last_name || ''}`.trim(),
        role: 'Contact principal',
      };
    }
    if (recipientChoice === 'custom') {
      return { email: customEmail.trim(), name: customName.trim(), role: 'Personnalisé' };
    }
    const c = (extraContacts as any[]).find((x) => x.id === recipientChoice);
    if (c) {
      return {
        email: c.email || '',
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        role: c.job_title ? `Contact additionnel (${c.job_title})` : 'Contact additionnel',
      };
    }
    return { email: '', name: '', role: 'Contact' };
  };

  const generate = async () => {
    const recipient = resolveRecipient();
    if (recipientChoice === 'custom' && !recipient.email) {
      toast.error('Renseignez un email destinataire');
      return;
    }
    if (action === 'custom' && !customAction.trim()) {
      toast.error("Précisez l'action à proposer");
      return;
    }
    setBusy(true);
    try {
      const labels: Record<string, string> = { ...ACTION_LABELS, custom: customAction.trim() };
      const actionLabel = labels[action] || labels.propose_slot;
      const { data, error } = await supabase.functions.invoke('suggest-followup', {
        body: {
          tracking_id: trackingId,
          tone,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          recipient_role: recipient.role,
          action_key: action,
          action_label: actionLabel,
          address_form: address,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        toast.error((data as any).message || (data as any).error);
        return;
      }
      toast.success('Nouvelle excuse générée');
      qc.invalidateQueries({ queryKey: ['followup-suggestions', trackingId] });
      qc.invalidateQueries({ queryKey: ['followup-latest', trackingId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la génération');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 display">
            <Sparkles className="h-5 w-5" style={{ color: '#0f1422' }} />
            Régénérer une excuse de relance
          </DialogTitle>
          <DialogDescription>
            Configure le destinataire, le ton et l'action à proposer. La génération s'appuie sur les URLs scrappées, les comptes rendus et le site Hub & Up.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Destinataire</Label>
            <Select value={recipientChoice} onValueChange={setRecipientChoice}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {clientRow.email && (
                  <SelectItem value="main">
                    Contact principal — {clientRow.first_name} {clientRow.last_name} ({clientRow.email})
                  </SelectItem>
                )}
                {(extraContacts as any[]).filter((c) => c.email).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}{c.job_title ? ` — ${c.job_title}` : ''} ({c.email})
                  </SelectItem>
                ))}
                <SelectItem value="custom">Autre destinataire…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ton</Label>
            <Select value={tone} onValueChange={(v: any) => setTone(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Chaleureux</SelectItem>
                <SelectItem value="formal">Formel</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Adresse</Label>
            <Select value={address} onValueChange={(v: any) => setAddress(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vous">Vouvoiement (vous)</SelectItem>
                <SelectItem value="tu">Tutoiement (tu)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Action à proposer</Label>
            <Select value={action} onValueChange={(v: any) => setAction(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="propose_slot">Proposer un créneau de rendez-vous</SelectItem>
                <SelectItem value="send_quote">Envoyer ou relancer un devis</SelectItem>
                <SelectItem value="schedule_call">Planifier un call de découverte</SelectItem>
                <SelectItem value="share_case_study">Partager un cas client / référence</SelectItem>
                <SelectItem value="invite_event">Inviter à un événement HUB+UP</SelectItem>
                <SelectItem value="ask_feedback">Demander un retour / un avis</SelectItem>
                <SelectItem value="just_hello">Juste un coucou 👋</SelectItem>
                <SelectItem value="custom">Personnalisé…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === 'custom' && (
            <div className="md:col-span-2">
              <Label className="text-xs">Action personnalisée</Label>
              <Input value={customAction} onChange={(e) => setCustomAction(e.target.value)} className="mt-1" />
            </div>
          )}
          {recipientChoice === 'custom' && (
            <>
              <div>
                <Label className="text-xs">Email destinataire</Label>
                <Input type="email" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nom (optionnel)</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} className="mt-1" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
          <Button
            onClick={generate}
            disabled={busy}
            style={{ background: '#0f1422', color: '#fff' }}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Régénérer
          </Button>
        </DialogFooter>

        {/* Historique des excuses générées */}
        <div className="mt-2 pt-4 border-t border-neutral-200">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4" style={{ color: '#0f1422' }} />
            <h4 className="display font-bold" style={{ fontSize: 14, color: '#0f1422' }}>
              Historique des excuses générées
            </h4>
          </div>
          <FollowupHistoryList trackingId={trackingId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
