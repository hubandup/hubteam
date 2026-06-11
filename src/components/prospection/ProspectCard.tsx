import { Card, CardContent } from '@/components/ui/card';
import { EntityCard } from '@/components/layout';
import { Prospect, PROSPECT_STATUSES } from '@/hooks/useProspects';
import { AlertTriangle, Euro, Calendar } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateColorFromString } from '@/lib/utils';

interface ProspectCardProps {
  prospect: Prospect;
  onClick?: () => void;
  compact?: boolean;
}

export function ProspectCard({ prospect, onClick, compact = false }: ProspectCardProps) {
  const statusConfig = PROSPECT_STATUSES.find(s => s.value === prospect.status);
  const weightedRevenue = prospect.estimated_amount * prospect.probability;
  
  const isFollowupDue = prospect.next_action_at && 
    !['Gagné', 'Perdu'].includes(prospect.status) &&
    (isToday(parseISO(prospect.next_action_at)) || isPast(parseISO(prospect.next_action_at)));

  const needsPlanning = !['Gagné', 'Perdu', 'En veille'].includes(prospect.status) && 
    (!prospect.next_action || !prospect.next_action_at);

  const priorityColors = {
    A: 'bg-red-500',
    B: 'bg-yellow-500',
    C: 'bg-green-500',
  };

  const offerTags = prospect.offer_tags || [];

  if (compact) {
    return (
      <Card 
        className={`cursor-pointer hover:shadow-md transition-shadow ${isFollowupDue ? 'ring-2 ring-orange-400' : ''}`}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{prospect.company_name}</div>
              <div className="text-xs text-muted-foreground truncate">{prospect.contact_name}</div>
            </div>
            <div className={`w-2 h-2 rounded-full ${priorityColors[prospect.priority]}`} />
          </div>
          
          {prospect.estimated_amount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Euro className="h-3 w-3" />
              <span>{weightedRevenue.toLocaleString('fr-FR')} € pondéré</span>
            </div>
          )}

          {/* Expertise tags - compact view (max 2 visible) */}
          {offerTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {offerTags.slice(0, 2).map((tag) => {
                const tagColor = generateColorFromString(tag);
                return (
                  <span
                    key={tag}
                    className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium truncate max-w-[80px]"
                    style={{
                      backgroundColor: `${tagColor}20`.replace('hsl', 'hsla').replace(')', ', 0.15)'),
                      color: tagColor,
                      borderColor: tagColor,
                    }}
                    title={tag}
                  >
                    {tag}
                  </span>
                );
              })}
              {offerTags.length > 2 && (
                <span className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                  +{offerTags.length - 2}
                </span>
              )}
            </div>
          )}
          
          {prospect.next_action && (
            <div className="text-xs bg-muted/50 rounded px-2 py-1 truncate">
              {prospect.next_action}
            </div>
          )}
          
          {(isFollowupDue || needsPlanning) && (
            <div className="flex items-center gap-1 mt-2 text-xs text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-3 w-3" />
              <span>{needsPlanning ? 'À planifier' : 'Relance due'}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const statusColor = (statusConfig?.color || '').includes('green')
    ? { bg: '#ECFDF5', text: '#047857', dot: '#059669' }
    : (statusConfig?.color || '').includes('red')
    ? { bg: '#FEF2F2', text: '#B91C1C', dot: '#DC2626' }
    : (statusConfig?.color || '').includes('yellow') || (statusConfig?.color || '').includes('orange')
    ? { bg: '#FFF7ED', text: '#C2410C', dot: '#EA580C' }
    : { bg: '#EFF6FF', text: '#1D4ED8', dot: '#2563EB' };

  return (
    <EntityCard
      title={prospect.company_name}
      subtitle={prospect.contact_name}
      onClick={onClick}
      className={isFollowupDue ? 'ring-2 ring-orange-400' : ''}
      status={{ ...statusColor, label: prospect.status }}
      alert={
        isFollowupDue
          ? { label: needsPlanning ? 'Action à planifier' : 'Relance due', color: '#EA580C' }
          : needsPlanning
          ? { label: 'Action à planifier', color: '#EA580C' }
          : undefined
      }
      email={prospect.email}
      phone={prospect.phone || undefined}
      extraInfo={
        <>
          {offerTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {offerTags.map((tag) => {
                const tagColor = generateColorFromString(tag);
                return (
                  <span
                    key={tag}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-badge border"
                    style={{
                      backgroundColor: `${tagColor}15`.replace('hsl', 'hsla').replace(')', ', 0.1)'),
                      borderColor: tagColor,
                      color: tagColor,
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1">
            <span
              className={`w-2 h-2 rounded-full ${priorityColors[prospect.priority]}`}
              title={`Priorité ${prospect.priority}`}
            />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Priorité {prospect.priority}
            </span>
          </div>
        </>
      }
      footerLeft={
        prospect.next_action ? (
          <>
            <Calendar size={10} className="text-muted-foreground shrink-0 opacity-70" />
            <span className="font-semibold text-foreground truncate">{prospect.next_action}</span>
            {prospect.next_action_at && (
              <span className="text-muted-foreground">
                · {format(parseISO(prospect.next_action_at), 'd MMM', { locale: fr })}
              </span>
            )}
          </>
        ) : prospect.estimated_amount > 0 ? (
          <>
            <span className="text-muted-foreground">Pondéré</span>
            <span className="font-semibold text-foreground">
              {weightedRevenue.toLocaleString('fr-FR')} €
            </span>
          </>
        ) : undefined
      }
      footerRight={
        prospect.estimated_amount > 0 && prospect.next_action ? (
          <>
            <span className="font-semibold text-foreground">
              {weightedRevenue.toLocaleString('fr-FR')} €
            </span>
            <span className="text-muted-foreground font-normal">
              ({Math.round(prospect.probability * 100)}%)
            </span>
          </>
        ) : undefined
      }
    />
  );
}
