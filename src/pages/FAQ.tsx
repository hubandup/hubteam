import { useState, useEffect } from 'react';
import { createSafeHtml } from '@/lib/sanitize';
import { HelpCircle, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AddEditFaqDialog } from '@/components/faq/AddEditFaqDialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole, type UserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { getIconComponent } from '@/components/faq/faqConstants';

interface FaqCategory {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

interface FaqItem {
  id: string;
  title: string;
  content: string;
  pdf_url: string | null;
  display_order: number;
  category_id: string | null;
  icon: string;
  allowed_roles: UserRole[];
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

  const IconComponent = getIconComponent(item.icon);

  return (
    <div ref={setNodeRef} style={style}>
      <Collapsible className="border rounded-lg bg-card">
        <CollapsibleTrigger className="w-full px-4 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isAdmin && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
            <div className="flex items-center justify-center flex-shrink-0">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-left text-foreground flex-1 min-w-0 leading-tight">{item.title}</h3>
          </div>
          <div className="flex items-center justify-center flex-shrink-0">
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-[30px] pb-4 pt-3 border-t bg-card">
          <div
            className="prose max-w-none mb-4 dark:prose-invert [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer"
            dangerouslySetInnerHTML={createSafeHtml(item.content)}
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
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);
  const { role } = useUserRole();
  const { canRead, loading } = usePermissions();
  const isAdmin = role === 'admin';
  const isMobile = useIsMobile();

  // Check permission
  if (!loading && !canRead('faq')) {
    return <Navigate to="/" replace />;
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadCategories();
    loadFaqItems();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('faq_categories')
      .select('*')
      .order('display_order', { ascending: true });

    setCategories(data || []);
  };

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

  const filteredItems = activeCategory === 'all' 
    ? faqItems 
    : faqItems.filter(item => item.category_id === activeCategory);

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

    const oldIndex = filteredItems.findIndex((item) => item.id === active.id);
    const newIndex = filteredItems.findIndex((item) => item.id === over.id);

    const newItems = arrayMove(filteredItems, oldIndex, newIndex);
    
    // Update the full list with new order for filtered category
    const updatedFullList = faqItems.map(item => {
      const newItem = newItems.find(ni => ni.id === item.id);
      return newItem || item;
    });
    
    setFaqItems(updatedFullList);

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
      loadFaqItems();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b px-6 py-4 bg-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-primary flex-shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">FAQ</h1>
              <p className="text-sm text-muted-foreground">
                Foire aux questions
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsDialogOpen(true)} className="flex-shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une question
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="mb-6 w-full justify-start flex-wrap h-auto p-1">
              <TabsTrigger value="all" className="gap-2 px-3 py-2">
                <HelpCircle className="h-4 w-4 flex-shrink-0" />
                <span>Toutes</span>
              </TabsTrigger>
              {categories.map((category) => {
                const count = faqItems.filter(item => item.category_id === category.id).length;
                return (
                  <TabsTrigger key={category.id} value={category.id} className="gap-2 px-3 py-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span>{category.name}</span>
                    <span className="text-xs opacity-70">({count})</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeCategory} className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune question dans cette catégorie</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={filteredItems.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {filteredItems.map((item) => (
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
            </TabsContent>
          </Tabs>
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
