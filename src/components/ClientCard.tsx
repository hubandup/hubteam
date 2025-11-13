import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, DollarSign, Calendar, BellRing } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  };
  onClick: () => void;
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow relative" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {client.logo_url && (
              <img 
                src={client.logo_url} 
                alt={`${client.company} logo`}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">
                {client.company}
              </CardTitle>
              <CardDescription className="mt-1 truncate">
                {client.first_name} {client.last_name}
              </CardDescription>
              {(client.action_name || client.action) && (
                <Badge 
                  className="mt-2 text-xs"
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
      <CardContent className="space-y-2 pb-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span className="truncate">{client.email}</span>
        </div>
        {client.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{client.phone}</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <DollarSign className="h-4 w-4" />
            <span>
              {client.revenue_current_year !== undefined && client.revenue_current_year !== null 
                ? client.revenue_current_year.toLocaleString('fr-FR')
                : client.revenue.toLocaleString('fr-FR')
              } €
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
            <span>Année fiscale</span>
          </div>
        </div>
      </CardContent>
      
      <div className="absolute bottom-3 left-6 right-6 space-y-2">
        {client.last_contact && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            <span className="font-medium">Dernier contact:</span>
            <span>{format(new Date(client.last_contact), 'dd/MM/yyyy')}</span>
          </div>
        )}
        {client.follow_up_date && (
          <div className={`flex items-center gap-2 text-xs ${
            isPast(new Date(client.follow_up_date)) 
              ? 'text-red-600 dark:text-red-500' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <BellRing className="h-3 w-3" />
            <span className="font-medium">Date de rappel:</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                isPast(new Date(client.follow_up_date))
                  ? 'border-red-500 text-red-600 dark:text-red-500'
                  : 'border-gray-300 text-gray-600 dark:text-gray-400'
              }`}
            >
              {format(new Date(client.follow_up_date), 'dd/MM/yyyy')}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
