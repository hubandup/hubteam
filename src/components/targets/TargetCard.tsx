import { useState } from 'react';
import { AlertCircle, Mail, Phone, Clock, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import {
  getUrgency,
  getStatusBucket,
  getStatusStyle,
  getLogoFallback,
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

  const [logoError, setLogoError] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const urgency = getUrgency(client.follow_up_date);
  const statusBucket = getStatusBucket(client.kanban_stage, client.follow_up_date);
  const statusStyle = getStatusStyle(statusBucket);
  const fallback = getLogoFallback(client.company);

  const ca = client.revenue_current_year ?? client.revenue ?? 0;
  const showCa = showRevenue && statusBucket === 'client' && Number(ca) > 0;

  const contactName = `${client.first_name || ''} ${client.last_name || ''}`.trim();

  const handleUnpin = (e: Event) => {
    e.preventDefault();
    setConfirmRemove(true);
  };

  return (
    <>
      <div
        className="group relative bg-white border border-neutral-200 hover:border-neutral-400 transition-colors cursor-pointer"
        onClick={onClick}
      >
        {/* Badge urgence */}
        {urgency.bucket !== 'none' && (
          <div
            className="px-4 pt-3 pb-2 flex items-center gap-1.5 text-[11px] font-semibold font-roboto"
            style={{ color: URGENCY_TEXT_COLOR[urgency.bucket] }}
          >
            <AlertCircle size={12} strokeWidth={2.5} />
            <span>{urgency.label}</span>
          </div>
        )}

        {/* Header */}
        <div className={`px-4 pb-4 ${urgency.bucket === 'none' ? 'pt-3' : ''}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Logo */}
              <div
                className="w-14 h-14 shrink-0 border border-neutral-200 bg-white p-1.5 flex items-center justify-center overflow-hidden"
                style={
                  !client.logo_url || logoError
                    ? { background: fallback.bg, borderColor: 'rgba(0,0,0,0.06)' }
                    : undefined
                }
              >
                {client.logo_url && !logoError ? (
                  <img
                    src={client.logo_url}
                    alt={`${client.company} logo`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span
                    className="font-display font-bold text-base"
                    style={{ color: fallback.text }}
                  >
                    {fallback.initials}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="font-display font-bold text-sm leading-tight truncate"
                  style={{ color: '#0f1422' }}
                  title={client.company}
                >
                  {client.company}
                </div>
                {contactName && (
                  <div className="text-xs text-neutral-600 truncate mt-0.5 font-roboto">
                    {contactName}
                  </div>
                )}
              </div>
            </div>

            {/* Menu */}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 hover:bg-neutral-100"
                    aria-label="Actions"
                  >
                    <MoreHorizontal size={14} className="text-neutral-600" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-none">
                  <DropdownMenuItem onSelect={() => onClick()}>
                    Voir la fiche
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleUnpin} className="text-destructive">
                    Désépingler
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Statut pipeline */}
          <div className="mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider font-roboto"
              style={{ background: statusStyle.bg, color: statusStyle.text }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: statusStyle.dot }}
              />
              {statusStyle.label}
            </span>
          </div>

          {/* Infos contact */}
          <div className="space-y-1 text-xs text-neutral-600 mb-3 font-roboto">
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail size={11} className="text-neutral-400 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone size={11} className="text-neutral-400 shrink-0" />
                <span className="truncate">{client.phone}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] font-roboto">
            <div className="flex items-center gap-1.5 min-w-0">
              {client.last_contact ? (
                <>
                  <Clock size={10} className="text-neutral-400 shrink-0" />
                  <span className="text-neutral-400">Contact</span>
                  <span className="font-semibold text-neutral-600 truncate">
                    {formatShortFrDate(client.last_contact)}
                  </span>
                </>
              ) : (
                <span className="italic text-neutral-400">Jamais contacté</span>
              )}
            </div>
            {showCa && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-semibold text-neutral-700">{formatCa(Number(ca))}</span>
                <span className="text-neutral-400 font-normal">CA</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm unpin */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Désépingler ce target ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment retirer <strong>{client.company}</strong> de votre liste Targets ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
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

      {/* Edit dialog */}
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
