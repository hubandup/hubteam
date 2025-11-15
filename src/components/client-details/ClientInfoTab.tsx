import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Euro, Calendar, Building2, Briefcase, TrendingUp, Award, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditClientDialog } from '@/components/EditClientDialog';
import { supabase } from '@/integrations/supabase/client';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useIsMobile } from '@/hooks/use-mobile';
import { ClientContactsManager } from './ClientContactsManager';
import { KDriveFolderSelector } from './KDriveFolderSelector';

interface ClientInfoTabProps {
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
    active: boolean;
    created_at: string;
    logo_url?: string;
    activity_sector_id?: string;
    status_id?: string;
    follow_up_date?: string;
    kanban_stage: string;
    kdrive_drive_id?: number;
    kdrive_folder_id?: string;
    kdrive_folder_path?: string;
  };
  onUpdate: () => void;
}

export function ClientInfoTab({ client, onUpdate }: ClientInfoTabProps) {
  const isMobile = useIsMobile();
  const [activitySector, setActivitySector] = useState<any>(null);
  const [clientStatus, setClientStatus] = useState<any>(null);
  const [clientRanking, setClientRanking] = useState<number | null>(null);

  useEffect(() => {
    fetchSectorAndStatus();
    fetchClientRanking();
  }, [client]);

  const fetchSectorAndStatus = async () => {
    if (client.activity_sector_id) {
      const { data } = await supabase
        .from('activity_sectors')
        .select('*')
        .eq('id', client.activity_sector_id)
        .single();
      setActivitySector(data);
    }

    if (client.status_id) {
      const { data } = await supabase
        .from('client_statuses')
        .select('*')
        .eq('id', client.status_id)
        .single();
      setClientStatus(data);
    }
  };

  const fetchClientRanking = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, revenue')
      .order('revenue', { ascending: false });

    if (data) {
      const rank = data.findIndex(c => c.id === client.id) + 1;
      setClientRanking(rank);
    }
  };

  return (
    <div className="space-y-6">
      {!isMobile && (
        <div className="flex justify-end gap-2">
          {client.kdrive_drive_id && client.kdrive_folder_id && (
            <Button
              variant="outline"
              onClick={() => window.open(`https://kdrive.infomaniak.com/app/drive/${client.kdrive_drive_id}/files/${client.kdrive_folder_id}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir dans KDrive
            </Button>
          )}
          <ProtectedAction module="crm" action="update">
            <EditClientDialog client={client} onClientUpdated={onUpdate} />
          </ProtectedAction>
        </div>
      )}
      
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
              <p className="font-medium uppercase">{client.company}</p>
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

          {activitySector && (
            <div className="flex items-start gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Secteur d'activité</p>
                <Badge style={{ backgroundColor: activitySector.color, color: 'white' }}>
                  {activitySector.name}
                </Badge>
              </div>
            </div>
          )}

          {clientStatus && (
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Action</p>
                <Badge style={{ backgroundColor: clientStatus.color, color: 'white' }}>
                  {clientStatus.name}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isMobile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Euro className="h-5 w-5 text-success mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Chiffre d'affaires total</p>
                <p className="text-2xl font-bold text-success">
                  {client.revenue.toLocaleString('fr-FR')} € HT
                </p>
                {client.revenue_current_year !== undefined && client.revenue_current_year !== null && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm text-muted-foreground">Année fiscale en cours (avril - mars)</p>
                    <p className="text-lg font-semibold text-primary">
                      {client.revenue_current_year.toLocaleString('fr-FR')} € HT
                    </p>
                  </div>
                )}
              </div>
            </div>

            {clientRanking && (
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Classement CA</p>
                  <p className="text-xl font-bold text-primary">
                    #{clientRanking}
                  </p>
                </div>
              </div>
            )}

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
      )}
      </div>

      <ClientContactsManager clientId={client.id} />
    </div>
  );
}
