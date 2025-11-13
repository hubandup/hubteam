import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, Euro } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AgencyCardProps {
  agency: {
    id: string;
    name: string;
    contact_email?: string;
    contact_phone?: string;
    revenue: number;
    active: boolean;
    created_at: string;
    logo_url?: string;
  };
  onClick: () => void;
}

export function AgencyCard({ agency, onClick }: AgencyCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {agency.logo_url ? (
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={agency.logo_url} alt={agency.name} />
                <AvatarFallback>{agency.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ) : (
              <Building2 className="h-12 w-12 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">
                {agency.name}
              </CardTitle>
              <CardDescription className="mt-1">
                Agence partenaire
              </CardDescription>
            </div>
          </div>
          <Badge variant={agency.active ? 'default' : 'secondary'} className="flex-shrink-0">
            {agency.active ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {agency.contact_email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="truncate">{agency.contact_email}</span>
          </div>
        )}
        {agency.contact_phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{agency.contact_phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <Euro className="h-4 w-4" />
          <span>{agency.revenue.toLocaleString('fr-FR')} €</span>
        </div>
      </CardContent>
    </Card>
  );
}
