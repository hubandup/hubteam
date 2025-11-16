import { ProjectCard } from './ProjectCard';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, pointerWithin } from '@dnd-kit/core';
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
  { id: 'planning', label: 'À faire' },
  { id: 'reco_in_progress', label: 'Reco en cours' },
  { id: 'active', label: 'En cours' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'completed', label: 'Terminé' },
  { id: 'lost', label: 'Perdu' },
];

function DraggableProjectCard({ 
  project, 
  onClick, 
  isDraggingOver 
}: { 
  project: any; 
  onClick: () => void;
  isDraggingOver?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    data: { project, type: 'project' }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    opacity: isDragging ? 0 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "transition-all duration-200",
        isDraggingOver && "mb-4"
      )}
    >
      <ProjectCard project={project} onClick={onClick} />
    </div>
  );
}

function DroppableColumn({ 
  column, 
  projects, 
  onProjectClick,
  isOver,
  overId
}: { 
  column: { id: string; label: string };
  projects: any[];
  onProjectClick: (id: string) => void;
  isOver: boolean;
  overId: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 bg-background z-10 pb-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          {column.label} ({projects.length})
        </h3>
      </div>
      <div
        className={cn(
          "space-y-3 min-h-[200px] p-4 rounded-lg transition-all duration-200",
          isOver && projects.length === 0 && "bg-accent/20 border-2 border-primary border-dashed scale-[1.02]"
        )}
      >
        <SortableContext
          id={column.id}
          items={projects.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project, index) => (
            <DraggableProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectClick(project.id)}
              isDraggingOver={overId === project.id}
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

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? String(over.id) : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    
    if (!over) {
      return;
    }

    const draggedProject = active.data.current?.project;
    if (!draggedProject) return;

    // Determine the target status
    let targetStatus: string | null = null;
    
    // Check if dropped on another project
    if (over.data.current?.type === 'project') {
      const overProject = over.data.current.project;
      targetStatus = overProject.status;
    } else if (over.data.current?.type === 'column') {
      targetStatus = over.data.current.status;
    } else {
      // Dropped on a column container (SortableContext id)
      const columnId = over.id as string;
      if (statusColumns.some(col => col.id === columnId)) {
        targetStatus = columnId;
      }
    }
    
    // Update status if changed
    if (targetStatus && draggedProject.status !== targetStatus) {
      await onStatusChange(draggedProject.id, targetStatus);
    }
  };

  return (
    <DndContext
      collisionDetection={pointerWithin}
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
              overId={overId}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{
        duration: 250,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeProject && (
          <div className="rotate-2 scale-105 shadow-2xl opacity-90">
            <ProjectCard project={activeProject} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
