import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Star, MessageSquare, Users, ShoppingCart, ChefHat, Eye } from 'lucide-react';

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground text-xs font-['Roboto']">{label}</span>
      <div className="text-right">
        <span className="text-foreground text-sm font-['Instrument_Sans'] font-bold">{value}</span>
        {sub && <span className="text-muted-foreground text-[10px] font-['Roboto'] ml-2">{sub}</span>}
      </div>
    </div>
  );
}

function Stars({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-3 w-3 ${s <= Math.round(score) ? 'text-black font-semibold fill-[#E8FF4C]' : 'text-muted-foreground'}`} />
      ))}
    </span>
  );
}

export function LagostinaConsumer() {
  const [platformFilter, setPlatformFilter] = useState('all');
  const [rnrPage, setRnrPage] = useState(0);

  const { data: consumerData, isLoading: loadingConsumer } = useQuery({
    queryKey: ['lagostina-consumer'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_consumer').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: rnrData, isLoading: loadingRnr } = useQuery({
    queryKey: ['lagostina-rnr'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_rnr').select('*').order('week', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingConsumer || loadingRnr;
  const hasConsumer = (consumerData || []).length > 0;
  const hasRnr = (rnrData || []).length > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-white border border-border/30 animate-pulse" />)}
      </div>
    );
  }

  const getMetrics = (section: string) => (consumerData || []).filter((d) => d.section === section);
  const sampleMetrics = getMetrics('sample');
  const valueMetrics = getMetrics('value');
  const cuisineMetrics = getMetrics('cuisine');
  const brandMetrics = getMetrics('brand_monitoring');

  const platforms = [...new Set((rnrData || []).map((r) => r.platform))];
  const filteredRnr = platformFilter === 'all' ? (rnrData || []) : (rnrData || []).filter((r) => r.platform === platformFilter);
  const pageSize = 20;
  const pagedRnr = filteredRnr.slice(rnrPage * pageSize, (rnrPage + 1) * pageSize);
  const totalPages = Math.ceil(filteredRnr.length / pageSize);

  return (
    <div className="space-y-6">
      {/* Consumer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard title="Échantillon & Démographie" icon={<Users className="h-4 w-4 text-black font-semibold" />}>
          {sampleMetrics.length > 0 ? (
            sampleMetrics.map((m) => (
              <MetricRow key={m.id} label={m.metric_name} value={m.value_current || '—'} sub={m.vs_reference || undefined} />
            ))
          ) : (
            <div className="text-muted-foreground text-xs font-['Roboto'] py-4 text-center">Données non disponibles</div>
          )}
        </SectionCard>

        <SectionCard title="Valeur" icon={<ShoppingCart className="h-4 w-4 text-black font-semibold" />}>
          {valueMetrics.length > 0 ? (
            valueMetrics.map((m) => (
              <MetricRow key={m.id} label={m.metric_name} value={m.value_current || '—'} sub={m.vs_reference || undefined} />
            ))
          ) : (
            <div className="text-muted-foreground text-xs font-['Roboto'] py-4 text-center">Données non disponibles</div>
          )}
        </SectionCard>

        <SectionCard title="Rapport à la cuisine" icon={<ChefHat className="h-4 w-4 text-black font-semibold" />}>
          {cuisineMetrics.length > 0 ? (
            <>
              {cuisineMetrics.map((m) => (
                <MetricRow key={m.id} label={m.metric_name} value={m.value_current || '—'} />
              ))}
              {cuisineMetrics.filter((m) => m.comment).length > 0 && (
                <div className="mt-3 bg-white p-3 max-h-24 overflow-y-auto">
                  <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">Verbatims</p>
                  {cuisineMetrics.filter((m) => m.comment).map((m) => (
                    <p key={m.id} className="text-foreground text-xs font-['Roboto'] italic">"{m.comment}"</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-xs font-['Roboto'] py-4 text-center">Données non disponibles</div>
          )}
        </SectionCard>
      </div>

      {/* Brand Monitoring */}
      <div className="bg-white border border-border/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-black font-semibold" />
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">Brand Monitoring</h3>
        </div>
        {brandMetrics.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {brandMetrics.map((m) => (
              <div key={m.id} className="bg-white p-3 border-l-[3px] border-black">
                <div className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider">{m.metric_name}</div>
                <div className="text-foreground text-lg font-bold font-['Instrument_Sans'] mt-1">{m.value_current || '—'}</div>
                {m.vs_brand && <div className="text-muted-foreground text-[10px] font-['Roboto']">vs. {m.vs_brand}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 gap-2">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground text-xs font-['Roboto']">En attente d'intégration Talkwalker</p>
          </div>
        )}
      </div>

      {/* R&R */}
      <div className="bg-white border border-border/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-black font-semibold" />
            <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">Ratings & Reviews</h3>
          </div>
          {platforms.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() => { setPlatformFilter('all'); setRnrPage(0); }}
                className={`px-3 py-1 text-xs font-['Roboto'] ${platformFilter === 'all' ? 'bg-black text-black' : 'bg-gray-100 text-muted-foreground hover:text-foreground'}`}
              >
                Tout
              </button>
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPlatformFilter(p); setRnrPage(0); }}
                  className={`px-3 py-1 text-xs font-['Roboto'] capitalize ${platformFilter === p ? 'bg-black text-black' : 'bg-gray-100 text-muted-foreground hover:text-foreground'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        {!hasRnr ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground text-xs font-['Roboto']">Données non disponibles</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-['Roboto']">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 px-2 text-muted-foreground uppercase">Plateforme</th>
                    <th className="text-left py-2 px-2 text-muted-foreground uppercase">Produit</th>
                    <th className="text-left py-2 px-2 text-muted-foreground uppercase">Semaine</th>
                    <th className="text-center py-2 px-2 text-muted-foreground uppercase">Score</th>
                    <th className="text-center py-2 px-2 text-muted-foreground uppercase">Reviews</th>
                    <th className="text-left py-2 px-2 text-muted-foreground uppercase">Commentaires</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRnr.map((r) => (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-gray-50">
                      <td className="py-2 px-2 text-foreground capitalize">{r.platform}</td>
                      <td className="py-2 px-2 text-foreground">{r.product_name}</td>
                      <td className="py-2 px-2 text-muted-foreground">{r.week}</td>
                      <td className="py-2 px-2 text-center">
                        {r.avg_score != null ? <Stars score={Number(r.avg_score)} /> : '—'}
                      </td>
                      <td className="py-2 px-2 text-center text-foreground">{r.review_count ?? '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground max-w-[200px] truncate">{r.comments_summary || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRnrPage(i)}
                    className={`w-7 h-7 text-xs font-['Roboto'] ${rnrPage === i ? 'bg-black text-black' : 'bg-gray-100 text-muted-foreground hover:text-foreground'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
