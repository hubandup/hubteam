import { ProjectCard } from './ProjectCard';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { cn } from '@/lib/utils';

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
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProjectCard project={project} onClick={onClick} />
    </div>
  );
}

function DroppableColumn({ 
  column, 
  projects, 
  onProjectClick,
  isOver 
}: { 
  column: { id: string; label: string };
  projects: any[];
  onProjectClick: (id: string) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: 'column', status: column.id }
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 bg-background z-10 pb-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          {column.label} ({projects.length})
        </h3>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "space-y-3 min-h-[200px] p-4 rounded-lg transition-all duration-200",
          isOver && "bg-accent/20 border-2 border-primary border-dashed scale-[1.02]"
        )}
      >
        <SortableContext
          items={projects.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project) => (
            <DraggableProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectClick(project.id)}
            />
          ))}
          {projects.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              Glissez un projet ici
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function ProjectKanbanView({ projects, onProjectClick, onStatusChange }: ProjectKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  
  const activeProject = projects.find(p => p.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    setOverId(over?.id || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    
    if (!over) {
      return;
    }

    const activeProject = active.data.current?.project;
    
    // Check if we're dropping on a column
    const overData = over.data.current;
    const targetStatus = overData?.type === 'column' ? overData.status : null;
    
    if (targetStatus && activeProject && activeProject.status !== targetStatus) {
      await onStatusChange(activeProject.id, targetStatus);
    }
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusColumns.map((column) => {
          const columnProjects = projects.filter(p => p.status === column.id);
          
          return (
            <DroppableColumn
              key={column.id}
              column={column}
              projects={columnProjects}
              onProjectClick={onProjectClick}
              isOver={overId === column.id}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeProject && (
          <div className="rotate-3 scale-105 shadow-2xl">
            <ProjectCard project={activeProject} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
