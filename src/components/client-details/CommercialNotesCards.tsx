import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Plus, Loader2, Trash2, Lock, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface Props {
  trackingId: string;
  tracking: any;
  client: any;
}

const TYPE_EMOJI = (content: string) => {
  const c = content.toLowerCase();
  if (c.includes('appel') || c.includes('call') || c.includes('téléph')) return '📞';
  if (c.includes('rdv') || c.includes('réunion') || c.includes('meeting') || c.includes('rencontre')) return '🤝';
  if (c.includes('email') || c.includes('mail') || c.includes('courriel')) return '✉️';
  return '📝';
};

function preview(text: string, max = 180) {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + '…';
}

// Try to find an explicit business date in the note content (FR formats).
// Falls back to the row's created_at when nothing meaningful is found.
const FR_MONTHS: Record<string, number> = {
  janvier: 0, 'janv.': 0, janv: 0,
  février: 1, fevrier: 1, 'févr.': 1, fevr: 1,
  mars: 2,
  avril: 3, 'avr.': 3, avr: 3,
  mai: 4,
  juin: 5,
  juillet: 6, 'juil.': 6, juil: 6,
  août: 7, aout: 7,
  septembre: 8, 'sept.': 8, sept: 8,
  octobre: 9, 'oct.': 9, oct: 9,
  novembre: 10, 'nov.': 10, nov: 10,
  décembre: 11, decembre: 11, 'déc.': 11, dec: 11,
};

function extractMeetingDate(content: string, fallbackISO: string): Date {
  if (!content) return new Date(fallbackISO);
  const fallback = new Date(fallbackISO);
  const fallbackYear = fallback.getFullYear();

  // 1) "12 mars 2025" or "12 mars" (year optional)
  const reFr = /\b(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s*(\d{4})?\b/g;
  let m: RegExpExecArray | null;
  while ((m = reFr.exec(content)) !== null) {
    const day = parseInt(m[1], 10);
    const monthKey = m[2].toLowerCase();
    const month = FR_MONTHS[monthKey];
    if (month === undefined) continue;
    const year = m[3] ? parseInt(m[3], 10) : fallbackYear;
    if (day < 1 || day > 31) continue;
    return new Date(year, month, day);
  }

  // 2) "12/03/2025" or "12-03-2025"
  const reNum = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/.exec(content);
  if (reNum) {
    const day = parseInt(reNum[1], 10);
    const month = parseInt(reNum[2], 10) - 1;
    let year = parseInt(reNum[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      return new Date(year, month, day);
    }
  }

  return fallback;
}

async function notifyTeam(params: any) {
  return supabase.functions.invoke('notify-target-relance', { body: params });
}

export function CommercialNotesCards({ trackingId, tracking, client }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openAdd, setOpenAdd] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['commercial-notes', trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_notes')
        .select('*')
        .eq('tracking_id', trackingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
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

  const filteredNotes = useMemo(() => {
    if (privacyFilter === 'public') return notes.filter((n: any) => !n.is_private);
    if (privacyFilter === 'private') return notes.filter((n: any) => n.is_private);
    return notes;
  }, [notes, privacyFilter]);

  const visible = useMemo(
    () => (showAll ? filteredNotes : filteredNotes.slice(0, 3)),
    [showAll, filteredNotes],
  );

  const submit = async () => {
    if (!content.trim() || !user) return;
    setSubmitting(true);
    try {
      const noteText = content.trim();
      const { error } = await supabase.from('commercial_notes').insert({
        tracking_id: trackingId,
        content: noteText,
        author_id: user.id,
        is_private: newIsPrivate,
      });
      if (error) throw error;
      setContent('');
      setNewIsPrivate(false);
      setOpenAdd(false);
      qc.invalidateQueries({ queryKey: ['commercial-notes', trackingId] });
      toast.success('CR ajouté');
      notifyTeam({
        client_id: tracking.client_id,
        tracking_id: tracking.id,
        company: client.company,
        contact_name: `${client.first_name} ${client.last_name}`,
        event_type: 'note_added',
        details: { note_preview: noteText.slice(0, 200) },
      })
        .then(() => qc.invalidateQueries({ queryKey: ['target-relance-history', tracking.client_id] }))
        .catch((e) => console.error('notify note_added failed', e));
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_notes').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-notes', trackingId] });
    toast.success('CR supprimé');
  };

  const openEdit = (n: any) => {
    setEditingNote(n);
    setEditContent(n.content || '');
    setEditIsPrivate(!!n.is_private);
  };

  const saveEdit = async () => {
    if (!editingNote || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('commercial_notes')
        .update({
          content: editContent.trim(),
          is_private: editIsPrivate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingNote.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['commercial-notes', trackingId] });
      toast.success('CR modifié');
      setEditingNote(null);
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la modification');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <section className="bg-white border border-neutral-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="display leading-none" style={{ fontSize: 18, fontWeight: 700, color: '#0f1422' }}>
            Comptes rendus
          </h3>
          <span className="text-neutral-500 whitespace-nowrap leading-none" style={{ fontSize: 12 }}>
            {visible.length} affiché{visible.length > 1 ? 's' : ''} · {filteredNotes.length}{filteredNotes.length !== notes.length ? ` / ${notes.length}` : ''} au total
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Filter */}
          <div className="inline-flex border border-neutral-200" role="group" aria-label="Filtrer par confidentialité">
            {([
              { value: 'all', label: 'Tous' },
              { value: 'public', label: 'Publics' },
              { value: 'private', label: 'Privés' },
            ] as const).map((opt) => {
              const active = privacyFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setPrivacyFilter(opt.value); setShowAll(false); }}
                  className={`leading-none transition-colors ${active ? 'text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
                  style={{
                    background: active ? '#0f1422' : 'transparent',
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setOpenAdd(true)}
            className="inline-flex items-center gap-1 font-semibold text-white shrink-0"
            style={{ background: '#0f1422', padding: '6px 12px', fontSize: 12 }}
          >
            <Plus size={12} /> Ajouter un CR
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="px-5 py-8 flex items-center justify-center text-neutral-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-neutral-500">
          {notes.length === 0
            ? 'Aucun compte rendu pour ce client.'
            : `Aucun compte rendu ${privacyFilter === 'private' ? 'privé' : 'public'} pour ce client.`}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {visible.map((n: any) => {
            const isOpen = !!expanded[n.id];
            const authorName = [n.author?.first_name, n.author?.last_name].filter(Boolean).join(' ') || 'Utilisateur';
            return (
              <li key={n.id} className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [n.id]: !s[n.id] }))}
                  className="w-full text-left flex items-start gap-3"
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, border: '1px solid #e5e5e5', fontSize: 16 }}
                  >
                    {TYPE_EMOJI(n.content || '')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" style={{ fontSize: 14, color: '#0f1422' }}>
                        {format(extractMeetingDate(n.content || '', n.created_at), 'd MMMM yyyy', { locale: fr })}
                      </p>
                      {n.is_private && (
                        <span
                          className="inline-flex items-center gap-1 text-neutral-600"
                          style={{ background: '#f3f4f6', padding: '2px 6px', fontSize: 10, fontWeight: 600 }}
                        >
                          <Lock size={10} /> Privé
                        </span>
                      )}
                    </div>
                    <p className="text-neutral-500" style={{ fontSize: 12 }}>{authorName}</p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-neutral-400 mt-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <div className="mt-3 pl-[44px]">
                  {isOpen ? (
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                        {n.content}
                      </p>
                      <button
                        type="button"
                        onClick={() => remove(n.id)}
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {preview(n.content || '', 180)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      {filteredNotes.length > 3 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full uppercase tracking-wider font-semibold text-neutral-600 hover:bg-neutral-50 border-t border-neutral-200 transition-colors"
          style={{ fontSize: 12, padding: '12px 0' }}
        >
          Voir les {filteredNotes.length - 3} autre{filteredNotes.length - 3 > 1 ? 's' : ''} compte{filteredNotes.length - 3 > 1 ? 's' : ''} rendu{filteredNotes.length - 3 > 1 ? 's' : ''}
        </button>
      )}
      {showAll && filteredNotes.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full uppercase tracking-wider font-semibold text-neutral-600 hover:bg-neutral-50 border-t border-neutral-200 transition-colors"
          style={{ fontSize: 12, padding: '12px 0' }}
        >
          Réduire
        </button>
      )}

      {/* Add modal */}
      <Dialog open={openAdd} onOpenChange={(o) => { setOpenAdd(o); if (!o) { setContent(''); setNewIsPrivate(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="display" style={{ fontWeight: 700 }}>Nouveau compte rendu</DialogTitle>
          </DialogHeader>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Décrivez l'échange, les points clés, les prochaines étapes…"
            rows={8}
            autoFocus
          />
          {/* Visibility selector */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-neutral-500 mr-1">Visibilité :</span>
            <div className="inline-flex border border-neutral-200" role="group" aria-label="Visibilité du compte rendu">
              {([
                { value: false, label: 'Public' },
                { value: true, label: 'Privé' },
              ] as const).map((opt) => {
                const active = newIsPrivate === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setNewIsPrivate(opt.value)}
                    className={`leading-none transition-colors ${active ? 'text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
                    style={{
                      background: active ? '#0f1422' : 'transparent',
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                    aria-pressed={active}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {newIsPrivate && (
              <span className="text-xs text-neutral-500">
                Visible uniquement par l'équipe interne.
              </span>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenAdd(false); setContent(''); setNewIsPrivate(false); }} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={!content.trim() || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
