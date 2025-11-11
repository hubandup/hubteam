import { useState, useEffect } from 'react';
import { HelpCircle, Plus } from 'lucide-react';
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

interface FaqItem {
  id: string;
  title: string;
  content: string;
  pdf_url: string | null;
  display_order: number;
}

export default function FAQ() {
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);
  const { role } = useUserRole();
  const isAdmin = role === 'admin';

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

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4">
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

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {faqItems.map((item) => (
            <Collapsible key={item.id} className="border rounded-lg">
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold text-left">{item.title}</h3>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0 border-t">
                <div
                  className="prose prose-sm max-w-none mb-4"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
                {item.pdf_url && (
                  <div className="mb-4">
                    <a
                      href={item.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
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
                      onClick={() => handleEdit(item)}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}

          {faqItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune question pour le moment</p>
            </div>
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
