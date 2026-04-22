import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, Euro, Calendar, BellRing, FolderOpen, Star } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
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
}

export function ClientCard({ client, onClick }: ClientCardProps) {
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

  const confirmAndRemove = () => {
    toggleTarget.mutate({ clientId: client.id, starred: true });
    setConfirmRemove(false);
  };

  return (
    <>
    <Card className="cursor-pointer hover:shadow-lg transition-shadow relative" onClick={onClick}>
      <button
        type="button"
        onClick={handleStarClick}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-accent transition-colors"
        title={isStarred ? 'Retirer des Targets' : 'Ajouter aux Targets'}
        aria-label="Toggle target"
      >
        <Star
          className={cn(
            'h-4 w-4 transition-colors',
            isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          )}
        />
      </button>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {client.logo_url && (
              <img 
                src={client.logo_url} 
                alt={`${client.company} logo`}
                className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-base md:text-lg uppercase truncate">
                  {client.company}
                </CardTitle>
                {client.kdrive_folder_id && (
                  <div title="Connecté à kDrive">
                    <FolderOpen className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary flex-shrink-0" />
                  </div>
                )}
              </div>
              <CardDescription className="mt-0.5 truncate text-xs md:text-sm">
                {client.first_name} {client.last_name}
              </CardDescription>
              {(client.action_name || client.action) && (
                <Badge 
                  className="mt-1.5 text-xs"
                  style={client.action_color ? {
                    backgroundColor: client.action_color,
                    color: 'white',
                  } : undefined}
                >
                  {client.action_name || client.action}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-16 md:pb-20">
        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
          <span className="truncate">{client.email}</span>
        </div>
        {client.phone && (
          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span>{client.phone}</span>
          </div>
        )}
        {showRevenue && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-success">
              <Euro className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
              <span>
                {client.revenue_current_year !== undefined && client.revenue_current_year !== null 
                  ? client.revenue_current_year.toLocaleString('fr-FR')
                  : client.revenue.toLocaleString('fr-FR')
                } €
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5 md:ml-6">
              <span>Année fiscale</span>
            </div>
          </div>
        )}
      </CardContent>
      
      <div className="absolute bottom-2 md:bottom-3 left-3 md:left-6 right-3 md:right-6 space-y-1">
        {client.last_contact && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">Dernier contact:</span>
            <span className="truncate">{format(new Date(client.last_contact), 'dd/MM/yyyy')}</span>
          </div>
        )}
        {client.follow_up_date && (
          <div className={`flex items-center gap-1.5 text-xs ${
            isPast(new Date(client.follow_up_date)) 
              ? 'text-red-600 dark:text-red-500' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <BellRing className={`h-3 w-3 flex-shrink-0 ${isPast(new Date(client.follow_up_date)) ? 'animate-pulse' : ''}`} />
            <span className="font-medium">Prochaine échéance:</span>
            <span className="truncate">{format(new Date(client.follow_up_date), 'dd/MM/yyyy')}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
