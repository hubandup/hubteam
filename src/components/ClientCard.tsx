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
    active: boolean;
    created_at: string;
  };
  onClick: () => void;
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {client.first_name} {client.last_name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Building2 className="h-3 w-3" />
              {client.company}
            </CardDescription>
          </div>
          <Badge variant={client.active ? 'default' : 'secondary'}>
            {client.active ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
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
        {client.last_contact && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Dernier contact: {format(new Date(client.last_contact), 'dd MMM yyyy', { locale: fr })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
