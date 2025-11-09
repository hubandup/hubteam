import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, DollarSign, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditAgencyDialog } from '@/components/EditAgencyDialog';

interface AgencyInfoTabProps {
  agency: {
    id: string;
    name: string;
    contact_email?: string;
    contact_phone?: string;
    revenue: number;
    active: boolean;
    created_at: string;
  };
  onUpdate: () => void;
}

export function AgencyInfoTab({ agency, onUpdate }: AgencyInfoTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <EditAgencyDialog agency={agency} onAgencyUpdated={onUpdate} />
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
                <p className="text-sm text-muted-foreground">Nom de l'agence</p>
                <p className="font-medium">{agency.name}</p>
              </div>
            </div>

            {agency.contact_email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email de contact</p>
                  <p className="font-medium">{agency.contact_email}</p>
                </div>
              </div>
            )}

            {agency.contact_phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{agency.contact_phone}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Partenaire depuis</p>
                <p className="font-medium">
                  {format(new Date(agency.created_at), 'dd MMMM yyyy', { locale: fr })}
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
                <p className="text-sm text-muted-foreground">Chiffre d'affaires généré</p>
                <p className="text-2xl font-bold text-success">
                  {agency.revenue.toLocaleString('fr-FR')} €
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Statut</p>
              <Badge variant={agency.active ? 'default' : 'secondary'}>
                {agency.active ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
