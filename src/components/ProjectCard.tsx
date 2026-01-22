import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Building2 } from 'lucide-react';
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
    tasks_total?: number;
    tasks_completed?: number;
  };
  onClick: () => void;
}

const statusConfig = {
  planning: { label: 'À faire', color: 'bg-[hsl(var(--status-planning))] text-[hsl(var(--status-planning-foreground))]' },
  reco_in_progress: { label: 'Reco en cours', color: 'bg-[hsl(var(--status-reco-in-progress))] text-[hsl(var(--status-reco-in-progress-foreground))]' },
  active: { label: 'En cours', color: 'bg-[hsl(var(--status-active))] text-[hsl(var(--status-active-foreground))]' },
  completed: { label: 'Terminé', color: 'bg-[hsl(var(--status-completed))] text-[hsl(var(--status-completed-foreground))]' },
  lost: { label: 'Perdu', color: 'bg-[hsl(var(--status-lost))] text-[hsl(var(--status-lost-foreground))]' },
  urgent: { label: 'Urgent', color: 'bg-[hsl(var(--status-urgent))] text-[hsl(var(--status-urgent-foreground))]' },
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusInfo = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active;
  const client = project.project_clients?.[0]?.clients;
  const clientName = client?.company || 'Sans client';
  const clientLogo = client?.logo_url;
  
  const isOverdue = project.end_date && new Date(project.end_date) < new Date() && project.status !== 'completed';
  
  const tasksTotal = project.tasks_total || 0;
  const tasksCompleted = project.tasks_completed || 0;
  const progressPercentage = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  return (
    <div className="border rounded-lg bg-card/50 cursor-pointer hover:shadow-lg transition-shadow p-2 md:p-6 relative overflow-hidden" onClick={onClick}>
      {/* Discrete progress bar at the bottom */}
      {tasksTotal > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}
      
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 md:gap-3">
          <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
              <AvatarImage src={clientLogo} alt={clientName} />
              <AvatarFallback>
                <Building2 className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-0.5 md:space-y-1">
              <h3 className="text-base md:text-lg font-semibold truncate">
                {project.name}
              </h3>
              <p className="text-xs md:text-sm font-medium text-muted-foreground">
                {clientName}
              </p>
              {project.description && (
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}
              {(project.start_date || project.end_date) && (
                <div className={`flex items-center gap-1.5 md:gap-2 text-xs md:text-sm ${isOverdue ? 'text-destructive font-medium' : project.status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                  <span>
                    {project.start_date && format(new Date(project.start_date), 'dd MMM yyyy', { locale: fr })}
                    {project.start_date && project.end_date && ' - '}
                    {project.end_date && format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={`flex-shrink-0 border-0 text-xs md:text-sm ${statusInfo.color}`}>
              {statusInfo.label}
            </Badge>
            {tasksTotal > 0 && (
              <span className="text-[10px] md:text-xs text-muted-foreground">
                {tasksCompleted}/{tasksTotal} tâches
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
