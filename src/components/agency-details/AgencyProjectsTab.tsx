import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface AgencyProjectsTabProps {
  agencyId: string;
}

export function AgencyProjectsTab({ agencyId }: AgencyProjectsTabProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { role } = useUserRole();

  useEffect(() => {
    fetchProjects();
  }, [agencyId, user, role]);

  const fetchProjects = async () => {
    try {
      // Get all projects linked to this agency
      const { data: agencyProjects, error: agencyError } = await supabase
        .from('project_agencies')
        .select(`
          project_id,
          projects (
            id,
            name,
            description,
            status,
            start_date,
            end_date,
            created_at
          )
        `)
        .eq('agency_id', agencyId);

      if (agencyError) throw agencyError;
      
      let projectsData = agencyProjects?.map((item: any) => item.projects).filter(Boolean) || [];

      // If user is a client, filter to only show projects linked to their client record
      if (role === 'client' && user) {
        // Get the user's email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single();

        if (profile?.email) {
          // Get the client ID for this email
          const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('email', profile.email)
            .maybeSingle();

          if (client) {
            // Get project IDs linked to this client
            const { data: clientProjects } = await supabase
              .from('project_clients')
              .select('project_id')
              .eq('client_id', client.id);

            const clientProjectIds = clientProjects?.map(cp => cp.project_id) || [];
            
            // Filter to only show projects that are also linked to the client
            projectsData = projectsData.filter(p => clientProjectIds.includes(p.id));
          } else {
            // No client found for this user, show no projects
            projectsData = [];
          }
        }
      }

      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Aucun projet associé à cette agence pour le moment
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      active: 'default',
      completed: 'secondary',
      planning: 'outline',
    };
    const labels: Record<string, string> = {
      active: 'En cours',
      completed: 'Terminé',
      planning: 'À faire',
      reco_in_progress: 'Reco en cours',
      lost: 'Perdu',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription className="mt-2">{project.description}</CardDescription>
                  )}
                </div>
                {getStatusBadge(project.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.start_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Début: {format(new Date(project.start_date), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              )}
              {project.end_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Fin: {format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
