import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Prospect, PROSPECT_STATUSES } from '@/hooks/useProspects';
import { Building2, User, Phone, Mail, Calendar, AlertTriangle, Euro } from 'lucide-react';
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

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${isFollowupDue ? 'ring-2 ring-orange-400' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{prospect.company_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{prospect.contact_name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${priorityColors[prospect.priority]}`} title={`Priorité ${prospect.priority}`} />
            <Badge variant="outline" className={statusConfig?.color}>
              {prospect.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
          {prospect.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span className="truncate">{prospect.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <span className="truncate">{prospect.email}</span>
          </div>
        </div>

        {/* Expertise tags - full view */}
        {offerTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {offerTags.map((tag) => {
              const tagColor = generateColorFromString(tag);
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{
                    backgroundColor: `${tagColor}15`.replace('hsl', 'hsla').replace(')', ', 0.1)'),
                    borderColor: tagColor,
                    color: tagColor,
                  }}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        )}

        {prospect.estimated_amount > 0 && (
          <div className="flex items-center justify-between text-sm mb-3 bg-muted/50 rounded px-2 py-1">
            <span>Montant: {prospect.estimated_amount.toLocaleString('fr-FR')} €</span>
            <span className="text-muted-foreground">({Math.round(prospect.probability * 100)}%)</span>
            <span className="font-medium text-primary">{weightedRevenue.toLocaleString('fr-FR')} €</span>
          </div>
        )}

        {prospect.next_action && (
          <div className="text-sm bg-primary/10 rounded px-2 py-1 mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">{prospect.next_action}</span>
            </div>
            {prospect.next_action_at && (
              <div className="text-xs text-muted-foreground mt-1">
                {format(parseISO(prospect.next_action_at), 'EEEE d MMMM', { locale: fr })}
              </div>
            )}
          </div>
        )}

        {(isFollowupDue || needsPlanning) && (
          <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-4 w-4" />
            <span>{needsPlanning ? 'Action à planifier' : 'Relance due'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
