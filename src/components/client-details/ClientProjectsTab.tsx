import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Loader2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClientProjectsTabProps {
  clientId: string;
}

export function ClientProjectsTab({ clientId }: ClientProjectsTabProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, [clientId]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('project_clients')
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
        .eq('client_id', clientId);

      if (error) throw error;
      
      const projectsData = data?.map((item: any) => item.projects).filter(Boolean) || [];
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
            Aucun projet associé à ce client pour le moment
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
      planning: 'Planification',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const isProjectOverdue = (project: any) => {
    return project.end_date && 
           project.status !== 'completed' && 
           isPast(new Date(project.end_date));
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((project) => (
        <Card 
          key={project.id} 
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => navigate(`/project/${project.id}`)}
        >
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
              <div className={`flex items-center gap-2 text-sm ${isProjectOverdue(project) ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                <Calendar className="h-4 w-4" />
                <span>
                  Fin: {format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
                  {isProjectOverdue(project) && ' (En retard)'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
