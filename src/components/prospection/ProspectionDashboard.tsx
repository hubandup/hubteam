import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import { Prospect, PROSPECT_STATUSES } from '@/hooks/useProspects';
import { Interaction } from '@/hooks/useProspects';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';
import { isToday, isPast, parseISO, differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProspectionDashboardProps {
  prospects: Prospect[];
  interactions: Interaction[];
}

const FUNNEL_STAGES = [
  'À contacter',
  'Contacté',
  'Relance 1',
  'Relance 2',
  'RDV planifié',
  'Besoin qualifié',
  'Proposition envoyée',
  'Négociation',
  'Gagné',
];

const FUNNEL_COLORS = [
  '#94a3b8', '#60a5fa', '#fbbf24', '#f97316', '#a78bfa',
  '#22d3ee', '#818cf8', '#ec4899', '#22c55e',
];

export function ProspectionDashboard({ prospects, interactions }: ProspectionDashboardProps) {
  // Funnel data
  const funnelData = useMemo(() => {
    return FUNNEL_STAGES.map((stage, i) => {
      const count = prospects.filter(p => p.status === stage).length;
      const won = prospects.filter(p => p.status === 'Gagné').length;
      // Cumulative: all prospects that reached this stage or beyond
      const stageIndex = FUNNEL_STAGES.indexOf(stage);
      const atOrBeyond = prospects.filter(p => {
        const pIndex = FUNNEL_STAGES.indexOf(p.status);
        return pIndex >= stageIndex || (p.status === 'Perdu' && pIndex === -1); // lost ones don't count
      }).length;

      return {
        name: stage,
        value: count,
        cumulative: atOrBeyond,
        fill: FUNNEL_COLORS[i],
      };
    }).filter(d => d.cumulative > 0 || d.value > 0);
  }, [prospects]);

  // Average time per stage (days)
  const avgTimePerStage = useMemo(() => {
    const stageTimings: Record<string, number[]> = {};
    
    // Group interactions by prospect to compute time in each stage
    const prospectInteractions: Record<string, Interaction[]> = {};
    interactions.forEach(i => {
      if (!prospectInteractions[i.prospect_id]) prospectInteractions[i.prospect_id] = [];
      prospectInteractions[i.prospect_id].push(i);
    });

    prospects.forEach(prospect => {
      const pInteractions = (prospectInteractions[prospect.id] || [])
        .sort((a, b) => new Date(a.happened_at).getTime() - new Date(b.happened_at).getTime());
      
      if (pInteractions.length < 2) return;

      // Estimate time from creation to first interaction, and between interactions
      const createdDate = new Date(prospect.created_at);
      const firstInteraction = new Date(pInteractions[0].happened_at);
      const daysToFirstAction = differenceInDays(firstInteraction, createdDate);
      
      if (daysToFirstAction >= 0) {
        if (!stageTimings['À contacter']) stageTimings['À contacter'] = [];
        stageTimings['À contacter'].push(Math.max(daysToFirstAction, 1));
      }

      // Time between status changes approximated by interaction gaps
      for (let i = 1; i < pInteractions.length; i++) {
        const days = differenceInDays(
          new Date(pInteractions[i].happened_at),
          new Date(pInteractions[i - 1].happened_at)
        );
        const outcome = pInteractions[i].outcome || 'Autre';
        if (!stageTimings[outcome]) stageTimings[outcome] = [];
        stageTimings[outcome].push(Math.max(days, 1));
      }
    });

    // Simplify: show average time by current status
    const statusTimings = FUNNEL_STAGES.slice(0, -1).map(stage => {
      const prospectsInStage = prospects.filter(p => p.status === stage);
      const avgDays = prospectsInStage.length > 0
        ? prospectsInStage.reduce((sum, p) => {
            return sum + differenceInDays(new Date(), new Date(p.updated_at || p.created_at));
          }, 0) / prospectsInStage.length
        : 0;
      return {
        name: stage.length > 12 ? stage.substring(0, 12) + '…' : stage,
        fullName: stage,
        jours: Math.round(avgDays),
      };
    }).filter(d => d.jours > 0);

    return statusTimings;
  }, [prospects, interactions]);

  // Overdue follow-ups
  const overdueFollowups = useMemo(() => {
    return prospects
      .filter(p => {
        if (!p.next_action_at || ['Gagné', 'Perdu'].includes(p.status)) return false;
        const actionDate = parseISO(p.next_action_at);
        return isPast(actionDate) && !isToday(actionDate);
      })
      .sort((a, b) => new Date(a.next_action_at!).getTime() - new Date(b.next_action_at!).getTime())
      .slice(0, 10);
  }, [prospects]);

  // Conversion rate per stage
  const conversionByStage = useMemo(() => {
    const total = prospects.length;
    if (total === 0) return [];
    
    return FUNNEL_STAGES.map((stage, i) => {
      const count = prospects.filter(p => {
        const idx = FUNNEL_STAGES.indexOf(p.status);
        return idx >= i;
      }).length;
      // Include won for all stages they passed through
      const wonCount = prospects.filter(p => p.status === 'Gagné').length;
      
      return {
        name: stage.length > 10 ? stage.substring(0, 10) + '…' : stage,
        fullName: stage,
        pourcentage: Math.round((count / total) * 100),
        nombre: count,
      };
    });
  }, [prospects]);

  return (
    <div className="space-y-6">
      {/* Funnel Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entonnoir de conversion</CardTitle>
            <CardDescription>Répartition des prospects par étape</CardDescription>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune donnée disponible</p>
            ) : (
              <div className="space-y-2">
                {funnelData.map((stage, i) => {
                  const maxValue = Math.max(...funnelData.map(d => d.value), 1);
                  const widthPercent = Math.max((stage.value / maxValue) * 100, 8);
                  return (
                    <div key={stage.name} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 truncate text-right">{stage.name}</span>
                      <div className="flex-1 h-8 relative">
                        <div
                          className="h-full rounded-sm flex items-center px-2 transition-all"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: stage.fill,
                            minWidth: '32px',
                          }}
                        >
                          <span className="text-xs font-bold text-white">{stage.value}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average Time Per Stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Temps moyen par étape
            </CardTitle>
            <CardDescription>Nombre de jours moyen dans chaque étape</CardDescription>
          </CardHeader>
          <CardContent>
            {avgTimePerStage.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Pas assez de données</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={avgTimePerStage} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '11px' }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100} 
                    stroke="hsl(var(--muted-foreground))" 
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: string) => [`${value} jours`, 'Durée moyenne']}
                    labelFormatter={(label) => {
                      const item = avgTimePerStage.find(d => d.name === label);
                      return item?.fullName || label;
                    }}
                  />
                  <Bar dataKey="jours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Follow-ups Alert */}
      {overdueFollowups.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Relances en retard ({overdueFollowups.length})
            </CardTitle>
            <CardDescription>Ces prospects nécessitent une action immédiate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueFollowups.map(prospect => {
                const daysOverdue = differenceInDays(new Date(), parseISO(prospect.next_action_at!));
                return (
                  <div key={prospect.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{prospect.company_name}</p>
                      <p className="text-xs text-muted-foreground">{prospect.contact_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{prospect.status}</Badge>
                      <Badge variant="destructive" className="text-xs">
                        {daysOverdue}j de retard
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversion by stage chart */}
      {conversionByStage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Taux de passage par étape
            </CardTitle>
            <CardDescription>Pourcentage de prospects ayant atteint chaque étape</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={conversionByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '11px' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: string) => [`${value}%`, 'Taux de passage']}
                  labelFormatter={(label) => {
                    const item = conversionByStage.find(d => d.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Bar dataKey="pourcentage" radius={[4, 4, 0, 0]}>
                  {conversionByStage.map((entry, index) => (
                    <Cell key={index} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
