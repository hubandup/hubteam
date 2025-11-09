import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
    start_date?: string;
    end_date?: string;
    created_at: string;
    project_clients?: Array<{
      clients: {
        company: string;
      };
    }>;
  };
  onClick: () => void;
}

const statusConfig = {
  active: { label: 'Actif', variant: 'default' as const },
  pending: { label: 'En attente', variant: 'secondary' as const },
  completed: { label: 'Terminé', variant: 'outline' as const },
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusInfo = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active;
  const clientName = project.project_clients?.[0]?.clients?.company || 'Sans client';

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <FolderKanban className="h-10 w-10 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">
                {project.name}
              </CardTitle>
              <CardDescription className="mt-1 truncate flex items-center gap-1">
                <Users className="h-3 w-3" />
                {clientName}
              </CardDescription>
            </div>
          </div>
          <Badge variant={statusInfo.variant} className="flex-shrink-0">
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}
        {(project.start_date || project.end_date) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {project.start_date && format(new Date(project.start_date), 'dd MMM yyyy', { locale: fr })}
              {project.start_date && project.end_date && ' - '}
              {project.end_date && format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
