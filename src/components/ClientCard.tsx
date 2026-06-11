import { useState } from 'react';
import { Star, FolderOpen, Clock } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { useUserRole } from '@/hooks/useUserRole';
import { useTargets, useToggleTarget } from '@/hooks/useTargets';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EntityCard } from '@/components/layout';
import { URGENCY_TOKENS } from '@/lib/design-tokens';
import {
  getUrgency,
  getStatusBucket,
  getStatusStyle,
  formatShortFrDate,
  formatCa,
} from '@/components/targets/targetUtils';

interface ClientCardProps {
  client: {
    id: string;
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone?: string;
    revenue: number;
    revenue_current_year?: number;
    last_contact?: string;
    follow_up_date?: string;
    active: boolean;
    created_at: string;
    logo_url?: string;
    kanban_stage?: string;
    action?: string;
    action_name?: string;
    action_color?: string;
    kdrive_folder_id?: string;
  };
  onClick: () => void;
  onMouseEnter?: () => void;
}


export function ClientCard({ client, onClick, onMouseEnter }: ClientCardProps) {
  const { isAgency, loading: roleLoading } = useUserRole();
  const showRevenue = !roleLoading && !isAgency;
  const { data: targets } = useTargets();
  const toggleTarget = useToggleTarget();
  const isStarred = !!targets?.has(client.id);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isStarred) {
      setConfirmRemove(true);
    } else {
      toggleTarget.mutate({ clientId: client.id, starred: false });
    }
  };

  const urgency = getUrgency(client.follow_up_date);
  const statusBucket = getStatusBucket(client.kanban_stage, client.follow_up_date);
  const statusStyle = getStatusStyle(statusBucket);

  const ca = client.revenue_current_year ?? client.revenue ?? 0;
  const showCa = showRevenue && Number(ca) > 0;
  const contactName = `${client.first_name || ''} ${client.last_name || ''}`.trim();

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={handleStarClick}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-10 p-1 rounded-button hover:bg-accent transition-colors"
          title={isStarred ? 'Retirer des Targets' : 'Ajouter aux Targets'}
          aria-label="Toggle target"
        >
          <Star
            className={cn(
              'h-4 w-4 transition-colors',
              isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground',
            )}
          />
        </button>

        <EntityCard
          title={client.company}
          subtitle={contactName || undefined}
          logoUrl={client.logo_url}
          logoTitleAdornment={
            client.kdrive_folder_id ? (
              <div title="Connecté à kDrive">
                <FolderOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              </div>
            ) : undefined
          }
          alert={
            urgency.bucket !== 'none'
              ? { label: urgency.label, color: URGENCY_TOKENS[urgency.bucket] }
              : undefined
          }
          status={statusStyle}
          email={client.email}
          phone={client.phone}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          footerLeft={
            client.last_contact ? (
              <>
                <Clock size={10} className="text-muted-foreground shrink-0 opacity-70" />
                <span className="text-muted-foreground">Contact</span>
                <span className="font-semibold text-foreground truncate">
                  {formatShortFrDate(client.last_contact)}
                </span>
              </>
            ) : (
              <span className="italic text-muted-foreground">Jamais contacté</span>
            )
          }
          footerRight={
            showCa ? (
              <>
                <span className="font-semibold text-foreground">{formatCa(Number(ca))}</span>
                <span className="text-muted-foreground font-normal">CA</span>
              </>
            ) : client.follow_up_date && isPast(new Date(client.follow_up_date)) ? (
              <span className="text-destructive font-semibold">
                Échéance {format(new Date(client.follow_up_date), 'dd/MM')}
              </span>
            ) : undefined
          }
        />
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer des Targets ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment retirer <strong>{client.company}</strong> de votre liste Targets ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toggleTarget.mutate({ clientId: client.id, starred: true });
                setConfirmRemove(false);
              }}
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
