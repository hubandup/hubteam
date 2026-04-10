import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, Users, Package, Store, TrendingUp, TrendingDown } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';
import { LagostinaSubTabs } from './LagostinaSubTabs';
import elenaMarcoImg from '@/assets/personas/elena-marco.jpg';
import sophieImg from '@/assets/personas/sophie.jpg';
import thomasImg from '@/assets/personas/thomas.jpg';

const PERSONA_PHOTOS: Record<string, string> = {
  'Elena & Marco': elenaMarcoImg,
  'Sophie': sophieImg,
  'Thomas': thomasImg,
};

const MEDIA_ICONS: Record<string, { icon: string; color: string }> = {
  'instagram': { icon: '📸', color: '#E1306C' },
  'ytb': { icon: '▶️', color: '#FF0000' },
  'youtube': { icon: '▶️', color: '#FF0000' },
  'tiktok': { icon: '🎵', color: '#000000' },
  'pinterest': { icon: '📌', color: '#E60023' },
  'blogs cuisine': { icon: '📝', color: '#6b7280' },
  'ytb shorts': { icon: '▶️', color: '#FF0000' },
};

function MediaBadges({ mediaStr }: { mediaStr: string }) {
  const parts = mediaStr.split('/').map(s => s.trim().toLowerCase());
  return (
    <div className="flex gap-1.5 flex-wrap">
      {parts.map((m) => {
        const info = MEDIA_ICONS[m] || { icon: '📡', color: '#6b7280' };
        return (
          <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 bg-black/5 dark:bg-white/10 text-xs font-['Roboto']">
            <span>{info.icon}</span>
            <span className="text-foreground capitalize">{m}</span>
          </span>
        );
      })}
    </div>
  );
}

type Persona = {
  id: string;
  priority: string;
  persona_name: string;
  persona_type: string | null;
  age_range: string | null;
  has_children: string | null;
  market_weight: string | null;
  motivators: Json;
  barriers: Json;
  preferred_media: string | null;
};

type Activation = {
  id: string;
  priority: string;
  section: string;
  data: Json;
};

type CategoryStatus = {
  priority: string;
  priority_label: string;
  axis: string;
  status: string;
};

const AXES = [
  { key: 'enjeux_business', label: 'Enjeux business' },
  { key: 'supply', label: 'Supply' },
  { key: 'flagship', label: 'Flagship' },
  { key: 'personas', label: 'Personas' },
  { key: 'contenus', label: 'Contenus' },
  { key: 'strategie_media', label: 'Stratégie Média' },
  { key: 'equipe_360', label: 'Équipe 360°' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ok: { bg: 'bg-[#22c55e]/20', text: 'text-[#22c55e]' },
  alert: { bg: 'bg-black/20 dark:bg-white/20', text: 'text-black dark:text-white font-semibold' },
  blocked: { bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]' },
};

function jsonToArray(val: Json): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

function jsonToRecord(val: Json): Record<string, any> {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, any>;
  return {};
}

const SUB_TABS = [
  { id: 'personas', label: 'Personas' },
  { id: 'produit', label: 'Produit & Distribution' },
  { id: 'sell', label: 'Sell-in / Sell-out' },
];

export function ActivationPersonas() {
  const [selectedPriority, setSelectedPriority] = useState<string>('prio_1');

  const { data: personas, isLoading: loadingPersonas } = useQuery({
    queryKey: ['lagostina-personas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_personas').select('*');
      if (error) throw error;
      return data as Persona[];
    },
  });

  const { data: activations, isLoading: loadingActivation } = useQuery({
    queryKey: ['lagostina-activation'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_activation').select('*');
      if (error) throw error;
      return data as Activation[];
    },
  });

  const { data: categoryStatus } = useQuery({
    queryKey: ['lagostina-category-status'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_category_status').select('*').order('priority');
      if (error) throw error;
      return data as CategoryStatus[];
    },
  });

  const priorities = useMemo(() => {
    const set = new Set<string>();
    personas?.forEach((p) => set.add(p.priority));
    activations?.forEach((a) => set.add(a.priority));
    categoryStatus?.forEach((c) => set.add(c.priority));
    return [...set].sort();
  }, [personas, activations, categoryStatus]);

  const filteredPersonas = personas?.filter((p) => p.priority === selectedPriority) || [];
  const filteredActivations = activations?.filter((a) => a.priority === selectedPriority) || [];
  const filteredStatus = categoryStatus?.filter((c) => c.priority === selectedPriority) || [];

  const getActivation = (section: string) => filteredActivations.find((a) => a.section === section);

  const isLoading = loadingPersonas || loadingActivation;
  const isEmpty = !personas?.length && !activations?.length;

  if (isEmpty && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-muted-foreground" />
        <p className="text-foreground font-['Instrument_Sans'] text-lg font-bold">Données Activation non disponibles</p>
        <p className="text-muted-foreground font-['Roboto'] text-sm">Importez un fichier Activation depuis l'admin</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Priority selector */}
      <div className="flex items-center gap-2">
        {priorities.length > 0 ? priorities.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPriority(p)}
            className={`px-4 py-2 text-sm font-['Roboto'] transition-colors ${
              selectedPriority === p
                ? 'bg-black text-white dark:bg-[#E8FF4C] dark:text-black font-medium'
                : 'bg-white dark:bg-[#0f1422] border border-border/30 text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.replace('_', ' ').toUpperCase()}
          </button>
        )) : (
          <div className="flex gap-2">
            {['prio_1', 'prio_2', 'prio_3'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPriority(p)}
                className={`px-4 py-2 text-sm font-['Roboto'] transition-colors ${
                  selectedPriority === p
                    ? 'bg-black text-white dark:bg-[#E8FF4C] dark:text-black font-medium'
                    : 'bg-white dark:bg-[#0f1422] border border-border/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      {filteredStatus.length > 0 && (
        <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
          <table className="w-full text-xs font-['Roboto']">
            <thead>
              <tr className="border-b border-border/40">
                {AXES.map((axis) => (
                  <th key={axis.key} className="text-center px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider">
                    {axis.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {AXES.map((axis) => {
                  const item = filteredStatus.find((s) => s.axis === axis.key);
                  if (!item) return <td key={axis.key} className="text-center px-3 py-2 text-muted-foreground/40">—</td>;
                  const style = STATUS_STYLES[item.status] || { bg: 'bg-gray-200', text: 'text-muted-foreground' };
                  const label = item.status === 'ok' ? 'OK' : item.status === 'alert' ? 'Alerte' : item.status === 'blocked' ? 'Bloqué' : item.status;
                  return (
                    <td key={axis.key} className="text-center px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>{label}</span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <LagostinaSubTabs tabs={SUB_TABS}>
        {(activeTab) => (
          <>
            {activeTab === 'personas' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-black dark:text-white font-semibold" />
                  <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold uppercase tracking-wider">Personas</h3>
                </div>
                {filteredPersonas.length === 0 ? (
                  <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-6 text-center text-muted-foreground font-['Roboto'] text-sm">
                    Aucun persona défini pour cette priorité
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPersonas.map((persona) => (
                      <div key={persona.id} className="bg-gray-50 dark:bg-[#141928] border-t-[3px] border-black dark:border-white">
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-foreground font-['Instrument_Sans'] font-bold text-lg">{persona.persona_name}</h4>
                              <p className="text-muted-foreground font-['Roboto'] text-xs">
                                {[persona.persona_type, persona.age_range, persona.has_children].filter(Boolean).join(' • ')}
                              </p>
                            </div>
                            {persona.market_weight && (
                              <span className="bg-black text-white dark:bg-[#E8FF4C] dark:text-black px-2 py-0.5 text-xs font-['Roboto'] font-bold">
                                {persona.market_weight}
                              </span>
                            )}
                          </div>

                          {jsonToArray(persona.motivators).length > 0 && (
                            <div>
                              <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">Motivations</p>
                              <ol className="space-y-0.5">
                                {jsonToArray(persona.motivators).map((m, i) => (
                                  <li key={i} className="text-foreground text-xs font-['Roboto'] flex gap-1.5">
                                    <span className="text-black dark:text-white font-semibold font-bold">{i + 1}.</span> {m}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {jsonToArray(persona.barriers).length > 0 && (
                            <div>
                              <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">Freins</p>
                              <ol className="space-y-0.5">
                                {jsonToArray(persona.barriers).map((b, i) => (
                                  <li key={i} className="text-[#fca5a5] text-xs font-['Roboto'] flex gap-1.5">
                                    <span className="font-bold">{i + 1}.</span> {b}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {persona.preferred_media && (
                            <p className="text-muted-foreground text-xs font-['Roboto'] italic border-t border-border/20 pt-2">
                              Média préféré : {persona.preferred_media}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'produit' && (
              <div className="space-y-6">
                {/* Product section */}
                {(() => {
                  const productData = getActivation('product');
                  if (!productData) return <div className="text-muted-foreground text-xs font-['Roboto'] py-8 text-center">Aucune donnée produit</div>;
                  const d = jsonToRecord(productData.data);
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-black dark:text-white font-semibold" />
                        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold uppercase tracking-wider">Produit</h3>
                      </div>
                      <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
                        <div className="grid grid-cols-2 gap-4">
                          {d.flagship && (
                            <div className="col-span-2">
                              <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">Flagship</p>
                              <p className="text-foreground text-sm font-['Roboto']">{String(d.flagship)}</p>
                            </div>
                          )}
                          {d.benefit_1 && (
                            <div>
                              <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">Key Consumer Benefit 1</p>
                              <p className="text-foreground text-sm font-['Roboto']">{String(d.benefit_1)}</p>
                            </div>
                          )}
                          {d.benefit_2 && (
                            <div>
                              <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">Key Consumer Benefit 2</p>
                              <p className="text-foreground text-sm font-['Roboto']">{String(d.benefit_2)}</p>
                            </div>
                          )}
                          {d.rtb && (
                            <div>
                              <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">RTB</p>
                              <p className="text-foreground text-sm font-['Roboto']">{String(d.rtb)}</p>
                            </div>
                          )}
                          {d.claims && (
                            <div>
                              <p className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider mb-1">Claims</p>
                              <p className="text-foreground text-sm font-['Roboto']">{String(d.claims)}</p>
                            </div>
                          )}
                        </div>
                        {(d.marge_std || d.prix_conso) && (
                          <div className="flex gap-3 mt-4 pt-3 border-t border-border/40">
                            {d.marge_std && (
                              <span className="bg-black/20 dark:bg-white/20 text-black dark:text-white font-semibold px-3 py-1 text-xs font-['Roboto'] font-medium">
                                Marge std: {String(d.marge_std)}
                              </span>
                            )}
                            {d.prix_conso && (
                              <span className="bg-black/20 dark:bg-white/20 text-black dark:text-white font-semibold px-3 py-1 text-xs font-['Roboto'] font-medium">
                                Prix conso: {String(d.prix_conso)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Distribution */}
                {(() => {
                  const distData = getActivation('distribution');
                  if (!distData) return null;
                  const d = jsonToRecord(distData.data);
                  const channels = d.channels as Record<string, any>[] | undefined;
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Store className="h-4 w-4 text-black dark:text-white font-semibold" />
                        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold uppercase tracking-wider">Distribution</h3>
                      </div>
                      <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
                        {channels && channels.length > 0 ? (
                          <table className="w-full text-xs font-['Roboto']">
                            <thead>
                              <tr className="border-b border-border/40">
                                <th className="text-left px-3 py-2 text-muted-foreground font-medium" />
                                {channels.map((ch: any) => (
                                  <th key={ch.name} className="text-center px-3 py-2 text-foreground font-medium">{ch.name}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-border/20">
                                <td className="px-3 py-2 text-muted-foreground">Poids estimé (%)</td>
                                {channels.map((ch: any) => (
                                  <td key={ch.name} className="px-3 py-2 text-center text-foreground">{ch.weight ?? '—'}</td>
                                ))}
                              </tr>
                              <tr>
                                <td className="px-3 py-2 text-muted-foreground">Niveau distribution</td>
                                {channels.map((ch: any) => (
                                  <td key={ch.name} className="px-3 py-2 text-center text-foreground">{ch.level ?? '—'}</td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-4 text-muted-foreground text-sm">Aucune donnée de distribution</div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'sell' && (
              <div className="space-y-6">
                {['sell_in', 'sell_out'].map((section) => {
                  const sData = getActivation(section);
                  if (!sData) return null;
                  const d = jsonToRecord(sData.data);
                  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                  const quarters = ['Q1', 'Q2', 'Q3', 'Q4', 'FY'];
                  const rows = d.rows as Record<string, any>[] | undefined;

                  return (
                    <div key={section}>
                      <div className="flex items-center gap-2 mb-3">
                        {section === 'sell_in' ? <TrendingUp className="h-4 w-4 text-black dark:text-white font-semibold" /> : <TrendingDown className="h-4 w-4 text-black dark:text-white font-semibold" />}
                        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold uppercase tracking-wider">
                          {section === 'sell_in' ? 'Sell-in' : 'Sell-out'}
                        </h3>
                      </div>
                      <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
                        {rows && rows.length > 0 ? (
                          <table className="w-full text-xs font-['Roboto']">
                            <thead>
                              <tr className="border-b border-border/40">
                                <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[160px]">Indicateur</th>
                                {months.map((m) => (
                                  <th key={m} className="text-center px-2 py-2 text-muted-foreground font-medium">{m}</th>
                                ))}
                                {quarters.map((q) => (
                                  <th key={q} className="text-center px-2 py-2 text-black dark:text-white font-semibold font-bold border-l border-border/40">{q}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row: any, ri: number) => {
                                const isEvol = String(row.label || '').toLowerCase().includes('évol') || String(row.label || '').toLowerCase().includes('evol');
                                return (
                                  <tr key={ri} className="border-b border-border/20 hover:bg-gray-50 dark:bg-[#141928]">
                                    <td className="px-3 py-2 text-foreground font-medium">{row.label || '—'}</td>
                                    {months.map((m) => {
                                      const val = row[m.toLowerCase()] ?? row[m] ?? null;
                                      const numVal = val != null ? Number(val) : null;
                                      let cls = 'text-foreground';
                                      if (isEvol && numVal != null) {
                                        cls = numVal >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
                                      }
                                      return (
                                        <td key={m} className={`px-2 py-2 text-center ${cls}`}>
                                          {numVal != null ? (isEvol ? `${numVal >= 0 ? '+' : ''}${numVal.toFixed(1)}%` : formatNum(numVal)) : '—'}
                                        </td>
                                      );
                                    })}
                                    {quarters.map((q) => {
                                      const val = row[q.toLowerCase()] ?? row[q] ?? null;
                                      const numVal = val != null ? Number(val) : null;
                                      return (
                                        <td key={q} className="px-2 py-2 text-center text-black dark:text-white font-semibold font-medium border-l border-border/40">
                                          {numVal != null ? formatNum(numVal) : '—'}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-4 text-muted-foreground text-sm">Aucune donnée</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!getActivation('sell_in') && !getActivation('sell_out') && (
                  <div className="text-muted-foreground text-xs font-['Roboto'] py-8 text-center">Aucune donnée Sell-in / Sell-out disponible</div>
                )}
              </div>
            )}
          </>
        )}
      </LagostinaSubTabs>
    </div>
  );
}

function formatNum(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n % 1 !== 0) return n.toFixed(2);
  return String(n);
}
