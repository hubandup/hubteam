import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { ProspectCard } from './ProspectCard';
import { Prospect, ProspectStatus, PROSPECT_STATUSES } from '@/hooks/useProspects';

interface ProspectKanbanViewProps {
  prospects: Prospect[];
  onProspectClick: (prospectId: string) => void;
  onStatusChange: (prospectId: string, newStatus: ProspectStatus) => void;
}

function DraggableProspectCard({ prospect, onClick }: { prospect: Prospect; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prospect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2"
      tabIndex={0}
      role="button"
      aria-label={`Prospect: ${prospect.company_name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="relative focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg" onClick={handleClick}>
        <ProspectCard prospect={prospect} compact />
      </div>
    </div>
  );
}

function DroppableColumn({
  status,
  prospects,
  onProspectClick,
}: {
  status: typeof PROSPECT_STATUSES[0];
  prospects: Prospect[];
  onProspectClick: (prospectId: string) => void;
}) {
  const prospectIds = prospects.map((p) => p.id);
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status.value}`,
    data: {
      type: 'column',
      statusValue: status.value,
    },
  });

  const totalWeighted = prospects.reduce((sum, p) => sum + p.estimated_amount * p.probability, 0);

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column flex flex-col min-w-[260px] w-[260px] flex-shrink-0 rounded-lg ${status.color} p-3 transition-all snap-start ${
        isOver ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-foreground">{status.label}</h3>
        <Badge variant="secondary" className="text-xs">
          {prospects.length}
        </Badge>
      </div>
      {totalWeighted > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          {totalWeighted.toLocaleString('fr-FR')} € pondéré
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-[300px]">
        <SortableContext items={prospectIds} strategy={verticalListSortingStrategy}>
          {prospects.map((prospect) => (
            <DraggableProspectCard
              key={prospect.id}
              prospect={prospect}
              onClick={() => onProspectClick(prospect.id)}
            />
          ))}
          {prospects.length === 0 && (
            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
              Déposez ici
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function ProspectKanbanView({ prospects, onProspectClick, onStatusChange }: ProspectKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const prospectsByStatus = useMemo(() => {
    const grouped: Record<string, Prospect[]> = {};
    PROSPECT_STATUSES.forEach((status) => {
      grouped[status.value] = prospects.filter((p) => p.status === status.value);
    });
    return grouped;
  }, [prospects]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const activeProspect = prospects.find((p) => p.id === active.id);

    if (!activeProspect) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    let targetStatus: ProspectStatus | null = null;

    // Check if dropped on another prospect
    const overProspect = prospects.find((p) => p.id === over.id);
    if (overProspect) {
      targetStatus = overProspect.status;
    }

    // Check if dropped on a column
    if (!targetStatus && over.data.current?.type === 'column') {
      targetStatus = over.data.current.statusValue as ProspectStatus;
    }

    // Update status if changed
    if (targetStatus && activeProspect.status !== targetStatus) {
      onStatusChange(activeProspect.id, targetStatus);
    }

    setActiveId(null);
    setOverId(null);
  };

  const activeProspect = activeId ? prospects.find((p) => p.id === activeId) : null;

  // Filter out closed statuses for cleaner Kanban (keep active pipeline)
  const activeStatuses = PROSPECT_STATUSES.filter(s => !['Gagné', 'Perdu', 'En veille'].includes(s.value));
  const closedStatuses = PROSPECT_STATUSES.filter(s => ['Gagné', 'Perdu', 'En veille'].includes(s.value));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Active pipeline */}
        <div className="kanban-container flex gap-3 overflow-x-auto pb-4 -mx-3 px-3 snap-x snap-mandatory">
          {activeStatuses.map((status) => (
            <DroppableColumn
              key={status.value}
              status={status}
              prospects={prospectsByStatus[status.value] || []}
              onProspectClick={onProspectClick}
            />
          ))}
        </div>

        {/* Closed statuses */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Opportunités fermées</h3>
          <div className="kanban-container flex gap-3 overflow-x-auto pb-4 -mx-3 px-3 snap-x snap-mandatory">
            {closedStatuses.map((status) => (
              <DroppableColumn
                key={status.value}
                status={status}
                prospects={prospectsByStatus[status.value] || []}
                onProspectClick={onProspectClick}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeProspect && <ProspectCard prospect={activeProspect} compact />}
      </DragOverlay>
    </DndContext>
  );
}
