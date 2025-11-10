import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FolderKanban, Calendar, Building2 } from 'lucide-react';
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
        logo_url?: string;
      };
    }>;
  };
  onClick: () => void;
}

const statusConfig = {
  planning: { label: 'À planifier', color: 'bg-[hsl(var(--status-planning))] text-[hsl(var(--status-planning-foreground))]' },
  active: { label: 'Actif', color: 'bg-[hsl(var(--status-active))] text-[hsl(var(--status-active-foreground))]' },
  completed: { label: 'Terminé', color: 'bg-[hsl(var(--status-completed))] text-[hsl(var(--status-completed-foreground))]' },
  urgent: { label: 'Urgent', color: 'bg-[hsl(var(--status-urgent))] text-[hsl(var(--status-urgent-foreground))]' },
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusInfo = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active;
  const client = project.project_clients?.[0]?.clients;
  const clientName = client?.company || 'Sans client';
  const clientLogo = client?.logo_url;

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarImage src={clientLogo} alt={clientName} />
              <AvatarFallback>
                <Building2 className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardDescription className="text-xs font-medium">
                {clientName}
              </CardDescription>
              <CardTitle className="text-lg truncate mt-0.5">
                {project.name}
              </CardTitle>
            </div>
          </div>
          <Badge className={`flex-shrink-0 border-0 ${statusInfo.color}`}>
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
