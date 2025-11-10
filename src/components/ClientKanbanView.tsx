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
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ClientCard } from '@/components/ClientCard';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

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

  const isOverdue = client.follow_up_date && isPast(new Date(client.follow_up_date));

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
      <div className="relative">
        <ClientCard client={client} onClick={onClick} />
        {client.follow_up_date && (
          <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
            isOverdue 
              ? 'bg-destructive text-destructive-foreground' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <Clock className="h-3 w-3" />
            {format(new Date(client.follow_up_date), 'dd/MM/yyyy', { locale: fr })}
          </div>
        )}
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

  return (
    <div className={`flex flex-col min-w-[320px] max-w-[320px] rounded-lg ${stage.color} p-4`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-foreground">{stage.label}</h3>
        <Badge variant="secondary" className="text-xs">
          {clients.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[400px]">
        <SortableContext items={clientIds} strategy={verticalListSortingStrategy}>
          {clients.map((client) => (
            <DraggableClientCard
              key={client.id}
              client={client}
              onClick={() => onClientClick(client.id)}
            />
          ))}
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
    const overClient = clients.find((c) => c.id === over.id);

    if (activeClient && overClient) {
      const targetStage = overClient.kanban_stage || 'prospect';
      if (activeClient.kanban_stage !== targetStage) {
        onStageChange(activeClient.id, targetStage);
      }
    } else if (activeClient) {
      // Dropped on empty column
      stageColumns.forEach((stage) => {
        const stageClients = clientsByStage[stage.id];
        if (stageClients.length === 0 && overId === null) {
          // Could be empty column - we need better detection
          // For now, maintain current stage
        }
      });
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
      <div className="flex gap-4 overflow-x-auto pb-4">
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
