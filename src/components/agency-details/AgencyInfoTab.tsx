import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Euro, Calendar, Building2, FolderOpen, FolderKanban } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditAgencyDialog } from '@/components/EditAgencyDialog';
import { AgencyContactsManager } from './AgencyContactsManager';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProtectedAction } from '@/components/ProtectedAction';
import { AgencyKDriveFolderSelector } from './AgencyKDriveFolderSelector';
import { supabase } from '@/integrations/supabase/client';

interface AgencyInfoTabProps {
  agency: {
    id: string;
    name: string;
    contact_email?: string;
    contact_phone?: string;
    revenue: number;
    active: boolean;
    created_at: string;
    logo_url?: string;
    kdrive_drive_id?: number;
    kdrive_folder_id?: string;
    kdrive_folder_path?: string;
  };
  onUpdate: () => void;
}

export function AgencyInfoTab({ agency, onUpdate }: AgencyInfoTabProps) {
  const [projectStats, setProjectStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    lost: 0,
  });

  useEffect(() => {
    const fetchProjectStats = async () => {
      const { data: projectAgencies } = await supabase
        .from('project_agencies')
        .select('project_id')
        .eq('agency_id', agency.id);

      if (!projectAgencies) return;

      const projectIds = projectAgencies.map(pa => pa.project_id);
      
      if (projectIds.length === 0) {
        setProjectStats({ total: 0, active: 0, completed: 0, lost: 0 });
        return;
      }

      const { data: projects } = await supabase
        .from('projects')
        .select('status')
        .in('id', projectIds);

      if (!projects) return;

      const stats = {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        lost: projects.filter(p => p.status === 'lost').length,
      };

      setProjectStats(stats);
    };

    fetchProjectStats();
  }, [agency.id]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ProtectedAction module="agencies" action="update">
          <EditAgencyDialog agency={agency} onAgencyUpdated={onUpdate} />
        </ProtectedAction>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {agency.logo_url && (
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={agency.logo_url} alt={agency.name} />
                  <AvatarFallback>{agency.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            )}
            
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
              <FolderKanban className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Projets totaux</p>
                <p className="text-2xl font-bold">{projectStats.total}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FolderKanban className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Projets en cours</p>
                <p className="text-2xl font-bold text-blue-500">{projectStats.active}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FolderKanban className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Projets terminés</p>
                <p className="text-2xl font-bold text-success">{projectStats.completed}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FolderKanban className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Projets perdus</p>
                <p className="text-2xl font-bold text-destructive">{projectStats.lost}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Euro className="h-5 w-5 text-success mt-0.5" />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Dossier KDrive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AgencyKDriveFolderSelector
            agencyId={agency.id}
            agencyName={agency.name}
            currentDriveId={agency.kdrive_drive_id}
            currentFolderId={agency.kdrive_folder_id}
            currentFolderPath={agency.kdrive_folder_path}
            onFolderConnected={onUpdate}
          />
        </CardContent>
      </Card>

      <AgencyContactsManager agencyId={agency.id} />
    </div>
  );
}
