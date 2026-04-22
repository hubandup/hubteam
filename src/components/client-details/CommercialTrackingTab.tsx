import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Plus, Trash2, Upload, Calendar as CalIcon, Download, Link as LinkIcon, MessageSquarePlus, Send, RefreshCw, FileText, Sparkles, Copy, Mail, History } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  clientId: string;
  client: any;
}

const STATUS_OPTIONS = [
  { value: 'to_contact', label: 'À contacter' },
  { value: 'to_followup', label: 'À relancer' },
  { value: 'do_not_followup', label: 'Ne pas relancer' },
  { value: 'client', label: 'Client' },
];

const SOURCE_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'event', label: 'Salon / Event' },
  { value: 'network', label: 'Réseau' },
];

const DEFAULT_QUESTIONS = [
  { key: 'company_year', label: "Quand a été créée l'entreprise ?", type: 'year' },
  { key: 'time_in_role', label: 'Depuis combien de temps êtes-vous à ce poste ?', type: 'text' },
  { key: 'usual_agency', label: 'Avec quelle agence travaillez-vous habituellement ?', type: 'text' },
  { key: 'geo_zone', label: 'Sur quelle zone géographique travaillez-vous et votre équipe ?', type: 'multi', options: ['France', 'Europe (EAMA)', 'International'] },
  { key: 'team_composition', label: 'Comment est constituée votre équipe ?', type: 'textarea' },
  { key: 'revenue', label: "Quel est votre chiffre d'affaires ?", type: 'text' },
  { key: 'client_count', label: 'Le nombre de clients ?', type: 'text' },
  { key: 'targets', label: 'Quels sont vos cibles ?', type: 'text' },
  { key: 'goals', label: 'Quels sont vos objectifs ?', type: 'text' },
  { key: 'how_known', label: 'Comment nous avez-vous connus ?', type: 'text' },
];

const DEFAULT_MEETINGS = [
  { type: 'first_contact', label: '1er contact' },
  { type: 'hub_date', label: 'Hub Date' },
  { type: 'rdv', label: 'RDV 1' },
];

function generateICS(title: string, dateISO: string, description = '') {
  const dt = new Date(dateISO);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(dt.getTime() + 60 * 60 * 1000);
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HubTeam//Suivi Commercial//FR\nBEGIN:VEVENT\nUID:${Date.now()}@hubteam\nDTSTAMP:${fmt(new Date())}\nDTSTART:${fmt(dt)}\nDTEND:${fmt(end)}\nSUMMARY:${title}\nDESCRIPTION:${description}\nEND:VEVENT\nEND:VCALENDAR`;
}

function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CommercialTrackingTab({ clientId, client }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Fetch or create tracking row
  const { data: tracking, isLoading } = useQuery({
    queryKey: ['commercial-tracking', clientId],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from('commercial_tracking')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (existing) return existing;
      const { data: inserted, error } = await supabase
        .from('commercial_tracking')
        .insert({ client_id: clientId, status: 'to_contact', created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      // seed questionnaire
      await supabase.from('commercial_questionnaire').insert(
        DEFAULT_QUESTIONS.map((q, i) => ({
          tracking_id: inserted.id,
          question_key: q.key,
          question_label: q.label,
          display_order: i,
        }))
      );
      // seed meetings
      await supabase.from('commercial_meetings').insert(
        DEFAULT_MEETINGS.map((m, i) => ({
          tracking_id: inserted.id,
          meeting_type: m.type,
          label: m.label,
          display_order: i,
        }))
      );
      return inserted;
    },
  });

  if (isLoading || !tracking) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HeaderSection tracking={tracking} client={client} />
      <RelanceHistorySection clientId={clientId} />
      <ContactsSection trackingId={tracking.id} client={client} />
      <NotesSection trackingId={tracking.id} tracking={tracking} client={client} />
      <MeetingsSection trackingId={tracking.id} tracking={tracking} client={client} />
      <QuestionnaireSection trackingId={tracking.id} />
      <ScrapeUrlsSection trackingId={tracking.id} />
    </div>
  );
}

/* ---------- Helper: invoke notify-target-relance ---------- */
async function notifyTeam(params: {
  client_id: string;
  tracking_id: string;
  company: string;
  contact_name?: string;
  event_type: 'manual' | 'note_added' | 'meeting_scheduled' | 'status_change';
  custom_message?: string;
  details?: Record<string, unknown>;
}) {
  return supabase.functions.invoke('notify-target-relance', { body: params });
}

/* ---------- Historique des notifications de relance ---------- */
function RelanceHistorySection({ clientId }: { clientId: string }) {
  const { data: history = [] } = useQuery({
    queryKey: ['target-relance-history', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_relance_notifications')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  if (history.length === 0) return null;

  const channelLabel = (c: string) => c === 'both' ? 'Slack + Email' : c === 'slack' ? 'Slack' : 'Email';
  const eventLabel = (e: string) => {
    switch (e) {
      case 'status_to_followup': return 'À relancer';
      case 'status_change': return 'Changement statut';
      case 'note_added': return 'Note ajoutée';
      case 'meeting_scheduled': return 'RDV planifié';
      case 'manual': return 'Manuel';
      default: return e;
    }
  };
  const statusColor = (s: string) =>
    s === 'sent' ? 'text-green-600' : s === 'failed' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="font-semibold text-lg">Historique des notifications équipe</h3>
        <div className="space-y-2">
          {history.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between text-sm border rounded-lg p-2.5 gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {eventLabel(h.event_type || 'status_to_followup')}
                  <span className="text-xs text-muted-foreground ml-2">· {channelLabel(h.channel)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(h.created_at), 'd MMMM yyyy à HH:mm', { locale: fr })}
                  {h.recipients_count > 0 && ` · ${h.recipients_count} destinataire${h.recipients_count > 1 ? 's' : ''}`}
                </p>
                {h.error_message && (
                  <p className="text-xs text-destructive mt-1 truncate">{h.error_message}</p>
                )}
              </div>
              <span className={`text-xs font-semibold uppercase shrink-0 ${statusColor(h.status)}`}>
                {h.status === 'sent' ? 'Envoyé' : h.status === 'failed' ? 'Échec' : 'En attente'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Header (status + logo + name) ---------- */
function HeaderSection({ tracking, client }: { tracking: any; client: any }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(tracking.company_logo_url);

  useEffect(() => setLogoUrl(tracking.company_logo_url), [tracking.company_logo_url]);

  const updateStatus = async (status: string) => {
    const previousStatus = tracking.status;
    if (status === previousStatus) return; // No-op: pas un vrai changement
    const { error } = await supabase
      .from('commercial_tracking')
      .update({ status: status as any })
      .eq('id', tracking.id);
    if (error) return toast.error('Erreur');
    qc.invalidateQueries({ queryKey: ['commercial-tracking'] });
    toast.success('Statut mis à jour');

    // Notify on status change. For 'to_followup' the edge function performs server-side
    // de-dup (Slack + email). For other transitions, send a lighter Slack-only notice.
    if (status === 'to_followup') {
      try {
        const { data: result, error: notifError } = await supabase.functions.invoke('notify-target-relance', {
          body: {
            client_id: tracking.client_id,
            tracking_id: tracking.id,
            company: client.company,
            contact_name: `${client.first_name} ${client.last_name}`,
            event_type: 'status_to_followup',
            expected_previous_status: previousStatus,
          },
        });
        if (notifError) toast.error("Notification de relance non envoyée");
        else if (!(result as any)?.skipped) {
          toast.success("Équipe notifiée (Slack + email)");
          qc.invalidateQueries({ queryKey: ['target-relance-history', tracking.client_id] });
        }
      } catch (e) {
        console.error('notify-target-relance error', e);
      }
    } else {
      const newLabel = STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
      const prevLabel = STATUS_OPTIONS.find((s) => s.value === previousStatus)?.label || previousStatus;
      notifyTeam({
        client_id: tracking.client_id,
        tracking_id: tracking.id,
        company: client.company,
        contact_name: `${client.first_name} ${client.last_name}`,
        event_type: 'status_change',
        details: { previous_status: previousStatus, previous_status_label: prevLabel, new_status: status, new_status_label: newLabel },
      }).then(() => qc.invalidateQueries({ queryKey: ['target-relance-history', tracking.client_id] }))
        .catch((e) => console.error('notify status_change failed', e));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `commercial/${tracking.client_id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('client-logos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('client-logos').getPublicUrl(path);
      const url = data.publicUrl;
      const { error: updErr } = await supabase
        .from('commercial_tracking')
        .update({ company_logo_url: url })
        .eq('id', tracking.id);
      if (updErr) throw updErr;
      setLogoUrl(url);
      qc.invalidateQueries({ queryKey: ['commercial-tracking'] });
      toast.success('Logo mis à jour');
    } catch (err: any) {
      toast.error(err.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 rounded-lg">
              <AvatarImage src={logoUrl || client.logo_url || undefined} className="object-cover" />
              <AvatarFallback className="rounded-lg">{client.company?.[0]}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:bg-primary/90">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-xl font-bold uppercase">{client.company}</h2>
              <p className="text-sm text-muted-foreground">{client.first_name} {client.last_name}</p>
            </div>
            <div>
              <Label>Statut</Label>
              <div className="flex flex-wrap gap-2 items-end mt-1">
                <Select value={tracking.status} onValueChange={updateStatus}>
                  <SelectTrigger className="w-full md:w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ManualNotifyButton tracking={tracking} client={client} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Bouton "Notifier l'équipe sur Slack" (manuel) ---------- */
function ManualNotifyButton({ tracking, client }: { tracking: any; client: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const { data, error } = await notifyTeam({
        client_id: tracking.client_id,
        tracking_id: tracking.id,
        company: client.company,
        contact_name: `${client.first_name} ${client.last_name}`,
        event_type: 'manual',
        custom_message: message.trim() || `Action requise sur la fiche ${client.company}`,
      });
      if (error) throw error;
      if ((data as any)?.success) {
        toast.success('Équipe notifiée');
      } else {
        toast.warning('Notification enregistrée mais envoi partiel');
      }
      qc.invalidateQueries({ queryKey: ['target-relance-history', tracking.client_id] });
      setOpen(false);
      setMessage('');
    } catch (e: any) {
      toast.error(e.message || 'Erreur envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="h-4 w-4 mr-1" /> Notifier l'équipe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notifier l'équipe sur Slack</DialogTitle>
          <DialogDescription>
            Envoie un message immédiat dans <strong>#hubteam_sales</strong> et par email à l'équipe.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Action requise sur la fiche ${client.company}…`}
          rows={4}
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>Annuler</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Contacts (main from client + additional) ---------- */
function ContactsSection({ trackingId, client }: { trackingId: string; client: any }) {
  const qc = useQueryClient();
  const { data: contacts = [] } = useQuery({
    queryKey: ['commercial-contacts', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_contacts')
        .select('*')
        .eq('tracking_id', trackingId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const addContact = async () => {
    const { error } = await supabase.from('commercial_contacts').insert({
      tracking_id: trackingId,
      first_name: '',
      last_name: '',
      display_order: contacts.length,
    });
    if (error) return toast.error('Erreur');
    qc.invalidateQueries({ queryKey: ['commercial-contacts', trackingId] });
  };

  const updateContact = async (id: string, patch: any) => {
    await supabase.from('commercial_contacts').update(patch).eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-contacts', trackingId] });
  };

  const deleteContact = async (id: string) => {
    await supabase.from('commercial_contacts').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-contacts', trackingId] });
    toast.success('Contact supprimé');
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Informations de contact</h3>
          <Button size="sm" variant="outline" onClick={addContact}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter un contact
          </Button>
        </div>

        {/* Main contact (from client) */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Contact principal</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Prénom :</span> {client.first_name}</div>
            <div><span className="text-muted-foreground">Nom :</span> {client.last_name}</div>
            <div><span className="text-muted-foreground">Email :</span> {client.email}</div>
            <div><span className="text-muted-foreground">Téléphone :</span> {client.phone || '—'}</div>
          </div>
        </div>

        {contacts.map((c: any) => (
          <div key={c.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground font-semibold">Contact additionnel</p>
              <Button size="icon" variant="ghost" onClick={() => deleteContact(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Prénom" defaultValue={c.first_name} onBlur={(e) => updateContact(c.id, { first_name: e.target.value })} />
              <Input placeholder="Nom" defaultValue={c.last_name} onBlur={(e) => updateContact(c.id, { last_name: e.target.value })} />
              <Input placeholder="Poste" defaultValue={c.job_title || ''} onBlur={(e) => updateContact(c.id, { job_title: e.target.value })} />
              <Input placeholder="Email" type="email" defaultValue={c.email || ''} onBlur={(e) => updateContact(c.id, { email: e.target.value })} />
              <Input placeholder="Téléphone" defaultValue={c.phone || ''} onBlur={(e) => updateContact(c.id, { phone: e.target.value })} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------- Notes / commentaires ---------- */
function NotesSection({ trackingId, tracking, client }: { trackingId: string; tracking: any; client: any }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [content, setContent] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['commercial-notes', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_notes')
        .select('*')
        .eq('tracking_id', trackingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // fetch profiles
      const ids = Array.from(new Set((data || []).map((n: any) => n.author_id)));
      if (ids.length === 0) return data || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', ids);
      return (data || []).map((n: any) => ({
        ...n,
        author: profiles?.find((p: any) => p.id === n.author_id),
      }));
    },
  });

  const submit = async () => {
    if (!content.trim() || !user) return;
    const noteText = content.trim();
    const { error } = await supabase.from('commercial_notes').insert({
      tracking_id: trackingId,
      content: noteText,
      author_id: user.id,
    });
    if (error) return toast.error('Erreur');
    setContent('');
    setAdding(false);
    qc.invalidateQueries({ queryKey: ['commercial-notes', trackingId] });
    toast.success('Note ajoutée');
    // Auto-notify Slack (no email)
    notifyTeam({
      client_id: tracking.client_id,
      tracking_id: tracking.id,
      company: client.company,
      contact_name: `${client.first_name} ${client.last_name}`,
      event_type: 'note_added',
      details: { note_preview: noteText.slice(0, 200) },
    }).then(() => qc.invalidateQueries({ queryKey: ['target-relance-history', tracking.client_id] }))
      .catch((e) => console.error('notify note_added failed', e));
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_notes').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-notes', trackingId] });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold text-lg">Notes / Comptes rendus</h3>

        {notes.length === 0 && !adding ? (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            Ajouter une première note
          </Button>
        ) : (
          <>
            {!adding && (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nouvelle note
              </Button>
            )}
            {adding && (
              <div className="space-y-2 border rounded-lg p-3">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Écrivez votre note ou compte rendu..."
                  rows={4}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setContent(''); }}>Annuler</Button>
                  <Button size="sm" onClick={submit} disabled={!content.trim()}>Valider</Button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {notes.map((n: any) => (
                <div key={n.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={n.author?.avatar_url} />
                      <AvatarFallback>{n.author?.first_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.author?.first_name} {n.author?.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(n.created_at), 'd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(n.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Meetings (RDV) ---------- */
function MeetingsSection({ trackingId, tracking, client }: { trackingId: string; tracking: any; client: any }) {
  const qc = useQueryClient();
  const { data: meetings = [] } = useQuery({
    queryKey: ['commercial-meetings', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_meetings')
        .select('*')
        .eq('tracking_id', trackingId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const update = async (id: string, patch: any) => {
    const before = meetings.find((m: any) => m.id === id);
    await supabase.from('commercial_meetings').update(patch).eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
    // Auto-notify when a meeting date is set/changed
    if (patch.meeting_date && patch.meeting_date !== before?.meeting_date) {
      const label = before?.label || 'RDV';
      notifyTeam({
        client_id: tracking.client_id,
        tracking_id: tracking.id,
        company: client.company,
        contact_name: `${client.first_name} ${client.last_name}`,
        event_type: 'meeting_scheduled',
        details: { meeting_label: label, meeting_date: patch.meeting_date },
      }).then(() => qc.invalidateQueries({ queryKey: ['target-relance-history', tracking.client_id] }))
        .catch((e) => console.error('notify meeting_scheduled failed', e));
    }
  };

  const rdvCount = meetings.filter((m: any) => m.meeting_type === 'rdv' || m.meeting_type === 'custom').length;

  const addCustom = async () => {
    const nextNum = rdvCount + 1;
    await supabase.from('commercial_meetings').insert({
      tracking_id: trackingId,
      meeting_type: 'rdv',
      label: `RDV ${nextNum}`,
      display_order: meetings.length,
    });
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_meetings').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
  };

  const exportICS = (m: any) => {
    if (!m.meeting_date) return toast.error('Définissez une date');
    const ics = generateICS(`${m.label} — ${client.company}`, m.meeting_date, `RDV avec ${client.first_name} ${client.last_name}`);
    downloadICS(`rdv-${client.company}-${m.label}.ics`, ics);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Étapes de rendez-vous</h3>
          <Button size="sm" variant="outline" onClick={addCustom}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter un RDV
          </Button>
        </div>
        <div className="space-y-3">
          {(() => {
            let rdvIdx = 0;
            return meetings.map((m: any) => {
              const isRdv = m.meeting_type === 'rdv' || m.meeting_type === 'custom' || m.meeting_type?.startsWith('rdv');
              if (isRdv) rdvIdx += 1;
              const displayLabel = isRdv ? `RDV ${rdvIdx}` : m.label;
              return (
                <div key={m.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{displayLabel}</p>
                    {isRdv && (
                      <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  {m.meeting_type === 'first_contact' && (
                    <div>
                      <Label className="text-xs">Source</Label>
                      <Select value={m.source_type || ''} onValueChange={(v) => update(m.id, { source_type: v })}>
                        <SelectTrigger className="w-full md:w-[240px] mt-1">
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-2 md:items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="datetime-local"
                        defaultValue={m.meeting_date ? new Date(m.meeting_date).toISOString().slice(0, 16) : ''}
                        onChange={(e) => update(m.id, { meeting_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => exportICS({ ...m, label: displayLabel })} disabled={!m.meeting_date}>
                      <CalIcon className="h-4 w-4 mr-1" />
                      <Download className="h-3 w-3 mr-1" />
                      .ics
                    </Button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Questionnaire ---------- */
function QuestionnaireSection({ trackingId }: { trackingId: string }) {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);

  const { data: questions = [] } = useQuery({
    queryKey: ['commercial-questionnaire', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_questionnaire')
        .select('*')
        .eq('tracking_id', trackingId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const updateAnswer = async (id: string, answer: string) => {
    await supabase.from('commercial_questionnaire').update({ answer }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-questionnaire', trackingId] });
  };

  const addCustom = async () => {
    const label = window.prompt('Question :');
    if (!label?.trim()) return;
    await supabase.from('commercial_questionnaire').insert({
      tracking_id: trackingId,
      question_key: `custom_${Date.now()}`,
      question_label: label.trim(),
      display_order: questions.length,
      is_custom: true,
    });
    qc.invalidateQueries({ queryKey: ['commercial-questionnaire', trackingId] });
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_questionnaire').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-questionnaire', trackingId] });
  };

  const renderField = (q: any) => {
    const def = DEFAULT_QUESTIONS.find((d) => d.key === q.question_key);
    const type = def?.type || 'text';

    if (type === 'year') {
      return (
        <div className="flex gap-2">
          <Select value={q.answer || ''} onValueChange={(v) => updateAnswer(q.id, v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Année..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
          {q.answer === 'other' && (
            <Input placeholder="Précisez..." onBlur={(e) => updateAnswer(q.id, `other:${e.target.value}`)} />
          )}
        </div>
      );
    }
    if (type === 'multi' && def) {
      const selected = (q.answer || '').split(',').filter(Boolean);
      const toggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
        updateAnswer(q.id, next.join(','));
      };
      return (
        <div className="flex gap-2 flex-wrap">
          {def.options!.map((opt) => (
            <Button
              key={opt}
              type="button"
              size="sm"
              variant={selected.includes(opt) ? 'default' : 'outline'}
              onClick={() => toggle(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      );
    }
    if (type === 'textarea') {
      return <Textarea defaultValue={q.answer || ''} onBlur={(e) => updateAnswer(q.id, e.target.value)} rows={3} />;
    }
    return <Input defaultValue={q.answer || ''} onBlur={(e) => updateAnswer(q.id, e.target.value)} />;
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Informations complémentaires</h3>
          <Button size="sm" variant="outline" onClick={addCustom}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter une question
          </Button>
        </div>
        <div className="space-y-4">
          {questions.map((q: any) => (
            <div key={q.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{q.question_label}</Label>
                {q.is_custom && (
                  <Button size="icon" variant="ghost" onClick={() => remove(q.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              {renderField(q)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- URLs à scrapper ---------- */
function ScrapeUrlsSection({ trackingId }: { trackingId: string }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Suggestion dialog state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    id?: string | null;
    subject: string;
    body_html: string;
    angles: Array<{ title?: string; description?: string; source?: string }>;
  } | null>(null);
  const [tone, setTone] = useState<'friendly' | 'formal' | 'direct'>('friendly');
  const [action, setAction] = useState<string>('propose_slot');
  const [customAction, setCustomAction] = useState<string>('');

  // Recipient selection state
  const [recipientChoice, setRecipientChoice] = useState<string>('main'); // 'main' | contact id | 'custom'
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  // Get tracking + client + contacts for recipient picker
  const { data: tracking } = useQuery({
    queryKey: ['commercial-tracking-row', trackingId],
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
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_contacts')
        .select('id, first_name, last_name, email, job_title')
        .eq('tracking_id', trackingId)
        .order('display_order');
      return data || [];
    },
  });
  const clientRow: any = tracking?.clients || {};
  const clientId: string | undefined = tracking?.client_id;

  // History of past suggestions
  const { data: history = [] } = useQuery({
    queryKey: ['followup-suggestions', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_followup_suggestions')
        .select('id, tone, recipient_email, recipient_name, subject, body_html, angles, sources, created_at')
        .eq('tracking_id', trackingId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const openedHistory = history.find((h: any) => h.id === historyOpenId);

  const resolveRecipient = (): { email: string; name: string; role: string } => {
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
    const c = extraContacts.find((x: any) => x.id === recipientChoice);
    if (c) {
      return {
        email: c.email || '',
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        role: c.job_title ? `Contact additionnel (${c.job_title})` : 'Contact additionnel',
      };
    }
    return { email: '', name: '', role: 'Contact' };
  };

  const generateSuggestion = async () => {
    const recipient = resolveRecipient();
    if (recipientChoice === 'custom' && !recipient.email) {
      toast.error('Renseignez un email destinataire');
      return;
    }
    setSuggesting(true);
    setSuggestion(null);
    setSuggestOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-followup', {
        body: {
          tracking_id: trackingId,
          tone,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          recipient_role: recipient.role,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        toast.error((data as any).message || (data as any).error);
        setSuggestOpen(false);
        return;
      }
      setSuggestion({
        id: (data as any).id,
        subject: (data as any).subject || '',
        body_html: (data as any).body_html || '',
        angles: (data as any).angles || [],
      });
      qc.invalidateQueries({ queryKey: ['followup-suggestions', trackingId] });
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la génération');
      setSuggestOpen(false);
    } finally {
      setSuggesting(false);
    }
  };

  const copyHtml = async (html: string) => {
    try {
      await navigator.clipboard.writeText(html);
      toast.success('HTML copié');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const copySubject = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      toast.success('Objet copié');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const openMailto = (to: string, subject: string, html: string) => {
    // mailto only supports plain text body — strip tags for fallback
    const plain = html
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim();
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plain)}`;
    window.open(url, '_blank');
  };

  const deleteHistoryItem = async (id: string) => {
    await supabase.from('commercial_followup_suggestions').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['followup-suggestions', trackingId] });
    toast.success('Suggestion supprimée');
    if (historyOpenId === id) setHistoryOpenId(null);
  };

  const toneLabel = (t: string) =>
    t === 'friendly' ? 'Chaleureux' : t === 'formal' ? 'Formel' : t === 'direct' ? 'Direct' : t;

  const senderName = "L'équipe HUB+UP";
  const senderEmail = 'contact@hubandup.org';

  const EmailPreview = ({ to, toName, subject, html }: { to?: string | null; toName?: string | null; subject: string; html: string }) => (
    <div className="border rounded-md overflow-hidden bg-background shadow-sm">
      <div className="bg-muted/50 border-b px-4 py-3 space-y-1 text-xs">
        <div className="flex gap-2"><span className="text-muted-foreground w-16 shrink-0">De</span><span className="font-medium">{senderName} &lt;{senderEmail}&gt;</span></div>
        <div className="flex gap-2"><span className="text-muted-foreground w-16 shrink-0">À</span><span className="font-medium">{toName ? `${toName} ` : ''}{to ? `<${to}>` : <span className="text-muted-foreground italic">(non renseigné)</span>}</span></div>
        <div className="flex gap-2"><span className="text-muted-foreground w-16 shrink-0">Objet</span><span className="font-semibold text-foreground">{subject || <span className="italic text-muted-foreground">(aucun)</span>}</span></div>
      </div>
      <div
        className="prose prose-sm max-w-none p-5 bg-background"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );


  const { data: urls = [] } = useQuery({
    queryKey: ['commercial-scrape-urls', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_scrape_urls')
        .select('*')
        .eq('tracking_id', trackingId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const add = async () => {
    if (!url.trim()) return;
    const { error } = await supabase.from('commercial_scrape_urls').insert({
      tracking_id: trackingId,
      url: url.trim(),
      label: label.trim() || null,
    });
    if (error) return toast.error('Erreur');
    setUrl('');
    setLabel('');
    qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
    toast.success('URL ajoutée');
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_scrape_urls').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
  };

  const scrapeOne = async (id: string) => {
    setScrapingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-commercial-urls', { body: { url_id: id } });
      if (error) throw error;
      const ok = (data as any)?.results?.[0]?.ok;
      toast[ok ? 'success' : 'error'](ok ? 'URL scrapée' : 'Échec du scraping');
      qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur scraping');
    } finally {
      setScrapingId(null);
    }
  };

  const scrapeAll = async () => {
    if (urls.length === 0) return;
    setScrapingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-commercial-urls', { body: { tracking_id: trackingId } });
      if (error) throw error;
      toast.success(`${(data as any)?.scraped || 0} URL(s) scrapée(s)`);
      qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur scraping');
    } finally {
      setScrapingAll(false);
    }
  };

  const preview = urls.find((u: any) => u.id === previewId);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              URLs à scrapper pour idées de relance
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Scraping automatique chaque lundi matin. Vous pouvez aussi déclencher manuellement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {urls.length > 0 && (
              <Button size="sm" variant="outline" onClick={scrapeAll} disabled={scrapingAll}>
                {scrapingAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Scraper toutes
              </Button>
            )}
          </div>
        </div>


        <div className="flex flex-col md:flex-row gap-2">
          <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
          <Input placeholder="Libellé (optionnel)" value={label} onChange={(e) => setLabel(e.target.value)} className="md:w-[220px]" />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>

        <div className="space-y-2">
          {urls.map((u: any) => (
            <div key={u.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  {u.label && <p className="text-sm font-medium">{u.label}</p>}
                  <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                    {u.url}
                  </a>
                  {u.last_scraped_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dernier scrape : {format(new Date(u.last_scraped_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      {u.last_scrape_status === 'failed' && <span className="text-destructive ml-1">· échec</span>}
                    </p>
                  )}
                </div>
                {u.last_scrape_summary && (
                  <Button size="icon" variant="ghost" onClick={() => setPreviewId(u.id)} title="Voir le résumé">
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => scrapeOne(u.id)} disabled={scrapingId === u.id} title="Scraper maintenant">
                  {scrapingId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(u.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {u.last_scrape_summary && previewId !== u.id && (
                <p className="text-xs text-muted-foreground line-clamp-2 pl-1">{u.last_scrape_summary}</p>
              )}
            </div>
          ))}
        </div>

        <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{preview?.label || 'Résumé'}</DialogTitle>
              <DialogDescription className="truncate">{preview?.url}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm">
              {preview?.last_scrape_summary || 'Aucun résumé.'}
            </div>
          </DialogContent>
        </Dialog>

        {/* === Générateur d'excuse de relance === */}
        {urls.some((u: any) => u.last_scrape_status === 'success') && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Générer une excuse de relance</h4>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Destinataire</Label>
                <Select value={recipientChoice} onValueChange={setRecipientChoice}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientRow.email && (
                      <SelectItem value="main">
                        Contact principal — {clientRow.first_name} {clientRow.last_name} ({clientRow.email})
                      </SelectItem>
                    )}
                    {extraContacts.filter((c: any) => c.email).map((c: any) => (
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
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Chaleureux</SelectItem>
                    <SelectItem value="formal">Formel</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recipientChoice === 'custom' && (
                <>
                  <div>
                    <Label className="text-xs">Email destinataire</Label>
                    <Input
                      type="email"
                      placeholder="prenom.nom@exemple.com"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nom (optionnel)</Label>
                    <Input
                      placeholder="Marie Dupont"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>

            <Button size="sm" onClick={generateSuggestion} disabled={suggesting}>
              {suggesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Générer l'excuse de relance
            </Button>
          </div>
        )}

        {/* === Historique des suggestions === */}
        {history.length > 0 && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Historique des excuses générées ({history.length})</h4>
            </div>
            <div className="space-y-2">
              {history.map((h: any) => (
                <div key={h.id} className="flex items-start gap-2 border rounded-md p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{h.subject || '(sans objet)'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                      {' · '}{toneLabel(h.tone)}
                      {h.recipient_email && (
                        <> · <span className="font-mono">{h.recipient_email}</span></>
                      )}
                      {Array.isArray(h.sources) && h.sources.length > 0 && (
                        <> · {h.sources.length} source{h.sources.length > 1 ? 's' : ''}</>
                      )}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setHistoryOpenId(h.id)} title="Voir">
                    <FileText className="h-4 w-4" />
                  </Button>
                  {h.recipient_email && (
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => openMailto(h.recipient_email, h.subject, h.body_html)}
                      title="Ouvrir dans le client mail"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteHistoryItem(h.id)} title="Supprimer">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === Aperçu d'une suggestion historique === */}
        <Dialog open={!!historyOpenId} onOpenChange={(o) => !o && setHistoryOpenId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {openedHistory?.subject || 'Suggestion de relance'}
              </DialogTitle>
              <DialogDescription>
                {openedHistory && (
                  <>
                    {format(new Date(openedHistory.created_at), 'd MMMM yyyy à HH:mm', { locale: fr })}
                    {' · '}Ton : {toneLabel(openedHistory.tone)}
                    {openedHistory.recipient_email && <> · Destinataire : {openedHistory.recipient_email}</>}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {openedHistory && (
              <div className="space-y-4 max-h-[65vh] overflow-y-auto">
                {Array.isArray(openedHistory.angles) && openedHistory.angles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Angles</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {openedHistory.angles.map((a: any, i: number) => (
                        <li key={i}>
                          <span className="font-medium">{a.title}</span>
                          {a.description && <> — {a.description}</>}
                          {a.source && <span className="text-muted-foreground"> ({a.source})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Aperçu de l'email</p>
                  <EmailPreview
                    to={openedHistory.recipient_email}
                    toName={openedHistory.recipient_name}
                    subject={openedHistory.subject || ''}
                    html={openedHistory.body_html || ''}
                  />
                </div>
                {Array.isArray(openedHistory.sources) && openedHistory.sources.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Sources utilisées</p>
                    <ul className="list-disc pl-5 text-sm space-y-0.5">
                      {openedHistory.sources.map((s: any, i: number) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {s.label || s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => copySubject(openedHistory.subject || '')}>
                    <Copy className="h-4 w-4 mr-1" /> Copier l'objet
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyHtml(openedHistory.body_html || '')}>
                    <Copy className="h-4 w-4 mr-1" /> Copier le HTML
                  </Button>
                  {openedHistory.recipient_email && (
                    <Button
                      size="sm"
                      onClick={() => openMailto(openedHistory.recipient_email, openedHistory.subject, openedHistory.body_html)}
                    >
                      <Mail className="h-4 w-4 mr-1" /> Ouvrir dans Mail
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* === Dialog résultat génération === */}
        <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Excuse de relance générée
              </DialogTitle>
              <DialogDescription>
                {suggestion?.subject || 'Basée sur les contenus scrappés des URLs ci-dessus.'}
              </DialogDescription>
            </DialogHeader>

            {suggesting && !suggestion ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse des contenus scrappés…
              </div>
            ) : suggestion ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {suggestion.angles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Angles identifiés</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {suggestion.angles.map((a, i) => (
                        <li key={i}>
                          <span className="font-medium">{a.title}</span>
                          {a.description && <> — {a.description}</>}
                          {a.source && <span className="text-muted-foreground"> ({a.source})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(() => {
                  const r = resolveRecipient();
                  return (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Aperçu de l'email</p>
                      <EmailPreview to={r.email} toName={r.name} subject={suggestion.subject} html={suggestion.body_html} />
                    </div>
                  );
                })()}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => copySubject(suggestion.subject)}>
                    <Copy className="h-4 w-4 mr-1" /> Copier l'objet
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyHtml(suggestion.body_html)}>
                    <Copy className="h-4 w-4 mr-1" /> Copier le HTML
                  </Button>
                  {(() => {
                    const r = resolveRecipient();
                    return r.email ? (
                      <Button size="sm" onClick={() => openMailto(r.email, suggestion.subject, suggestion.body_html)}>
                        <Mail className="h-4 w-4 mr-1" /> Ouvrir dans Mail ({r.email})
                      </Button>
                    ) : null;
                  })()}
                  <Button size="sm" variant="ghost" onClick={generateSuggestion} disabled={suggesting}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Régénérer
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune suggestion.</p>
            )}
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}
