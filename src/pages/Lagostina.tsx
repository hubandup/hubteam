import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { LagostinaOverview } from '@/components/lagostina/LagostinaOverview';
import { ScorecardRECC } from '@/components/lagostina/ScorecardRECC';
import { ActivationPersonas } from '@/components/lagostina/ActivationPersonas';
import { LagostinaBudget } from '@/components/lagostina/LagostinaBudget';
import { LagostinaInfluenceRP } from '@/components/lagostina/LagostinaInfluenceRP';
import { LagostinaExportButtons } from '@/components/lagostina/LagostinaExportButtons';
import { Clock } from 'lucide-react';

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
};

function PlaceholderTab() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Clock className="h-12 w-12 text-[#9ca3af]" />
      <p className="text-[#9ca3af] font-['Roboto'] text-base">Prochainement disponible</p>
    </div>
  );
}

export default function Lagostina() {
  const { role } = useUserRole();
  const [activeTab, setActiveTab] = useState('overview');

  if (role !== 'admin' && role !== 'team' && role !== 'client') {
    return <Navigate to="/" replace />;
  }

  const exportCfg = EXPORT_CONFIG[activeTab];

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <div className="px-6 pt-6 pb-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Instrument_Sans'] tracking-tight">
            Lagostina
          </h1>
          <p className="text-[#9ca3af] font-['Roboto'] text-sm mt-1">
            Dashboard de pilotage — Groupe SEB
          </p>
        </div>
        {exportCfg && (
          <LagostinaExportButtons
            tabName={exportCfg.tabName}
            showPdf={exportCfg.showPdf}
            chartsContainerId={exportCfg.chartsId}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-white/10">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-['Roboto'] whitespace-nowrap transition-colors border-b-2
                ${activeTab === tab.id
                  ? 'text-[#E8FF4C] border-[#E8FF4C] font-medium'
                  : 'text-[#9ca3af] border-transparent hover:text-white'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && <LagostinaOverview />}
        {activeTab === 'activation' && <ActivationPersonas />}
        {activeTab === 'scorecard' && <ScorecardRECC />}
        {activeTab === 'budget' && <LagostinaBudget />}
        {activeTab === 'influence' && <LagostinaInfluenceRP />}
        {!['overview', 'activation', 'scorecard', 'budget', 'influence'].includes(activeTab) && <PlaceholderTab />}
      </div>
    </div>
  );
}
