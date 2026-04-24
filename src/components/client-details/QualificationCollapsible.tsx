import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const DEFAULT_QUESTIONS = [
  { key: 'company_year', label: "Quand a été créée l'entreprise ?", type: 'year' },
  { key: 'time_in_role', label: 'Depuis combien de temps êtes-vous à ce poste ?', type: 'text' },
  { key: 'usual_agency', label: 'Avec quelle agence travaillez-vous habituellement ?', type: 'text' },
  { key: 'geo_zone', label: 'Sur quelle zone géographique travaillez-vous ?', type: 'multi', options: ['France', 'Europe (EAMA)', 'International'] },
  { key: 'team_composition', label: 'Comment est constituée votre équipe ?', type: 'textarea' },
  { key: 'revenue', label: "Quel est votre chiffre d'affaires ?", type: 'text' },
  { key: 'client_count', label: 'Le nombre de clients ?', type: 'text' },
  { key: 'targets', label: 'Quels sont vos cibles ?', type: 'text' },
  { key: 'goals', label: 'Quels sont vos objectifs ?', type: 'text' },
  { key: 'how_known', label: 'Comment nous avez-vous connus ?', type: 'text' },
];

interface Props {
  trackingId: string;
}

export function QualificationCollapsible({ trackingId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);

  const { data: questions = [], isLoading } = useQuery({
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

  const filledCount = useMemo(
    () => questions.filter((q: any) => (q.answer || '').toString().trim().length > 0).length,
    [questions],
  );

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
    <section className="bg-white border border-neutral-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="display leading-none" style={{ fontSize: 18, fontWeight: 700, color: '#0f1422' }}>
            Qualification du besoin
          </h3>
          <span className="text-neutral-500 whitespace-nowrap leading-none" style={{ fontSize: 12 }}>
            {filledCount}/{questions.length} renseigné{filledCount > 1 ? 's' : ''}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-neutral-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-neutral-200 px-5 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-neutral-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {questions.map((q: any) => (
                  <div key={q.id} className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        className="uppercase tracking-wider font-semibold text-neutral-500"
                        style={{ fontSize: 12 }}
                      >
                        {q.question_label}
                      </label>
                      {q.is_custom && (
                        <button
                          type="button"
                          onClick={() => remove(q.id)}
                          className="text-neutral-400 hover:text-red-600"
                          aria-label="Supprimer la question"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    {renderField(q)}
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-neutral-100 flex justify-end">
                <Button size="sm" variant="outline" onClick={addCustom}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter une question
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
