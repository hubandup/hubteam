import { useState, lazy, Suspense } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useLagostinaAccess } from '@/hooks/useLagostinaAccess';
import { Navigate } from 'react-router-dom';
import { LagostinaExportButtons } from '@/components/lagostina/LagostinaExportButtons';
import { LagostinaLearningsPanel } from '@/components/lagostina/LagostinaLearningsPanel';
import { Database, SquarePen } from 'lucide-react';

// Lazy load tab components
const ScorecardRECC = lazy(() => import('@/components/lagostina/ScorecardRECC').then(m => ({ default: m.ScorecardRECC })));
const LagostinaBudget = lazy(() => import('@/components/lagostina/LagostinaBudget').then(m => ({ default: m.LagostinaBudget })));
const LagostinaInfluenceRP = lazy(() => import('@/components/lagostina/LagostinaInfluenceRP').then(m => ({ default: m.LagostinaInfluenceRP })));
const LagostinaMediatisation = lazy(() => import('@/components/lagostina/LagostinaMediatisation').then(m => ({ default: m.LagostinaMediatisation })));

const TABS = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'influence', label: 'Influence & RP' },
  { id: 'mediatisation', label: 'Médiatisation' },
  { id: 'budget', label: 'Budget' },
] as const;

const EXPORT_CONFIG: Record<string, { tabName: string; showPdf: boolean; chartsId?: string }> = {
  scorecard: { tabName: 'Scorecard', showPdf: true, chartsId: 'lagostina-scorecard-charts' },
  budget: { tabName: 'Budget', showPdf: true, chartsId: 'lagostina-budget-charts' },
  influence: { tabName: 'Influence & RP', showPdf: false },
  mediatisation: { tabName: 'Médiatisation', showPdf: false },
};

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-black/5 dark:bg-white/5 w-1/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-black/5 dark:bg-white/5" />
        ))}
      </div>
      <div className="h-64 bg-black/5 dark:bg-white/5" />
    </div>
  );
}

function EmptyState({ section, role }: { section: string; role: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Database className="h-12 w-12 text-[#9ca3af]" />
      <p className="text-black dark:text-white font-['Roboto'] text-sm">Données {section} non disponibles</p>
      <p className="text-[#9ca3af] font-['Roboto'] text-xs">En attente de synchronisation</p>
      {(role === 'admin' || role === 'team') ? (
        <a href="/lagostina-admin" className="px-4 py-2 border border-black dark:border-[#E8FF4C] text-black dark:text-[#E8FF4C] font-['Roboto'] text-sm hover:bg-black hover:text-white dark:hover:bg-[#E8FF4C] dark:hover:text-black transition-colors">
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
  const { hasAccess, isLoading: accessLoading } = useLagostinaAccess();
  const [activeTab, setActiveTab] = useState('scorecard');
  const [showLearnings, setShowLearnings] = useState(false);

  if (accessLoading) return <TabSkeleton />;
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  const exportCfg = EXPORT_CONFIG[activeTab];

  const learningsButton = (
    <button
      onClick={() => setShowLearnings(!showLearnings)}
      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-['Roboto'] font-medium transition-colors border ${
        showLearnings
          ? 'bg-black text-white dark:bg-[#E8FF4C] dark:text-black border-black dark:border-[#E8FF4C]'
          : 'bg-white dark:bg-[#0f1422] text-foreground border-border/50 hover:bg-muted/50'
      }`}
    >
      <SquarePen className="h-4 w-4" />
      Learnings
    </button>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0e1a]">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white font-['Instrument_Sans'] tracking-tight">
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
      <div className="px-6 border-b border-black/10 dark:border-white/10">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowLearnings(false); }}
              className={`
                px-4 py-3 text-sm font-['Roboto'] whitespace-nowrap transition-all duration-150 border-b-2
                ${activeTab === tab.id
                  ? 'text-black dark:text-[#E8FF4C] border-black dark:border-[#E8FF4C] font-medium'
                  : 'text-[#9ca3af] border-transparent hover:text-[#6b7280]'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 transition-opacity duration-150">
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'scorecard' && <ScorecardRECC learningsButton={learningsButton} learningsPanel={showLearnings ? <LagostinaLearningsPanel activeTab={activeTab} /> : null} />}
          {activeTab === 'influence' && <LagostinaInfluenceRP learningsButton={learningsButton} learningsPanel={showLearnings ? <LagostinaLearningsPanel activeTab={activeTab} /> : null} />}
          {activeTab === 'mediatisation' && <LagostinaMediatisation learningsButton={learningsButton} learningsPanel={showLearnings ? <LagostinaLearningsPanel activeTab={activeTab} /> : null} />}
          {activeTab === 'budget' && <LagostinaBudget learningsButton={learningsButton} learningsPanel={showLearnings ? <LagostinaLearningsPanel activeTab={activeTab} /> : null} />}
        </Suspense>
      </div>
    </div>
  );
}
