import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isTyping = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Initialize content only when value changes from outside (not from typing)
  useEffect(() => {
    if (editorRef.current && !isTyping.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    updateContent();
  };

  const updateContent = () => {
    if (editorRef.current) {
      isTyping.current = true;
      onChange(editorRef.current.innerHTML);
      setTimeout(() => {
        isTyping.current = false;
      }, 0);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleLinkInsert = () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      setLinkText(selection.toString());
    }
    setLinkDialogOpen(true);
  };

  const insertLink = () => {
    if (!linkUrl) return;
    
    if (linkText) {
      const link = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${linkText}</a>`;
      document.execCommand('insertHTML', false, link);
    } else {
      execCommand('createLink', linkUrl);
    }
    
    setLinkUrl('');
    setLinkText('');
    setLinkDialogOpen(false);
    updateContent();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une image valide.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erreur',
        description: 'L\'image ne doit pas dépasser 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `faq-images/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('faq-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('faq-attachments')
        .getPublicUrl(filePath);

      // Insert image into editor
      const img = `<img src="${publicUrl}" alt="FAQ Image" style="max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0;" />`;
      document.execCommand('insertHTML', false, img);
      updateContent();

      toast({
        title: 'Succès',
        description: 'Image insérée avec succès.',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de télécharger l\'image.',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div className="border rounded-lg">
        <div className="sticky top-0 z-10 bg-background p-2 border-b flex gap-1 flex-wrap shadow-sm">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('bold')}
            title="Gras"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('italic')}
            title="Italique"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('underline')}
            title="Souligné"
          >
            <Underline className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border mx-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('formatBlock', '<h2>')}
            title="Titre"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('insertUnorderedList')}
            title="Liste à puces"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('insertOrderedList')}
            title="Liste numérotée"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border mx-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('justifyLeft')}
            title="Aligner à gauche"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('justifyCenter')}
            title="Centrer"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('justifyRight')}
            title="Aligner à droite"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => execCommand('justifyFull')}
            title="Justifier"
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border mx-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleLinkInsert}
            title="Insérer un lien"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            title="Insérer une image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          onInput={updateContent}
          onPaste={handlePaste}
          className="min-h-[300px] p-[30px] focus:outline-none prose max-w-none dark:prose-invert [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer"
          style={{ whiteSpace: 'pre-wrap' }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insérer un lien</DialogTitle>
            <DialogDescription>
              Ajoutez un lien hypertexte dans votre contenu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-text">Texte du lien</Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Texte à afficher"
              />
            </div>
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://exemple.com"
                type="url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={insertLink} disabled={!linkUrl}>
              Insérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
