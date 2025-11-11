import { useState, useEffect } from 'react';
import { HelpCircle, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AddEditFaqDialog } from '@/components/faq/AddEditFaqDialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FaqItem {
  id: string;
  title: string;
  content: string;
  pdf_url: string | null;
  display_order: number;
}

interface SortableFaqItemProps {
  item: FaqItem;
  isAdmin: boolean;
  onEdit: (item: FaqItem) => void;
  onDelete: (id: string) => void;
}

function SortableFaqItem({ item, isAdmin, onEdit, onDelete }: SortableFaqItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Collapsible className="border rounded-lg bg-card">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3 flex-1">
            {isAdmin && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <h3 className="font-semibold text-left text-foreground flex-1">{item.title}</h3>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 border-t bg-card">
          <div
            className="prose prose-sm max-w-none mb-4 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
          {item.pdf_url && (
            <div className="mb-4">
              <a
                href={item.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm no-underline"
              >
                📎 Voir le document PDF
              </a>
            </div>
          )}
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(item)}
              >
                Modifier
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(item.id)}
              >
                Supprimer
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function FAQ() {
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);
  const { role } = useUserRole();
  const isAdmin = role === 'admin';

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadFaqItems();
  }, []);

  const loadFaqItems = async () => {
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      toast.error('Erreur lors du chargement de la FAQ');
      return;
    }

    setFaqItems(data || []);
  };

  const handleEdit = (item: FaqItem) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) return;

    const { error } = await supabase.from('faq_items').delete().eq('id', id);

    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }

    toast.success('Élément supprimé');
    loadFaqItems();
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    loadFaqItems();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = faqItems.findIndex((item) => item.id === active.id);
    const newIndex = faqItems.findIndex((item) => item.id === over.id);

    const newItems = arrayMove(faqItems, oldIndex, newIndex);
    setFaqItems(newItems);

    // Update display_order in database
    try {
      const updates = newItems.map((item, index) => ({
        id: item.id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('faq_items')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      toast.success('Ordre mis à jour');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Erreur lors de la mise à jour de l\'ordre');
      loadFaqItems(); // Reload to restore correct order
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">FAQ</h1>
              <p className="text-sm text-muted-foreground">
                Foire aux questions
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une question
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-background">
        <div className="max-w-4xl mx-auto space-y-4">
          {faqItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune question pour le moment</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={faqItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {faqItems.map((item) => (
                    <SortableFaqItem
                      key={item.id}
                      item={item}
                      isAdmin={isAdmin}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {isAdmin && (
        <AddEditFaqDialog
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          editingItem={editingItem}
        />
      )}
    </div>
  );
}
