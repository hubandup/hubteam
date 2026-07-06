import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Plus, Loader2, Trash2, Lock, Pencil, FolderKanban, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createSafeHtml } from '@/lib/sanitize';
import { buildEmbeddedProjectPath } from '@/lib/project-nav';

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
      if (ids.length === 0) return (data || []).map((n: any) => ({ ...n, source: 'commercial' }));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', ids);
      return (data || []).map((n: any) => ({
        ...n,
        source: 'commercial',
        author: profiles?.find((p: any) => p.id === n.author_id),
      }));
    },
  });

  // Project notes attached to any project of this client
  const { data: projectNotes = [] } = useQuery({
    queryKey: ['client-project-notes', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data: links } = await supabase
        .from('project_clients')
        .select('project_id')
        .eq('client_id', client.id);
      const projectIds = (links || []).map((l: any) => l.project_id);
      if (projectIds.length === 0) return [];
      const { data: pNotes, error } = await supabase
        .from('project_notes')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!pNotes || pNotes.length === 0) return [];
      const authorIds = Array.from(new Set(pNotes.map((n: any) => n.created_by).filter(Boolean)));
      const { data: profiles } = authorIds.length
        ? await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', authorIds)
        : { data: [] as any[] };
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);
      return pNotes.map((n: any) => ({
        ...n,
        source: 'project',
        author_id: n.created_by,
        author: profiles?.find((p: any) => p.id === n.created_by),
        project: projects?.find((p: any) => p.id === n.project_id),
      }));
    },
  });

  const allNotes = useMemo(() => {
    return [...notes, ...projectNotes].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [notes, projectNotes]);

  const filteredNotes = useMemo(() => {
    if (privacyFilter === 'public') return allNotes.filter((n: any) => !n.is_private);
    if (privacyFilter === 'private') return allNotes.filter((n: any) => n.is_private);
    return allNotes;
  }, [allNotes, privacyFilter]);


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
    <section className="bg-card border border-border overflow-hidden" style={{ borderRadius: 18 }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="display leading-none" style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--brand-ink))' }}>
            Comptes rendus
          </h3>
          <span className="text-muted-foreground whitespace-nowrap leading-none" style={{ fontSize: 12 }}>
            {visible.length} affiché{visible.length > 1 ? 's' : ''} · {filteredNotes.length}{filteredNotes.length !== notes.length ? ` / ${notes.length}` : ''} au total
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Filter — segmented pill */}
          <div
            className="inline-flex items-center gap-1 p-1"
            role="group"
            aria-label="Filtrer par confidentialité"
            style={{ background: 'hsl(var(--muted))', borderRadius: 999 }}
          >
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
                  className="leading-none transition-all"
                  style={{
                    background: active ? 'hsl(var(--card))' : 'transparent',
                    color: active ? 'hsl(var(--brand-ink))' : 'hsl(var(--muted-foreground))',
                    border: active ? '1px solid hsl(var(--brand-ink))' : '1px solid transparent',
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 999,
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
            className="inline-flex items-center gap-1.5 font-semibold shrink-0 transition-opacity hover:opacity-90"
            style={{
              background: 'hsl(var(--brand-ink))',
              color: 'hsl(var(--card))',
              padding: '8px 16px',
              fontSize: 12.5,
              borderRadius: 999,
            }}
          >
            <Plus size={14} style={{ color: 'hsl(var(--brand-yellow))' }} strokeWidth={2.5} />
            Ajouter un CR
          </button>
        </div>

      </div>

      {/* List */}
      {isLoading ? (
        <div className="px-5 py-8 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          {notes.length === 0
            ? 'Aucun compte rendu pour ce client.'
            : `Aucun compte rendu ${privacyFilter === 'private' ? 'privé' : 'public'} pour ce client.`}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {visible.map((n: any) => {
            const isOpen = !!expanded[n.id];
            const authorName = [n.author?.first_name, n.author?.last_name].filter(Boolean).join(' ') || 'Utilisateur';
            const isProject = n.source === 'project';
            const plainContent = isProject
              ? (n.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
              : (n.content || '');
            return (
              <li key={`${n.source}-${n.id}`} className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [n.id]: !s[n.id] }))}
                  className="w-full text-left flex items-start gap-3"
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, border: '1px solid #e5e5e5', fontSize: 16 }}
                  >
                    {isProject ? <FolderKanban size={14} /> : TYPE_EMOJI(plainContent)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" style={{ fontSize: 14, color: 'hsl(var(--brand-ink))' }}>
                        {format(extractMeetingDate(plainContent, n.created_at), 'd MMMM yyyy', { locale: fr })}
                      </p>
                      {n.is_private && (
                        <span
                          className="inline-flex items-center gap-1 text-foreground"
                          style={{ background: '#f3f4f6', padding: '2px 6px', fontSize: 10, fontWeight: 600 }}
                        >
                          <Lock size={10} /> Privé
                        </span>
                      )}
                      {isProject && (
                        <span
                          className="inline-flex items-center gap-1 text-foreground"
                          style={{ background: 'hsl(var(--brand-yellow))', padding: '2px 6px', fontSize: 10, fontWeight: 600 }}
                        >
                          <FolderKanban size={10} /> Projet
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                      {authorName}
                      {isProject && n.project?.name ? ` · ${n.project.name}` : ''}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground mt-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <div className="mt-3 pl-[44px]">
                  {isOpen ? (
                    <div className="space-y-2">
                      {isProject ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground leading-relaxed"
                          dangerouslySetInnerHTML={createSafeHtml(n.content || '')}
                        />
                      ) : (
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {n.content}
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        {isProject ? (
                          n.project?.id && (
                            <Link
                              to={buildEmbeddedProjectPath(client.id, n.project.id, 'notes')}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink size={12} /> Ouvrir dans le projet
                            </Link>
                          )
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(n)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Pencil size={12} /> Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(n.id)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 size={12} /> Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">
                      {preview(plainContent, 180)}
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
          className="w-full uppercase tracking-wider font-semibold text-foreground hover:bg-muted border-t border-border transition-colors"
          style={{ fontSize: 12, padding: '12px 0' }}
        >
          Voir les {filteredNotes.length - 3} autre{filteredNotes.length - 3 > 1 ? 's' : ''} compte{filteredNotes.length - 3 > 1 ? 's' : ''} rendu{filteredNotes.length - 3 > 1 ? 's' : ''}
        </button>
      )}
      {showAll && filteredNotes.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full uppercase tracking-wider font-semibold text-foreground hover:bg-muted border-t border-border transition-colors"
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
            <span className="text-xs text-muted-foreground mr-1">Visibilité :</span>
            <div className="inline-flex border border-border" role="group" aria-label="Visibilité du compte rendu">
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
                    className={`leading-none transition-colors ${active ? 'text-background' : 'text-foreground hover:bg-muted'}`}
                    style={{
                      background: active ? 'hsl(var(--brand-ink))' : 'transparent',
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
              <span className="text-xs text-muted-foreground">
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

      {/* Edit modal */}
      <Dialog open={!!editingNote} onOpenChange={(o) => { if (!o) setEditingNote(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="display" style={{ fontWeight: 700 }}>Modifier le compte rendu</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Décrivez l'échange, les points clés, les prochaines étapes…"
            rows={8}
            autoFocus
          />
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground mr-1">Visibilité :</span>
            <div className="inline-flex border border-border" role="group" aria-label="Visibilité du compte rendu">
              {([
                { value: false, label: 'Public' },
                { value: true, label: 'Privé' },
              ] as const).map((opt) => {
                const active = editIsPrivate === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setEditIsPrivate(opt.value)}
                    className={`leading-none transition-colors ${active ? 'text-background' : 'text-foreground hover:bg-muted'}`}
                    style={{
                      background: active ? 'hsl(var(--brand-ink))' : 'transparent',
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingNote(null)} disabled={savingEdit}>
              Annuler
            </Button>
            <Button onClick={saveEdit} disabled={!editContent.trim() || savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Pencil className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
