import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from './RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Eye, Edit } from 'lucide-react';
import { FAQ_CATEGORIES, FAQ_ICONS, getIconComponent } from './faqConstants';

interface FaqItem {
  id: string;
  title: string;
  content: string;
  pdf_url: string | null;
  display_order: number;
  category: string;
  icon: string;
}

interface AddEditFaqDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: FaqItem | null;
}

export function AddEditFaqDialog({
  isOpen,
  onClose,
  editingItem,
}: AddEditFaqDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [icon, setIcon] = useState('help-circle');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setTitle(editingItem.title);
      setContent(editingItem.content);
      setCategory(editingItem.category || 'general');
      setIcon(editingItem.icon || 'help-circle');
      setCurrentPdfUrl(editingItem.pdf_url);
    } else {
      setTitle('');
      setContent('');
      setCategory('general');
      setIcon('help-circle');
      setCurrentPdfUrl(null);
    }
    setPdfFile(null);
  }, [editingItem, isOpen]);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      toast.error('Veuillez sélectionner un fichier PDF valide');
    }
  };

  const uploadPdf = async (): Promise<string | null> => {
    if (!pdfFile) return currentPdfUrl;

    const fileName = `${Date.now()}-${pdfFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('faq-pdfs')
      .upload(fileName, pdfFile);

    if (uploadError) {
      toast.error("Erreur lors de l'upload du PDF");
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('faq-pdfs').getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setIsSaving(true);

    const pdfUrl = await uploadPdf();

    const data = {
      title,
      content,
      category,
      icon,
      pdf_url: pdfUrl,
      display_order: editingItem?.display_order ?? 0,
    };

    const { error } = editingItem
      ? await supabase.from('faq_items').update(data).eq('id', editingItem.id)
      : await supabase.from('faq_items').insert(data);

    setIsSaving(false);

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }

    toast.success(editingItem ? 'Question modifiée' : 'Question ajoutée');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Modifier la question' : 'Ajouter une question'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="edit" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Édition
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Prévisualisation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Catégorie *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAQ_CATEGORIES.map((cat) => {
                      const IconComponent = cat.icon;
                      return (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="icon">Icône *</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger id="icon">
                    <SelectValue placeholder="Sélectionner une icône" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAQ_ICONS.map((iconOption) => {
                      const IconComponent = iconOption.icon;
                      return (
                        <SelectItem key={iconOption.id} value={iconOption.id}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {iconOption.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Question..."
              />
            </div>

            <div>
              <Label>Contenu *</Label>
              <RichTextEditor value={content} onChange={setContent} />
            </div>

            <div>
              <Label htmlFor="pdf">Document PDF (optionnel)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pdf"
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('pdf')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {pdfFile ? pdfFile.name : 'Choisir un PDF'}
                </Button>
                {currentPdfUrl && !pdfFile && (
                  <a
                    href={currentPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    PDF actuel
                  </a>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="border rounded-lg p-6 bg-card min-h-[400px]">
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const IconComponent = getIconComponent(icon);
                  return <IconComponent className="h-6 w-6 text-primary" />;
                })()}
                <h3 className="font-bold text-xl text-foreground">
                  {title || 'Titre de la question'}
                </h3>
              </div>
              {content ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <p className="text-muted-foreground italic">
                  Le contenu apparaîtra ici...
                </p>
              )}
              {(pdfFile || currentPdfUrl) && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    📎 Document PDF joint
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
