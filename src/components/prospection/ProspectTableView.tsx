import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Prospect, ProspectStatus, PROSPECT_STATUSES } from '@/hooks/useProspects';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MoreHorizontal, Phone, Calendar, AlertTriangle, CheckCircle, XCircle, Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ProspectCard } from './ProspectCard';

interface ProspectTableViewProps {
  prospects: Prospect[];
  onProspectClick: (prospectId: string) => void;
  onQuickAction: (prospectId: string, action: 'contacted' | 'schedule' | 'interaction' | 'won' | 'lost') => void;
}

export function ProspectTableView({ prospects, onProspectClick, onQuickAction }: ProspectTableViewProps) {
  const isMobile = useIsMobile();

  const priorityColors = {
    A: 'bg-red-500 text-white',
    B: 'bg-yellow-500 text-white',
    C: 'bg-green-500 text-white',
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {prospects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            onClick={() => onProspectClick(prospect.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Entreprise</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-center">Priorité</TableHead>
          <TableHead>Prochaine action</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead className="text-center">%</TableHead>
          <TableHead className="text-right">Pondéré</TableHead>
          <TableHead className="text-center">Relance</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prospects.map((prospect) => {
          const statusConfig = PROSPECT_STATUSES.find(s => s.value === prospect.status);
          const weightedRevenue = prospect.estimated_amount * prospect.probability;
          
          const isFollowupDue = prospect.next_action_at && 
            !['Gagné', 'Perdu'].includes(prospect.status) &&
            (isToday(parseISO(prospect.next_action_at)) || isPast(parseISO(prospect.next_action_at)));

          const needsPlanning = !['Gagné', 'Perdu', 'En veille'].includes(prospect.status) && 
            (!prospect.next_action || !prospect.next_action_at);

          return (
            <TableRow 
              key={prospect.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onProspectClick(prospect.id)}
            >
              <TableCell className="font-medium">{prospect.company_name}</TableCell>
              <TableCell>{prospect.contact_name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {prospect.channel}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusConfig?.color}>
                  {prospect.status}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge className={priorityColors[prospect.priority]}>
                  {prospect.priority}
                </Badge>
              </TableCell>
              <TableCell>
                {prospect.next_action ? (
                  <span className="text-sm">{prospect.next_action}</span>
                ) : (
                  <span className="text-muted-foreground text-sm italic">À définir</span>
                )}
              </TableCell>
              <TableCell>
                {prospect.next_action_at ? (
                  <span className={`text-sm ${isFollowupDue ? 'text-orange-600 font-medium' : ''}`}>
                    {format(parseISO(prospect.next_action_at), 'dd/MM/yyyy', { locale: fr })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {prospect.estimated_amount > 0 ? (
                  `${prospect.estimated_amount.toLocaleString('fr-FR')} €`
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {Math.round(prospect.probability * 100)}%
              </TableCell>
              <TableCell className="text-right font-medium">
                {weightedRevenue > 0 ? (
                  `${weightedRevenue.toLocaleString('fr-FR')} €`
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {isFollowupDue && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Due
                  </Badge>
                )}
                {needsPlanning && !isFollowupDue && (
                  <Badge variant="secondary" className="text-xs text-orange-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    À planifier
                  </Badge>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onQuickAction(prospect.id, 'contacted')}>
                      <Phone className="h-4 w-4 mr-2" />
                      Marquer contacté
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onQuickAction(prospect.id, 'schedule')}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Planifier relance
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onQuickAction(prospect.id, 'interaction')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter interaction
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onQuickAction(prospect.id, 'won')}
                      className="text-green-600"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Gagné
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onQuickAction(prospect.id, 'lost')}
                      className="text-red-600"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Perdu
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
