import { ProjectCard } from './ProjectCard';

interface ProjectKanbanViewProps {
  projects: any[];
  onProjectClick: (id: string) => void;
}

const statusColumns = [
  { id: 'planning', label: 'À planifier' },
  { id: 'active', label: 'Actif' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'completed', label: 'Terminé' },
];

export function ProjectKanbanView({ projects, onProjectClick }: ProjectKanbanViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statusColumns.map((column) => {
        const columnProjects = projects.filter(p => p.status === column.id);
        
        return (
          <div key={column.id} className="flex flex-col gap-3">
            <div className="sticky top-0 bg-background z-10 pb-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                {column.label} ({columnProjects.length})
              </h3>
            </div>
            <div className="space-y-3">
              {columnProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => onProjectClick(project.id)}
                />
              ))}
              {columnProjects.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  Aucun projet
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
