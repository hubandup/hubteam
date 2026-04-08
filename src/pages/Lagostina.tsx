import { useState, lazy, Suspense, useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LagostinaExportButtons } from '@/components/lagostina/LagostinaExportButtons';
import { BarChart3, Database } from 'lucide-react';

// Lazy load all tab components
const LagostinaOverview = lazy(() => import('@/components/lagostina/LagostinaOverview').then(m => ({ default: m.LagostinaOverview })));
const ScorecardRECC = lazy(() => import('@/components/lagostina/ScorecardRECC').then(m => ({ default: m.ScorecardRECC })));
const ActivationPersonas = lazy(() => import('@/components/lagostina/ActivationPersonas').then(m => ({ default: m.ActivationPersonas })));
const LagostinaBudget = lazy(() => import('@/components/lagostina/LagostinaBudget').then(m => ({ default: m.LagostinaBudget })));
const LagostinaInfluenceRP = lazy(() => import('@/components/lagostina/LagostinaInfluenceRP').then(m => ({ default: m.LagostinaInfluenceRP })));
const LagostinaMediatisation = lazy(() => import('@/components/lagostina/LagostinaMediatisation').then(m => ({ default: m.LagostinaMediatisation })));
const LagostinaConsumer = lazy(() => import('@/components/lagostina/LagostinaConsumer').then(m => ({ default: m.LagostinaConsumer })));
const LagostinaContenus = lazy(() => import('@/components/lagostina/LagostinaContenus').then(m => ({ default: m.LagostinaContenus })));
const LagostinaLearnings = lazy(() => import('@/components/lagostina/LagostinaLearnings').then(m => ({ default: m.LagostinaLearnings })));

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activation', label: 'Activation & Personas' },
  { id: 'scorecard', label: 'Scorecard RECC' },
  { id: 'contenus', label: 'Contenus & Social' },
  { id: 'influence', label: 'Influence & RP' },
  { id: 'mediatisation', label: 'Médiatisation' },
  { id: 'budget', label: 'Budget' },
  { id: 'consumer', label: 'Voice of Consumer' },
  { id: 'learnings', label: 'Learnings' },
] as const;

const EXPORT_CONFIG: Record<string, { tabName: string; showPdf: boolean; chartsId?: string }> = {
  overview: { tabName: 'Overview', showPdf: false },
  scorecard: { tabName: 'Scorecard RECC', showPdf: true, chartsId: 'lagostina-scorecard-charts' },
  activation: { tabName: 'Activation & Personas', showPdf: false },
  budget: { tabName: 'Budget', showPdf: true, chartsId: 'lagostina-budget-charts' },
  influence: { tabName: 'Influence & RP', showPdf: false },
  mediatisation: { tabName: 'Médiatisation', showPdf: false },
  consumer: { tabName: 'Voice of Consumer', showPdf: false },
  contenus: { tabName: 'Contenus & Social', showPdf: false },
};

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-black/5 w-1/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-black/5" />
        ))}
      </div>
      <div className="h-64 bg-black/5" />
    </div>
  );
}

function EmptyState({ section, role }: { section: string; role: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Database className="h-12 w-12 text-[#9ca3af]" />
      <p className="text-black font-['Roboto'] text-sm">Données {section} non disponibles</p>
      <p className="text-[#9ca3af] font-['Roboto'] text-xs">En attente de synchronisation</p>
      {(role === 'admin' || role === 'team') ? (
        <a href="/lagostina-admin" className="px-4 py-2 border border-black text-black font-['Roboto'] text-sm hover:bg-black hover:text-white transition-colors">
          Synchroniser
        </a>
      ) : (
        <p className="text-[#6b7280] font-['Roboto'] text-xs">Contactez l'équipe Hub & Up</p>
      )}
    </div>
  );
}

export default function Lagostina() {
  const { role } = useUserRole();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPriority, setSelectedPriority] = useState('all');

  // Fetch priorities from category_status
  const { data: priorities } = useQuery({
    queryKey: ['lagostina-priorities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_category_status')
        .select('priority, priority_label')
        .order('priority');
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data || []) {
        if (!map.has(row.priority)) map.set(row.priority, row.priority_label);
      }
      return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const priorityOptions = useMemo(() => {
    const opts = [{ key: 'all', label: 'Toutes les priorités' }];
    if (priorities) opts.push(...priorities.map(p => ({ key: p.key, label: `${p.key.replace('_', ' ').replace(/^p/, 'P')} — ${p.label}` })));
    return opts;
  }, [priorities]);

  if (role !== 'admin' && role !== 'team' && role !== 'client') {
    return <Navigate to="/" replace />;
  }

  const exportCfg = EXPORT_CONFIG[activeTab];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black font-['Instrument_Sans'] tracking-tight">
            Lagostina
          </h1>
          <p className="text-[#6b7280] font-['Roboto'] text-sm mt-1">
            Dashboard de pilotage — Groupe SEB
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exportCfg && (
            <LagostinaExportButtons
              tabName={exportCfg.tabName}
              showPdf={exportCfg.showPdf}
              chartsContainerId={exportCfg.chartsId}
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-black/10">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-['Roboto'] whitespace-nowrap transition-all duration-150 border-b-2
                ${activeTab === tab.id
                  ? 'text-black border-black font-medium'
                  : 'text-[#9ca3af] border-transparent hover:text-[#6b7280]'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority selector */}
      {priorityOptions.length > 1 && (
        <div className="px-6 py-3 border-b border-black/5 flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-[#6b7280]" />
          <span className="text-[#6b7280] font-['Roboto'] text-xs">Priorité :</span>
          <div className="flex gap-1">
            {priorityOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSelectedPriority(opt.key)}
                className={`px-3 py-1 text-xs font-['Roboto'] transition-colors ${
                  selectedPriority === opt.key
                    ? 'bg-black text-white font-medium'
                    : 'bg-black/5 text-[#6b7280] hover:bg-black/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content with fade transition */}
      <div className="p-6 transition-opacity duration-150">
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'overview' && <LagostinaOverview />}
          {activeTab === 'activation' && <ActivationPersonas />}
          {activeTab === 'scorecard' && <ScorecardRECC />}
          {activeTab === 'contenus' && <LagostinaContenus />}
          {activeTab === 'influence' && <LagostinaInfluenceRP />}
          {activeTab === 'mediatisation' && <LagostinaMediatisation />}
          {activeTab === 'budget' && <LagostinaBudget />}
          {activeTab === 'consumer' && <LagostinaConsumer />}
          {activeTab === 'learnings' && <LagostinaLearnings />}
        </Suspense>
      </div>
    </div>
  );
}
