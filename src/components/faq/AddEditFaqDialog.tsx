import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from './RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

interface FaqItem {
  id: string;
  title: string;
  content: string;
  pdf_url: string | null;
  display_order: number;
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setTitle(editingItem.title);
      setContent(editingItem.content);
      setCurrentPdfUrl(editingItem.pdf_url);
    } else {
      setTitle('');
      setContent('');
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

        <div className="space-y-4">
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
