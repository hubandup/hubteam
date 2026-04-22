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
import { Loader2, Plus, Trash2, Upload, Calendar as CalIcon, Download, Link as LinkIcon, MessageSquarePlus } from 'lucide-react';
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
      <NotesSection trackingId={tracking.id} />
      <MeetingsSection trackingId={tracking.id} client={client} />
      <QuestionnaireSection trackingId={tracking.id} />
      <ScrapeUrlsSection trackingId={tracking.id} />
    </div>
  );
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
  const statusColor = (s: string) =>
    s === 'sent' ? 'text-green-600' : s === 'failed' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="font-semibold text-lg">Historique des relances envoyées à l'équipe</h3>
        <div className="space-y-2">
          {history.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between text-sm border rounded-lg p-2.5">
              <div>
                <p className="font-medium">{channelLabel(h.channel)}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(h.created_at), 'd MMMM yyyy à HH:mm', { locale: fr })}
                  {h.recipients_count > 0 && ` · ${h.recipients_count} destinataire${h.recipients_count > 1 ? 's' : ''}`}
                </p>
                {h.error_message && (
                  <p className="text-xs text-destructive mt-1">{h.error_message}</p>
                )}
              </div>
              <span className={`text-xs font-semibold uppercase ${statusColor(h.status)}`}>
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
    const { error } = await supabase
      .from('commercial_tracking')
      .update({ status: status as any })
      .eq('id', tracking.id);
    if (error) return toast.error('Erreur');
    qc.invalidateQueries({ queryKey: ['commercial-tracking'] });
    toast.success('Statut mis à jour');

    // Trigger Slack/email notification when transitioning to "to_followup"
    if (status === 'to_followup' && previousStatus !== 'to_followup') {
      try {
        const { error: notifError } = await supabase.functions.invoke('notify-target-relance', {
          body: {
            client_id: tracking.client_id,
            tracking_id: tracking.id,
            company: client.company,
            contact_name: `${client.first_name} ${client.last_name}`,
          },
        });
        if (notifError) {
          toast.error("Notification de relance non envoyée");
        } else {
          toast.success("Équipe notifiée (Slack + email)");
          qc.invalidateQueries({ queryKey: ['target-relance-history', tracking.client_id] });
        }
      } catch (e) {
        console.error('notify-target-relance error', e);
      }
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
              <Select value={tracking.status} onValueChange={updateStatus}>
                <SelectTrigger className="w-full md:w-[280px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
function NotesSection({ trackingId }: { trackingId: string }) {
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
    const { error } = await supabase.from('commercial_notes').insert({
      tracking_id: trackingId,
      content: content.trim(),
      author_id: user.id,
    });
    if (error) return toast.error('Erreur');
    setContent('');
    setAdding(false);
    qc.invalidateQueries({ queryKey: ['commercial-notes', trackingId] });
    toast.success('Note ajoutée');
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
function MeetingsSection({ trackingId, client }: { trackingId: string; client: any }) {
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
    await supabase.from('commercial_meetings').update(patch).eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
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
              const isRdv = m.meeting_type === 'rdv' || m.meeting_type === 'custom';
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

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            URLs à scrapper pour idées de relance
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Ajoutez des URLs (site, blog, presse) à scrapper régulièrement pour générer des idées de relance.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
          <Input placeholder="Libellé (optionnel)" value={label} onChange={(e) => setLabel(e.target.value)} className="md:w-[220px]" />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>

        <div className="space-y-2">
          {urls.map((u: any) => (
            <div key={u.id} className="flex items-center gap-2 border rounded-lg p-2">
              <div className="flex-1 min-w-0">
                {u.label && <p className="text-sm font-medium">{u.label}</p>}
                <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                  {u.url}
                </a>
                {u.last_scraped_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dernier scrape : {format(new Date(u.last_scraped_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(u.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
