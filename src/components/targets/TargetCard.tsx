import { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
import { useToggleTarget } from '@/hooks/useTargets';
import { useUserRole } from '@/hooks/useUserRole';
import { EditClientDialog } from '@/components/EditClientDialog';
import { EntityCard } from '@/components/layout';
import {
  getUrgency,
  getStatusBucket,
  getStatusStyle,
  formatShortFrDate,
  formatCa,
  type UrgencyBucket,
} from './targetUtils';

interface TargetClient {
  id: string;
  company: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  logo_url?: string | null;
  kanban_stage?: string | null;
  follow_up_date?: string | null;
  last_contact?: string | null;
  revenue?: number | null;
  revenue_current_year?: number | null;
}

interface TargetCardProps {
  client: TargetClient;
  onClick: () => void;
  onEdited?: () => void;
}

const URGENCY_TEXT_COLOR: Record<UrgencyBucket, string> = {
  late: '#DC2626',
  week: '#EA580C',
  month: '#65748B',
  none: '',
};

export function TargetCard({ client, onClick, onEdited }: TargetCardProps) {
  const { isAgency, loading: roleLoading } = useUserRole();
  const showRevenue = !roleLoading && !isAgency;
  const toggleTarget = useToggleTarget();

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const urgency = getUrgency(client.follow_up_date);
  const statusBucket = getStatusBucket(client.kanban_stage, client.follow_up_date);
  const statusStyle = getStatusStyle(statusBucket);

  const ca = client.revenue_current_year ?? client.revenue ?? 0;
  const showCa = showRevenue && statusBucket === 'client' && Number(ca) > 0;
  const contactName = `${client.first_name || ''} ${client.last_name || ''}`.trim();

  return (
    <>
      <EntityCard
        title={client.company}
        subtitle={contactName || undefined}
        logoUrl={client.logo_url}
        alert={
          urgency.bucket !== 'none'
            ? { label: urgency.label, color: URGENCY_TEXT_COLOR[urgency.bucket] }
            : undefined
        }
        status={statusStyle}
        email={client.email}
        phone={client.phone || undefined}
        onClick={onClick}
        actions={
          <>
            <DropdownMenuItem onSelect={() => onClick()}>Voir la fiche</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>Modifier</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setConfirmRemove(true);
              }}
              className="text-destructive"
            >
              Désépingler
            </DropdownMenuItem>
          </>
        }
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
          ) : undefined
        }
      />

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désépingler ce target ?</AlertDialogTitle>
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
              Désépingler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editOpen && (
        <EditClientDialog
          client={client as any}
          open={editOpen}
          onOpenChange={setEditOpen}
          hideTrigger
          onClientUpdated={() => {
            onEdited?.();
            setEditOpen(false);
          }}
        />
      )}
    </>
  );
}
