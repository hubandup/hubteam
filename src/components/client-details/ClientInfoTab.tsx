import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, DollarSign, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditClientDialog } from '@/components/EditClientDialog';

interface ClientInfoTabProps {
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
    logo_url?: string;
  };
  onUpdate: () => void;
}

export function ClientInfoTab({ client, onUpdate }: ClientInfoTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <EditClientDialog client={client} onClientUpdated={onUpdate} />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Entreprise</p>
              <p className="font-medium">{client.company}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
          </div>

          {client.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="font-medium">{client.phone}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Client depuis</p>
              <p className="font-medium">
                {format(new Date(client.created_at), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Statistiques</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-success mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Chiffre d'affaires</p>
              <p className="text-2xl font-bold text-success">
                {client.revenue.toLocaleString('fr-FR')} €
              </p>
            </div>
          </div>

          {client.last_contact && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Dernier contact</p>
                <p className="font-medium">
                  {format(new Date(client.last_contact), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-2">Statut</p>
            <Badge variant={client.active ? 'default' : 'secondary'}>
              {client.active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
