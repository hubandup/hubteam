import { useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ClientCard } from '@/components/ClientCard';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface ClientKanbanViewProps {
  clients: any[];
  onClientClick: (clientId: string) => void;
  onStageChange: (clientId: string, newStage: string) => void;
}

const stageColumns = [
  { id: 'prospect', label: 'Prospect', color: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'rdv_a_prendre', label: 'RDV à prendre', color: 'bg-blue-50 dark:bg-blue-950' },
  { id: 'a_relancer', label: 'À relancer', color: 'bg-yellow-50 dark:bg-yellow-950' },
  { id: 'rdv_hub_date', label: 'RDV Hub Date', color: 'bg-purple-50 dark:bg-purple-950' },
  { id: 'rdv_pris', label: 'RDV Pris', color: 'bg-indigo-50 dark:bg-indigo-950' },
  { id: 'reco_en_cours', label: 'Reco en cours', color: 'bg-orange-50 dark:bg-orange-950' },
  { id: 'projet_valide', label: 'Projet Validé', color: 'bg-green-50 dark:bg-green-950' },
  { id: 'a_fideliser', label: 'À fidéliser', color: 'bg-teal-50 dark:bg-teal-950' },
  { id: 'sans_suite', label: 'Sans suite', color: 'bg-gray-50 dark:bg-gray-900' },
];

function DraggableClientCard({ client, onClick }: { client: any; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Prevent click during drag
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
      className="mb-2 md:mb-3"
      tabIndex={0}
      role="button"
      aria-label={`Client: ${client.company || ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="relative focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg" onClick={handleClick}>
        <ClientCard client={client} onClick={() => {}} />
      </div>
    </div>
  );
}

function DroppableColumn({ 
  stage, 
  clients, 
  onClientClick 
}: { 
  stage: typeof stageColumns[0]; 
  clients: any[];
  onClientClick: (clientId: string) => void;
}) {
  const clientIds = clients.map((c) => c.id);
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${stage.id}`,
    data: {
      type: 'column',
      stageId: stage.id,
    },
  });

  return (
    <div 
      ref={setNodeRef}
      className={`kanban-column flex flex-col min-w-[280px] md:min-w-[320px] w-[280px] md:w-[320px] flex-shrink-0 rounded-lg ${stage.color} p-3 md:p-4 transition-all snap-start ${
        isOver ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-foreground">{stage.label}</h3>
        <Badge variant="secondary" className="text-xs">
          {clients.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[350px] md:min-h-[400px]">
        <SortableContext items={clientIds} strategy={verticalListSortingStrategy}>
          {clients.map((client) => (
            <DraggableClientCard
              key={client.id}
              client={client}
              onClick={() => onClientClick(client.id)}
            />
          ))}
          {clients.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Déposez une carte ici
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function ClientKanbanView({ clients, onClientClick, onStageChange }: ClientKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const clientsByStage = useMemo(() => {
    const grouped = stageColumns.reduce((acc, stage) => {
      acc[stage.id] = [];
      return acc;
    }, {} as Record<string, any[]>);

    clients.forEach((client) => {
      const stage = client.kanban_stage || 'prospect';
      if (grouped[stage]) {
        grouped[stage].push(client);
      }
    });

    return grouped;
  }, [clients]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const activeClient = clients.find((c) => c.id === active.id);
    
    if (!activeClient) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    let targetStage: string | null = null;

    // Check if dropped on another client card
    const overClient = clients.find((c) => c.id === over.id);
    if (overClient) {
      targetStage = overClient.kanban_stage || 'prospect';
    }
    
    // Check if dropped on a column directly
    if (!targetStage && over.data.current?.type === 'column') {
      targetStage = over.data.current.stageId;
    }

    // Update stage if it changed
    if (targetStage && activeClient.kanban_stage !== targetStage) {
      onStageChange(activeClient.id, targetStage);
    }

    setActiveId(null);
    setOverId(null);
  };

  const activeClient = activeId ? clients.find((c) => c.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-container flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-3 px-3 md:mx-0 md:px-0 snap-x snap-mandatory">
        {stageColumns.map((stage) => (
          <DroppableColumn
            key={stage.id}
            stage={stage}
            clients={clientsByStage[stage.id] || []}
            onClientClick={onClientClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeClient ? (
          <div className="opacity-90">
            <ClientCard client={activeClient} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
