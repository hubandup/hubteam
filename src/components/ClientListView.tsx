import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, Euro, FolderOpen } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface ClientListViewProps {
  clients: any[];
  onClientClick: (id: string) => void;
}

export function ClientListView({ clients, onClientClick }: ClientListViewProps) {
  const { isAgency, loading: roleLoading } = useUserRole();
  const showRevenue = !roleLoading && !isAgency;
  return (
    <div className="space-y-2">
      {clients.map((client) => {
        const stageLabelMap: Record<string, string> = {
          prospect: 'Prospect',
          negotiation: 'Négociation',
          active: 'Client actif',
          inactive: 'Inactif',
        };
        
        const stageColorMap: Record<string, string> = {
          prospect: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
          negotiation: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
          active: 'bg-green-500/10 text-green-600 border-green-500/20',
          inactive: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
        };

        const stageLabel = stageLabelMap[client.kanban_stage] || client.kanban_stage;
        const stageColor = stageColorMap[client.kanban_stage] || 'bg-muted text-muted-foreground';

        return (
          <div
            key={client.id}
            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onClientClick(client.id)}
          >
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={client.logo_url} alt={client.company} />
              <AvatarFallback>
                <Building2 className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold truncate uppercase">{client.company}</h3>
                  {client.kdrive_folder_id && (
                    <div title="Connecté à kDrive">
                      <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {client.first_name} {client.last_name}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {client.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showRevenue && client.revenue_current_year !== null && client.revenue_current_year !== undefined && (
              <div className="flex items-center gap-2 text-sm flex-shrink-0 text-muted-foreground font-medium">
                <Euro className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'EUR',
                    maximumFractionDigits: 0
                  }).format(client.revenue_current_year)}
                </span>
              </div>
            )}

            <Badge className={`flex-shrink-0 ${stageColor}`}>
              {stageLabel}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
