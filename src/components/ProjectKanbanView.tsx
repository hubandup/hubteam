import { ProjectCard } from './ProjectCard';
import { DndContext, DragEndEvent, DragOverlay, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

interface ProjectKanbanViewProps {
  projects: any[];
  onProjectClick: (id: string) => void;
  onStatusChange: (projectId: string, newStatus: string) => Promise<void>;
}

const statusColumns = [
  { id: 'planning', label: 'À planifier' },
  { id: 'active', label: 'Actif' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'completed', label: 'Terminé' },
];

function DraggableProjectCard({ project, onClick }: { project: any; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    data: { project }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProjectCard project={project} onClick={onClick} />
    </div>
  );
}

export function ProjectKanbanView({ projects, onProjectClick, onStatusChange }: ProjectKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const activeProject = projects.find(p => p.id === activeId);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeProject = active.data.current?.project;
    const overColumn = over.id as string;
    
    // Check if we're dropping on a column (status)
    if (statusColumns.some(col => col.id === overColumn)) {
      if (activeProject && activeProject.status !== overColumn) {
        await onStatusChange(activeProject.id, overColumn);
      }
    }
    
    setActiveId(null);
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(event.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusColumns.map((column) => {
          const columnProjects = projects.filter(p => p.status === column.id);
          
          return (
            <div
              key={column.id}
              className="flex flex-col gap-3"
            >
              <div className="sticky top-0 bg-background z-10 pb-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {column.label} ({columnProjects.length})
                </h3>
              </div>
              <SortableContext
                id={column.id}
                items={columnProjects.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div 
                  className="space-y-3 min-h-[200px] p-2 rounded-lg transition-colors"
                  data-column={column.id}
                >
                  {columnProjects.map((project) => (
                    <DraggableProjectCard
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
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeProject && (
          <div className="opacity-80">
            <ProjectCard project={activeProject} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
