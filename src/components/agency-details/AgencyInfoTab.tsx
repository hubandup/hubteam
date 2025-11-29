import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Building2, FolderKanban, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditAgencyDialog } from '@/components/EditAgencyDialog';
import { AgencyContactsManager } from './AgencyContactsManager';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProtectedAction } from '@/components/ProtectedAction';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

// Fonction pour générer une couleur cohérente basée sur une chaîne
function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 50%)`;
}

interface AgencyInfoTabProps {
  agency: {
    id: string;
    name: string;
    active: boolean;
    created_at: string;
    logo_url?: string;
    kdrive_drive_id?: number;
    kdrive_folder_id?: string;
    kdrive_folder_path?: string;
    description?: string;
    tags?: string[];
    main_contact_id?: string | null;
  };
  onUpdate: () => void;
}

export function AgencyInfoTab({ agency, onUpdate }: AgencyInfoTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  const [projectStats, setProjectStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    lost: 0,
  });
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [isAgencyMember, setIsAgencyMember] = useState(false);

  useEffect(() => {
    const checkAgencyMembership = async () => {
      if (!user || role !== 'agency') {
        setIsAgencyMember(false);
        return;
      }

      const { data, error } = await supabase
        .from('agency_members')
        .select('id')
        .eq('agency_id', agency.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsAgencyMember(!!data && !error);
    };

    checkAgencyMembership();
  }, [user, role, agency.id]);

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
        .select('id, name, status')
        .in('id', projectIds);

      if (!projects) return;

      // Projets "en cours" = active, reco_in_progress, planning
      const inProgressStatuses = ['active', 'reco_in_progress', 'planning'];
      const activeProjectsList = projects.filter(p => inProgressStatuses.includes(p.status));
      
      const stats = {
        total: projects.length,
        active: activeProjectsList.length,
        completed: projects.filter(p => p.status === 'completed').length,
        lost: projects.filter(p => p.status === 'lost').length,
      };

      setProjectStats(stats);
      setActiveProjects(activeProjectsList);
    };

    const fetchTagColors = async () => {
      const { data: agencyTags } = await supabase
        .from('agency_tags')
        .select('name, color');
      
      const colors: Record<string, string> = {};
      
      if (agencyTags && agencyTags.length > 0) {
        agencyTags.forEach(tag => {
          colors[tag.name] = tag.color;
        });
      }
      
      // Générer des couleurs par défaut pour les tags sans couleur prédéfinie
      agency.tags?.forEach(tag => {
        if (!colors[tag]) {
          colors[tag] = generateColorFromString(tag);
        }
      });
      
      setTagColors(colors);
    };

    fetchProjectStats();
    fetchTagColors();
  }, [agency.id]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {/* Show edit button only for admin/team OR agency members of this specific agency */}
        {(role === 'admin' || role === 'team' || (role === 'agency' && isAgencyMember)) && (
          <ProtectedAction module="agencies" action="update">
            <EditAgencyDialog agency={agency} onAgencyUpdated={onUpdate} />
          </ProtectedAction>
        )}
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

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Partenaire depuis</p>
                <p className="font-medium">
                  {format(new Date(agency.created_at), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>

            {agency.description && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <div 
                    className="font-medium prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: agency.description }}
                  />
                </div>
              </div>
            )}

            {agency.tags && agency.tags.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Expertises</p>
                <div className="flex flex-wrap gap-2">
                  {agency.tags.map((tag) => {
                    const color = tagColors[tag];
                    return (
                      <Badge 
                        key={tag} 
                        style={color ? { 
                          backgroundColor: color,
                          color: 'white',
                          borderColor: color
                        } : undefined}
                        variant={color ? "default" : "secondary"}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {activeProjects.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Projets en cours</h4>
                <div className="space-y-2">
                  {activeProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <FolderKanban className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{project.name}</span>
                      </div>
                      <Badge variant="default" className="bg-blue-500 text-xs">
                        En cours
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AgencyContactsManager agencyId={agency.id} mainContactId={agency.main_contact_id} />
    </div>
  );
}
