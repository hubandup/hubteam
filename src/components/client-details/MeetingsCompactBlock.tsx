import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Plus, Pencil, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
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

export function MeetingsCompactBlock({ trackingId, client }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

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
    toast.success('Étape ajoutée');
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_meetings').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-meetings', trackingId] });
    if (editingId === id) setEditingId(null);
  };

  const exportICS = (m: any, displayLabel: string) => {
    if (!m.meeting_date) return toast.error('Définissez une date');
    const ics = generateICS(`${displayLabel} — ${client.company}`, m.meeting_date, `RDV avec ${client.first_name} ${client.last_name}`);
    downloadICS(`rdv-${client.company}-${displayLabel}.ics`, ics);
  };

  const editing: any = meetings.find((m: any) => m.id === editingId);

  // Build display labels (renumber RDVs sequentially)
  let rdvIdx = 0;
  const items: any[] = (meetings as any[]).map((m: any) => {
    const isRdv = m.meeting_type === 'rdv' || m.meeting_type === 'custom' || (typeof m.meeting_type === 'string' && m.meeting_type.startsWith('rdv'));
    if (isRdv) rdvIdx += 1;
    return {
      ...m,
      _displayLabel: isRdv ? `RDV ${rdvIdx}` : m.label,
      _isRdv: isRdv,
    };
  });

  return (
    <section className="bg-white border border-neutral-200">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: '#0f1422' }} />
          <h3
            className="uppercase tracking-wider font-bold display"
            style={{ color: '#0f1422', fontSize: 10 }}
          >
            Étapes de rendez-vous
          </h3>
        </div>
        <button
          type="button"
          onClick={addCustom}
          className="text-neutral-400 hover:text-neutral-900"
          aria-label="Ajouter une étape"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">Aucune étape configurée.</p>
        ) : items.map((m: any) => (
          <div key={m.id} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate" style={{ fontSize: 12, color: '#0f1422' }}>
                {m._displayLabel}
              </p>
              {m.meeting_date ? (
                <p className="text-neutral-500" style={{ fontSize: 10 }}>
                  {format(new Date(m.meeting_date), 'd MMM yyyy', { locale: fr })}
                </p>
              ) : (
                <p className="text-neutral-400 italic" style={{ fontSize: 10 }}>
                  Date à définir
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditingId(m.id)}
              className="p-1 text-neutral-400 hover:text-neutral-900"
              title="Modifier"
              aria-label="Modifier"
            >
              <Pencil size={12} />
            </button>
            {m.meeting_date && (
              <button
                type="button"
                onClick={() => exportICS(m, m._displayLabel)}
                className="p-1 text-neutral-400 hover:text-neutral-900"
                title="Télécharger .ics"
                aria-label="Télécharger .ics"
              >
                <Download size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Edit modal */}
      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="display" style={{ fontWeight: 700 }}>
              {editing?._displayLabel || items.find((i: any) => i.id === editingId)?._displayLabel || 'Étape'}
            </DialogTitle>
            <DialogDescription>
              Modifier la date et la source de cette étape.
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
            {editing?._isRdv && (
              <Button
                variant="ghost"
                onClick={() => remove(editing.id)}
                className="rounded-none text-red-600 hover:text-red-700 mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            )}
            <Button onClick={() => setEditingId(null)} className="rounded-none" style={{ background: '#0f1422', color: '#fff' }}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
