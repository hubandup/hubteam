import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { BookOpen } from 'lucide-react';

const LEVIERS = [
  { key: 'media', label: 'Media' },
  { key: 'influence', label: 'Influence' },
  { key: 'crm', label: 'CRM' },
  { key: 'contenus', label: 'Contenus' },
  { key: 'rp', label: 'RP' },
  { key: 'social_organic', label: 'Social (organic)' },
  { key: 'consumer_care', label: 'Consumer Care' },
];

interface LearningRow {
  id?: string;
  levier: string;
  works: string;
  does_not_work: string;
  updated_by?: string | null;
  updated_at?: string;
}

export function LagostinaLearnings() {
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const canEdit = role === 'admin' || role === 'team';
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const { data: learnings, isLoading } = useQuery({
    queryKey: ['lagostina-learnings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_learnings')
        .select('*')
        .order('levier');
      if (error) throw error;
      return data as LearningRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name');
      return data || [];
    },
  });

  const [localData, setLocalData] = useState<Record<string, { works: string; does_not_work: string }>>({});

  useEffect(() => {
    if (learnings) {
      const map: typeof localData = {};
      for (const l of learnings) {
        map[l.levier] = { works: l.works || '', does_not_work: l.does_not_work || '' };
      }
      setLocalData(map);
    }
  }, [learnings]);

  const saveMutation = useMutation({
    mutationFn: async ({ levier, works, does_not_work }: { levier: string; works: string; does_not_work: string }) => {
      const { data: user } = await supabase.auth.getUser();
      const existing = learnings?.find((l) => l.levier === levier);
      if (existing?.id) {
        const { error } = await supabase
          .from('lagostina_learnings')
          .update({ works, does_not_work, updated_by: user.user?.id || null, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lagostina_learnings')
          .insert({ levier, works, does_not_work, updated_by: user.user?.id || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lagostina-learnings'] });
      toast.success('Sauvegardé', { duration: 2000, position: 'bottom-right' });
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const handleChange = useCallback((levier: string, field: 'works' | 'does_not_work', value: string) => {
    setLocalData((prev) => {
      const curr = prev[levier] || { works: '', does_not_work: '' };
      return { ...prev, [levier]: { ...curr, [field]: value } };
    });

    const timerKey = `${levier}-${field}`;
    if (debounceTimers.current[timerKey]) clearTimeout(debounceTimers.current[timerKey]);
    debounceTimers.current[timerKey] = setTimeout(() => {
      const updated = { ...localData, [levier]: { ...localData[levier], [field]: value } };
      const row = updated[levier] || { works: '', does_not_work: '' };
      saveMutation.mutate({ levier, works: row.works, does_not_work: row.does_not_work });
    }, 500);
  }, [localData, saveMutation]);

  const getUpdatedInfo = (levier: string) => {
    const row = learnings?.find((l) => l.levier === levier);
    if (!row?.updated_at) return null;
    const profile = profiles?.find((p) => p.id === row.updated_by);
    const name = profile ? `${profile.first_name} ${profile.last_name}` : 'Inconnu';
    const date = new Date(row.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `Mis à jour le ${date} par ${name}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-20 bg-[#1a1f2e] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3 text-[#9ca3af] font-['Roboto'] font-medium text-xs uppercase w-[160px]">Levier</th>
              <th className="text-left px-4 py-3 text-[#22c55e] font-['Roboto'] font-medium text-xs uppercase">Ce qui fonctionne ✅</th>
              <th className="text-left px-4 py-3 text-[#ef4444] font-['Roboto'] font-medium text-xs uppercase">Ce qui ne fonctionne pas ❌</th>
            </tr>
          </thead>
          <tbody>
            {LEVIERS.map((l) => {
              const row = localData[l.key] || { works: '', does_not_work: '' };
              const info = getUpdatedInfo(l.key);
              return (
                <tr key={l.key} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white font-['Instrument_Sans'] font-bold text-sm align-top">{l.label}</td>
                  <td className="px-2 py-2">
                    <div className="bg-[#0a2e1a] p-2">
                      <textarea
                        value={row.works}
                        onChange={(e) => handleChange(l.key, 'works', e.target.value)}
                        readOnly={!canEdit}
                        className="w-full bg-transparent text-white font-['Roboto'] text-sm resize-none min-h-[60px] focus:outline-none placeholder:text-white/20"
                        placeholder={canEdit ? 'Ajouter…' : '—'}
                        rows={3}
                      />
                      {info && <p className="text-[#6b7280] text-[10px] font-['Roboto'] mt-1">{info}</p>}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="bg-[#2e0a0a] p-2">
                      <textarea
                        value={row.does_not_work}
                        onChange={(e) => handleChange(l.key, 'does_not_work', e.target.value)}
                        readOnly={!canEdit}
                        className="w-full bg-transparent text-white font-['Roboto'] text-sm resize-none min-h-[60px] focus:outline-none placeholder:text-white/20"
                        placeholder={canEdit ? 'Ajouter…' : '—'}
                        rows={3}
                      />
                      {info && <p className="text-[#6b7280] text-[10px] font-['Roboto'] mt-1">{info}</p>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!learnings?.length && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <BookOpen className="h-10 w-10 text-[#9ca3af]" />
          <p className="text-[#9ca3af] font-['Roboto'] text-sm">Aucun learning enregistré</p>
          {canEdit && <p className="text-[#6b7280] font-['Roboto'] text-xs">Cliquez sur les cellules pour ajouter vos premiers learnings</p>}
        </div>
      )}
    </div>
  );
}
