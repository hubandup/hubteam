import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Plus, Edit, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  trackingId: string;
  client: any;
}

const SOURCE_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'event', label: 'Salon / Event' },
  { value: 'network', label: 'Réseau' },
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

async function notifyTeam(params: any) {
  return supabase.functions.invoke('notify-target-relance', { body: params });
}

const STRUCTURAL: Array<{ type: string; label: string; order: number }> = [
  { type: 'first_contact', label: '1er contact', order: 0 },
  { type: 'hub_date', label: 'Hub Date', order: 1 },
];

function isOptionalRdv(m: any): boolean {
  const t = m.meeting_type;
  return t !== 'first_contact' && t !== 'hub_date';
}

export function MeetingsCompactBlock({ trackingId, client }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: meetings = [], isLoading } = useQuery({
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

  // Ensure structural rows exist
  const ensureStructural = async () => {
    const missing = STRUCTURAL.filter(
      (s) => !meetings.find((m: any) => m.meeting_type === s.type)
    );
    if (missing.length === 0) return;
    await supabase.from('commercial_meetings').insert(
      missing.map((s) => ({
        tracking_id: trackingId,
        meeting_type: s.type,
        label: s.label,
        display_order: s.order,
      }))
    );
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
  };

  // Auto-create structural on mount if missing
  if (!isLoading && meetings.length >= 0) {
    const hasFirst = meetings.find((m: any) => m.meeting_type === 'first_contact');
    const hasHub = meetings.find((m: any) => m.meeting_type === 'hub_date');
    if (!hasFirst || !hasHub) {
      ensureStructural();
    }
  }

  const update = async (id: string, patch: any) => {
    const before = meetings.find((m: any) => m.id === id);
    await supabase.from('commercial_meetings').update(patch).eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
    if (patch.meeting_date && patch.meeting_date !== before?.meeting_date) {
      const label = before?.label || 'RDV';
      notifyTeam({
        client_id: client.id,
        tracking_id: trackingId,
        company: client.company,
        contact_name: `${client.first_name} ${client.last_name}`,
        event_type: 'meeting_scheduled',
        details: { meeting_label: label, meeting_date: patch.meeting_date },
      }).catch((e) => console.error('notify meeting_scheduled failed', e));
    }
  };

  const optionalRdvs = meetings.filter(isOptionalRdv);

  const addCustom = async () => {
    // Find next number based on existing labels "RDV N"
    const usedNums = optionalRdvs
      .map((m: any) => {
        const match = (m.label || '').match(/^RDV\s+(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n: number) => n > 0);
    const nextNum = usedNums.length ? Math.max(...usedNums) + 1 : 1;
    await supabase.from('commercial_meetings').insert({
      tracking_id: trackingId,
      meeting_type: 'rdv',
      label: `RDV ${nextNum}`,
      display_order: 10 + nextNum,
    });
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
    toast.success(`RDV ${nextNum} ajouté`);
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_meetings').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
    if (editingId === id) setEditingId(null);
    setConfirmDeleteId(null);
    toast.success('RDV supprimé');
  };

  const exportICS = (m: any, displayLabel: string) => {
    if (!m.meeting_date) return toast.error('Définissez une date');
    const ics = generateICS(`${displayLabel} — ${client.company}`, m.meeting_date, `RDV avec ${client.first_name} ${client.last_name}`);
    downloadICS(`rdv-${client.company}-${displayLabel}.ics`, ics);
  };

  // Build ordered display list: 1er contact, Hub Date, then optional RDVs in creation order
  const firstContact = meetings.find((m: any) => m.meeting_type === 'first_contact');
  const hubDate = meetings.find((m: any) => m.meeting_type === 'hub_date');
  const optionalsSorted = [...optionalRdvs].sort((a: any, b: any) => {
    const an = parseInt((a.label || '').replace(/\D/g, ''), 10) || 0;
    const bn = parseInt((b.label || '').replace(/\D/g, ''), 10) || 0;
    return an - bn;
  });

  const items: any[] = [
    firstContact && { ...firstContact, _displayLabel: '1er contact', _isOptional: false },
    hubDate && { ...hubDate, _displayLabel: 'Hub Date', _isOptional: false },
    ...optionalsSorted.map((m: any) => ({
      ...m,
      _displayLabel: m.label || 'RDV',
      _isOptional: true,
    })),
  ].filter(Boolean);

  const editing: any = items.find((m: any) => m.id === editingId);
  const toDelete: any = items.find((m: any) => m.id === confirmDeleteId);

  return (
    <section className="bg-white border border-neutral-200">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2 leading-none">
          <span className="flex items-center justify-center shrink-0">
            <Calendar size={14} style={{ color: '#0f1422' }} />
          </span>
          <h3
            className="uppercase tracking-wider font-bold display leading-none"
            style={{ color: '#0f1422', fontSize: 10 }}
          >
            Étapes de rendez-vous
          </h3>
        </div>
        <button
          type="button"
          onClick={addCustom}
          className="text-neutral-400 hover:text-neutral-900"
          aria-label="Ajouter un RDV"
          title="Ajouter un RDV"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-1">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">Initialisation…</p>
        ) : items.map((m: any) => {
          const hasDate = !!m.meeting_date;
          return (
            <div key={m.id} className="flex items-center gap-2 text-xs py-1">
              <span className="font-semibold text-neutral-900 shrink-0">
                {m._displayLabel}
              </span>
              <span
                className={`truncate flex-1 ${hasDate ? 'text-neutral-600' : 'text-neutral-400 italic'}`}
              >
                {hasDate
                  ? format(new Date(m.meeting_date), 'd MMM yyyy', { locale: fr })
                  : 'Date à définir'}
              </span>
              <button
                type="button"
                onClick={() => setEditingId(m.id)}
                className="shrink-0 text-neutral-400 hover:text-neutral-900"
                title="Modifier"
                aria-label="Modifier"
              >
                <Edit size={12} />
              </button>
              {hasDate && (
                <button
                  type="button"
                  onClick={() => exportICS(m, m._displayLabel)}
                  className="shrink-0 text-neutral-400 hover:text-neutral-900"
                  title="Télécharger .ics"
                  aria-label="Télécharger .ics"
                >
                  <Download size={12} />
                </button>
              )}
              {m._isOptional && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(m.id)}
                  className="shrink-0 text-neutral-400 hover:text-red-500"
                  title="Supprimer"
                  aria-label="Supprimer"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="display" style={{ fontWeight: 700 }}>
              {editing?._displayLabel || 'Étape'}
            </DialogTitle>
            <DialogDescription>
              Modifier la date{editing?.meeting_type === 'first_contact' ? ' et la source' : ''} de cette étape.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Date du rendez-vous</Label>
                <Input
                  type="datetime-local"
                  defaultValue={editing.meeting_date ? new Date(editing.meeting_date).toISOString().slice(0, 16) : ''}
                  onChange={(e) =>
                    update(editing.id, { meeting_date: e.target.value ? new Date(e.target.value).toISOString() : null })
                  }
                  className="mt-1 rounded-none"
                />
              </div>

              {editing.meeting_type === 'first_contact' && (
                <div>
                  <Label className="text-xs">Source</Label>
                  <Select
                    value={editing.source_type || ''}
                    onValueChange={(v) => update(editing.id, { source_type: v })}
                  >
                    <SelectTrigger className="mt-1 rounded-none">
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
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setEditingId(null)} className="rounded-none" style={{ background: '#0f1422', color: '#fff' }}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {toDelete?._displayLabel} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le RDV et sa date seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && remove(confirmDeleteId)}
              className="rounded-none bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
