import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Prospect } from '@/hooks/useProspects';
import { TrendingUp, AlertTriangle, Calendar, Euro } from 'lucide-react';
import { isToday, isPast, parseISO, addDays, isWithinInterval } from 'date-fns';

interface PipelineStatsProps {
  prospects: Prospect[];
}

export function PipelineStats({ prospects }: PipelineStatsProps) {
  const stats = useMemo(() => {
    const activeProspects = prospects.filter(p => !['Gagné', 'Perdu'].includes(p.status));
    
    const totalWeighted = activeProspects.reduce((sum, p) => sum + p.estimated_amount * p.probability, 0);
    
    const followupsDue = activeProspects.filter(p => 
      p.next_action_at && (isToday(parseISO(p.next_action_at)) || isPast(parseISO(p.next_action_at)))
    ).length;

    const rdvPlanned = prospects.filter(p => p.status === 'RDV planifié').length;

    return {
      activeCount: activeProspects.length,
      totalWeighted,
      followupsDue,
      rdvPlanned,
    };
  }, [prospects]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Opportunités actives
          </CardDescription>
          <CardTitle className="text-2xl">{stats.activeCount}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <Euro className="h-3 w-3" />
            CA pondéré
          </CardDescription>
          <CardTitle className="text-2xl">{stats.totalWeighted.toLocaleString('fr-FR')} €</CardTitle>
        </CardHeader>
      </Card>

      <Card className={stats.followupsDue > 0 ? 'border-orange-400' : ''}>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <AlertTriangle className={`h-3 w-3 ${stats.followupsDue > 0 ? 'text-orange-500' : ''}`} />
            Relances dues
          </CardDescription>
          <CardTitle className={`text-2xl ${stats.followupsDue > 0 ? 'text-orange-600' : ''}`}>
            {stats.followupsDue}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            RDV planifiés
          </CardDescription>
          <CardTitle className="text-2xl">{stats.rdvPlanned}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
