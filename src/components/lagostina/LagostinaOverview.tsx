import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Eye, MousePointerClick, DollarSign, PieChart, AlertCircle, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

function KpiCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f1422] border border-border/30 border-l-[3px] border-black dark:border-white p-5 animate-pulse">
      <div className="h-3 w-20 bg-gray-200 mb-3" />
      <div className="h-8 w-32 bg-gray-200 mb-2" />
      <div className="h-3 w-16 bg-gray-200" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 mb-2" />
      ))}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: { direction: 'up' | 'down'; label: string };
  color?: string;
}

function KpiCard({ label, value, icon, trend, color }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-[#0f1422] border border-border/30 border-l-[3px] border-black dark:border-white p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-foreground text-2xl font-bold font-['Instrument_Sans']">{value}</div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-['Roboto'] ${trend.direction === 'up' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {trend.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend.label}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ok: { bg: 'bg-[#22c55e]/20', text: 'text-[#22c55e]' },
  alert: { bg: 'bg-black/20 dark:bg-white/20', text: 'text-black dark:text-white font-semibold' },
  blocked: { bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]' },
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

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || { bg: 'bg-gray-200', text: 'text-muted-foreground' };
  const displayText = status === 'ok' ? 'OK' : status === 'alert' ? 'Alerte' : status === 'blocked' ? 'Bloqué' : status;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-['Roboto'] font-medium ${style.bg} ${style.text}`}>
      {displayText}
    </span>
  );
}

export function LagostinaOverview() {
  const navigate = useNavigate();
  const { role } = useUserRole();

  // Fetch scorecards
  const { data: scorecards, isLoading: loadingScorecard } = useQuery({
    queryKey: ['lagostina-scorecards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_scorecards')
        .select('*')
        .order('week', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch budget
  const { data: budgetData, isLoading: loadingBudget } = useQuery({
    queryKey: ['lagostina-budget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_budget')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch category status
  const { data: categoryStatus, isLoading: loadingCategory } = useQuery({
    queryKey: ['lagostina-category-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_category_status')
        .select('*')
        .order('priority');
      if (error) throw error;
      return data;
    },
  });

  // Fetch last file sync
  const { data: lastSync } = useQuery({
    queryKey: ['lagostina-last-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_files_sync')
        .select('*')
        .eq('status', 'synced')
        .order('last_synced', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  // Compute KPIs from scorecards
  const latestWeek = scorecards?.length
    ? scorecards.reduce((max, s) => (s.week > max ? s.week : max), scorecards[0].week)
    : null;

  const latestData = scorecards?.filter((s) => s.week === latestWeek) || [];

  const reachTotal = latestData
    .filter((s) => s.kpi_name.toLowerCase().includes('reach') || s.kpi_name.toLowerCase().includes('potentiel'))
    .reduce((sum, s) => sum + (Number(s.actual) || 0), 0);

  const visitesD2C = latestData
    .filter((s) => s.kpi_name.toLowerCase().includes('visite') || s.kpi_name.toLowerCase().includes('d2c'))
    .reduce((sum, s) => sum + (Number(s.actual) || 0), 0);

  const roasEntries = latestData.filter((s) => s.kpi_name.toLowerCase().includes('roas'));
  const roasMoyen = roasEntries.length
    ? roasEntries.reduce((sum, s) => sum + (Number(s.actual) || 0), 0) / roasEntries.length
    : 0;

  const totalPlanned = budgetData?.reduce((sum, b) => sum + (Number(b.planned) || 0), 0) || 0;
  const totalEngaged = budgetData?.reduce((sum, b) => sum + (Number(b.engaged) || 0), 0) || 0;
  const budgetPct = totalPlanned > 0 ? Math.round((totalEngaged / totalPlanned) * 100) : 0;

  const isLoading = loadingScorecard || loadingBudget || loadingCategory;
  const isEmpty = !scorecards?.length && !budgetData?.length && !categoryStatus?.length;

  if (isEmpty && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-muted-foreground" />
        <p className="text-foreground font-['Instrument_Sans'] text-lg font-bold">Données non disponibles</p>
        <p className="text-muted-foreground font-['Roboto'] text-sm">En attente de la première synchronisation</p>
        {(role === 'admin' || role === 'team') && (
          <button
            onClick={() => navigate('/admin/lagostina')}
            className="mt-2 px-4 py-2 bg-black text-[#0f1422] font-['Roboto'] font-medium text-sm hover:bg-[#d4eb3d] transition-colors"
          >
            Aller à l'admin
          </button>
        )}
      </div>
    );
  }

  // Group category status by priority
  const priorityGroups = categoryStatus?.reduce((acc, item) => {
    if (!acc[item.priority]) {
      acc[item.priority] = { label: item.priority_label, axes: {} };
    }
    acc[item.priority].axes[item.axis] = item.status;
    return acc;
  }, {} as Record<string, { label: string; axes: Record<string, string> }>) || {};

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Reach total"
            value={reachTotal >= 1000000 ? `${(reachTotal / 1000000).toFixed(1)}M` : reachTotal >= 1000 ? `${(reachTotal / 1000).toFixed(0)}K` : String(reachTotal)}
            icon={<Eye className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Visites D2C"
            value={visitesD2C >= 1000000 ? `${(visitesD2C / 1000000).toFixed(1)}M` : visitesD2C >= 1000 ? `${(visitesD2C / 1000).toFixed(0)}K` : String(visitesD2C)}
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="ROAS moyen"
            value={roasMoyen.toFixed(2)}
            icon={<DollarSign className="h-3.5 w-3.5" />}
          />
          <div className="bg-white dark:bg-[#0f1422] border border-border/30 border-l-[3px] border-black dark:border-white p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider">
              <PieChart className="h-3.5 w-3.5" />
              Budget engagé
            </div>
            <div className="text-foreground text-2xl font-bold font-['Instrument_Sans']">{budgetPct}%</div>
            <div className="w-full h-1.5 bg-gray-200 mt-1">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(budgetPct, 100)}%`,
                  backgroundColor: budgetPct >= 100 ? '#ef4444' : budgetPct >= 80 ? '#E8FF4C' : '#22c55e',
                }}
              />
            </div>
            <div className="text-muted-foreground text-xs font-['Roboto'] mt-0.5">
              {totalEngaged.toLocaleString('fr-FR')}€ / {totalPlanned.toLocaleString('fr-FR')}€
            </div>
          </div>
        </div>
      )}

      {/* Category Status Table */}
      {loadingCategory ? (
        <TableSkeleton />
      ) : Object.keys(priorityGroups).length > 0 ? (
        <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left px-4 py-3 text-muted-foreground font-['Roboto'] font-medium text-xs uppercase tracking-wider">Priorité</th>
                {AXES.map((axis) => (
                  <th key={axis.key} className="text-center px-3 py-3 text-muted-foreground font-['Roboto'] font-medium text-xs uppercase tracking-wider">
                    {axis.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(priorityGroups).map(([priority, group]) => (
                <tr key={priority} className="border-b border-border/20 hover:bg-gray-50 dark:bg-[#141928]">
                  <td className="px-4 py-3">
                    <div className="text-foreground font-['Instrument_Sans'] font-medium text-sm">{group.label}</div>
                    <div className="text-muted-foreground font-['Roboto'] text-xs">{priority}</div>
                  </td>
                  {AXES.map((axis) => (
                    <td key={axis.key} className="text-center px-3 py-3">
                      {group.axes[axis.key] ? (
                        <StatusBadge status={group.axes[axis.key]} />
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Last sync timestamp */}
      {lastSync && (
        <div className="text-muted-foreground text-xs font-['Roboto'] flex items-center gap-1">
          Dernière mise à jour : {new Date(lastSync.last_synced).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — Source : {lastSync.filename}
        </div>
      )}
    </div>
  );
}
