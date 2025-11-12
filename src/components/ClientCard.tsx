import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';
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
    last_contact?: string;
    follow_up_date?: string;
    active: boolean;
    created_at: string;
    logo_url?: string;
    kanban_stage?: string;
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
              {client.kanban_stage && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {client.kanban_stage}
                </Badge>
              )}
            </div>
          </div>
          <Badge 
            variant={client.active ? 'default' : 'secondary'} 
            className={`flex-shrink-0 ${client.active ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
          >
            {client.active ? 'Actif' : 'Inactif'}
          </Badge>
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
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <DollarSign className="h-4 w-4" />
          <span>{client.revenue.toLocaleString('fr-FR')} €</span>
        </div>
      </CardContent>
      
      <div className="absolute bottom-3 left-6 right-6 space-y-2">
        {client.last_contact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span className="font-medium">Dernier contact:</span>
            <span>{format(new Date(client.last_contact), 'dd/MM/yyyy')}</span>
          </div>
        )}
        {client.follow_up_date && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3 w-3" />
            <span className="font-medium">Date de rappel:</span>
            <Badge variant="outline" className="text-xs">
              {format(new Date(client.follow_up_date), 'dd/MM/yyyy')}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
