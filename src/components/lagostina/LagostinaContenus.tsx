import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CheckCircle2, XCircle, FileText, LayoutGrid, Lightbulb } from 'lucide-react';

const QUALITY_BADGES: Record<string, { label: string; color: string }> = {
  good: { label: 'Bon', color: 'bg-[#22c55e]/20 text-[#22c55e]' },
  needs_work: { label: 'À revoir', color: 'bg-[#E8FF4C]/20 text-[#E8FF4C]' },
  not_assessed: { label: 'Non évalué', color: 'bg-white/10 text-[#9ca3af]' },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  vol: 'VOL', bumpers: 'Bumpers', mix_social: 'Mix social', lp: 'Landing pages',
  pdp: 'PDP', kit_iab: 'Kit IAB', seo: 'SEO',
};

const SOCIAL_CATEGORY_LABELS: Record<string, string> = {
  branded: 'Branded', influence: 'Influence', ugc: 'UGC',
  pedagogique: 'Pédagogique', recette: 'Recette', saisonnier: 'Saisonnier',
};

export function LagostinaContenus() {
  const { data: contenus, isLoading: loadingContenus } = useQuery({
    queryKey: ['lagostina-contenus'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_contenus').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: socialMix, isLoading: loadingSocial } = useQuery({
    queryKey: ['lagostina-social-mix'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_social_mix').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: learnings, isLoading: loadingLearnings } = useQuery({
    queryKey: ['lagostina-content-learnings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_content_learnings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingContenus || loadingSocial || loadingLearnings;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-[#0f1422] animate-pulse" />)}
      </div>
    );
  }

  const hasContenus = (contenus || []).length > 0;
  const hasSocial = (socialMix || []).length > 0;
  const hasLearnings = (learnings || []).length > 0;

  return (
    <div className="space-y-6">
      {/* Scorecard contenus */}
      <div className="bg-[#0f1422] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-[#E8FF4C]" />
          <h3 className="text-white text-sm font-['Instrument_Sans'] font-bold">Scorecard contenus</h3>
        </div>
        {!hasContenus ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <Clock className="h-8 w-8 text-[#9ca3af]" />
            <p className="text-[#9ca3af] text-xs font-['Roboto']">Données non disponibles</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-['Roboto']">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-[#9ca3af] uppercase">Type</th>
                  <th className="text-center py-2 px-3 text-[#9ca3af] uppercase">Nombre</th>
                  <th className="text-center py-2 px-3 text-[#9ca3af] uppercase">Ready</th>
                  <th className="text-center py-2 px-3 text-[#9ca3af] uppercase">Qualité</th>
                  <th className="text-left py-2 px-3 text-[#9ca3af] uppercase">Déclinaisons</th>
                </tr>
              </thead>
              <tbody>
                {(contenus || []).map((c) => {
                  const qb = QUALITY_BADGES[c.quality_assessment || 'not_assessed'] || QUALITY_BADGES.not_assessed;
                  return (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 text-white">{CONTENT_TYPE_LABELS[c.content_type] || c.content_type}</td>
                      <td className="py-2.5 px-3 text-center text-white font-bold">{c.count}</td>
                      <td className="py-2.5 px-3 text-center">
                        {c.ready
                          ? <CheckCircle2 className="h-4 w-4 text-[#22c55e] inline" />
                          : <XCircle className="h-4 w-4 text-[#ef4444] inline" />}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 text-[10px] ${qb.color}`}>{qb.label}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[#9ca3af]">{c.variations || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mix social + Top performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0f1422] p-5">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="h-4 w-4 text-[#E8FF4C]" />
            <h3 className="text-white text-sm font-['Instrument_Sans'] font-bold">Mix social</h3>
          </div>
          {!hasSocial ? (
            <div className="text-[#9ca3af] text-xs font-['Roboto'] py-8 text-center">Données non disponibles</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(socialMix || []).map((s) => (
                <div key={s.id} className="bg-[#0a0e1a] p-4 flex flex-col items-center gap-1">
                  <span className="text-white text-2xl font-bold font-['Instrument_Sans']">{s.count}</span>
                  <span className="text-[#9ca3af] text-[10px] font-['Roboto'] uppercase tracking-wider">
                    {SOCIAL_CATEGORY_LABELS[s.category] || s.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0f1422] p-5">
          <h3 className="text-white text-sm font-['Instrument_Sans'] font-bold mb-4">Top performers social</h3>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1a1f2e]">
                <div className="aspect-square bg-[#0a0e1a] flex items-center justify-center">
                  <span className="text-[#9ca3af] text-xs font-['Roboto']">#{i}</span>
                </div>
                <div className="p-2">
                  <div className="text-[#9ca3af] text-[10px] font-['Roboto']">Données non disponibles</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Learnings */}
      <div className="bg-[#0f1422] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-[#E8FF4C]" />
          <h3 className="text-white text-sm font-['Instrument_Sans'] font-bold">Learnings contenus</h3>
        </div>
        {!hasLearnings ? (
          <div className="text-[#9ca3af] text-xs font-['Roboto'] py-8 text-center">Aucun learning enregistré</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-['Roboto']">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-[#9ca3af] uppercase">Learning</th>
                  <th className="text-left py-2 px-3 text-[#9ca3af] uppercase">Chiffre associé</th>
                  <th className="text-left py-2 px-3 text-[#9ca3af] uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {(learnings || []).map((l) => (
                  <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 text-white">{l.learning}</td>
                    <td className="py-2.5 px-3 text-[#E8FF4C] font-bold">{l.associated_metric || '—'}</td>
                    <td className="py-2.5 px-3 text-[#9ca3af]">{l.action || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
