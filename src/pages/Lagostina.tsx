import { useState, lazy, Suspense } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useLagostinaAccess } from '@/hooks/useLagostinaAccess';
import { Navigate } from 'react-router-dom';
import { LagostinaExportButtons } from '@/components/lagostina/LagostinaExportButtons';
import { LagostinaLearningsPanel } from '@/components/lagostina/LagostinaLearningsPanel';
import { Database, SquarePen } from 'lucide-react';
import { PageHeader } from '@/components/layout';


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

const EXPORT_CONFIG: Record<string, { tabName: string; showPdf: boolean; chartsId: string }> = {
  scorecard: { tabName: 'Scorecard', showPdf: true, chartsId: 'lagostina-tab-content' },
  budget: { tabName: 'Budget', showPdf: true, chartsId: 'lagostina-tab-content' },
  influence: { tabName: 'Influence & RP', showPdf: true, chartsId: 'lagostina-tab-content' },
  mediatisation: { tabName: 'Médiatisation', showPdf: true, chartsId: 'lagostina-tab-content' },
};

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-foreground/5/5 w-1/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-foreground/5/5" />
        ))}
      </div>
      <div className="h-64 bg-foreground/5/5" />
    </div>
  );
}

function EmptyState({ section, role }: { section: string; role: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Database className="h-12 w-12 text-[hsl(var(--muted-foreground))]" />
      <p className="text-foreground font-['Instrument Sans'] text-sm">Données {section} non disponibles</p>
      <p className="text-[hsl(var(--muted-foreground))] font-['Instrument Sans'] text-xs">En attente de synchronisation</p>
      {(role === 'admin' || role === 'team') ? (
        <a href="/admin/lagostina" className="px-4 py-2 border border-black dark:border-[hsl(var(--brand-yellow))] text-foreground dark:text-[hsl(var(--brand-yellow))] font-['Instrument Sans'] text-sm hover:bg-foreground hover:text-background dark:hover:bg-[hsl(var(--brand-yellow))] dark:hover:text-foreground transition-colors">
          Synchroniser
        </a>
      ) : (
        <p className="text-[hsl(var(--muted-foreground))] font-['Instrument Sans'] text-xs">Contactez l'équipe Hub & Up</p>
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
      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-['Instrument Sans'] font-medium transition-colors border ${
        showLearnings
          ? 'bg-foreground text-background dark:bg-[hsl(var(--brand-yellow))] border-black dark:border-[hsl(var(--brand-yellow))]'
          : 'bg-card dark:bg-[hsl(var(--brand-ink))] text-foreground border-border/50 hover:bg-muted/50'
      }`}
    >
      <SquarePen className="h-4 w-4" />
      Learnings
    </button>
  );

  return (
    <div className="bg-card dark:bg-[#0a0e1a]">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <PageHeader
          title="Lagostina"
          subtitle="Dashboard de pilotage — Groupe SEB"
          actions={
            exportCfg ? (
              <LagostinaExportButtons
                tabName={exportCfg.tabName}
                showPdf={exportCfg.showPdf}
                chartsContainerId={exportCfg.chartsId}
              />
            ) : null
          }
        />
      </div>


      {/* Tabs */}
      <div className="px-6 border-b border-black/10 dark:border-white/10">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowLearnings(false); }}
              className={`
                px-4 py-3 text-sm font-['Instrument Sans'] whitespace-nowrap transition-all duration-150 border-b-2
                ${activeTab === tab.id
                  ? 'text-foreground dark:text-[hsl(var(--brand-yellow))] border-black dark:border-[hsl(var(--brand-yellow))] font-medium'
                  : 'text-[hsl(var(--muted-foreground))] border-transparent hover:text-[hsl(var(--muted-foreground))]'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 transition-opacity duration-150" id="lagostina-tab-content">
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
