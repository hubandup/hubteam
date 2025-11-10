import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProjectListViewProps {
  projects: any[];
  onProjectClick: (id: string) => void;
}

const statusConfig = {
  planning: { label: 'À planifier', color: 'bg-[hsl(var(--status-planning))] text-[hsl(var(--status-planning-foreground))]' },
  active: { label: 'Actif', color: 'bg-[hsl(var(--status-active))] text-[hsl(var(--status-active-foreground))]' },
  completed: { label: 'Terminé', color: 'bg-[hsl(var(--status-completed))] text-[hsl(var(--status-completed-foreground))]' },
  urgent: { label: 'Urgent', color: 'bg-[hsl(var(--status-urgent))] text-[hsl(var(--status-urgent-foreground))]' },
};

export function ProjectListView({ projects, onProjectClick }: ProjectListViewProps) {
  return (
    <div className="space-y-2">
      {projects.map((project) => {
        const statusInfo = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active;
        const client = project.project_clients?.[0]?.clients;
        const clientName = client?.company || 'Sans client';
        const clientLogo = client?.logo_url;

        return (
          <div
            key={project.id}
            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onProjectClick(project.id)}
          >
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={clientLogo} alt={clientName} />
              <AvatarFallback>
                <Building2 className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground">{clientName}</span>
                <span className="text-sm font-medium truncate">{project.name}</span>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {project.description}
                </p>
              )}
            </div>

            {(project.start_date || project.end_date) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                <Calendar className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  {project.start_date && format(new Date(project.start_date), 'dd MMM yyyy', { locale: fr })}
                  {project.start_date && project.end_date && ' - '}
                  {project.end_date && format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
                </span>
              </div>
            )}

            <Badge className={`flex-shrink-0 border-0 ${statusInfo.color}`}>
              {statusInfo.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
