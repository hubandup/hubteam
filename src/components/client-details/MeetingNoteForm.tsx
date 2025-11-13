import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Paperclip, X, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface MeetingNoteFormProps {
  clientId: string;
  onNoteAdded: () => void;
}

export function MeetingNoteForm({ clientId, onNoteAdded }: MeetingNoteFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Le fichier doit faire moins de 10MB');
        return;
      }
      setAttachmentFile(file);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentFile) return null;

    const fileExt = attachmentFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `meeting-notes/${fileName}`;

    const { data, error } = await supabase.storage
      .from('project-attachments')
      .upload(filePath, attachmentFile);

    if (error) {
      console.error('Error uploading attachment:', error);
      toast.error("Erreur lors de l'upload de la pièce jointe");
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('project-attachments')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error('Le commentaire ne peut pas être vide');
      return;
    }

    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    setLoading(true);
    try {
      const attachmentUrl = await uploadAttachment();

      const { error } = await supabase
        .from('meeting_notes')
        .insert({
          client_id: clientId,
          content: content.trim(),
          attachment_url: attachmentUrl,
          user_id: user.id,
          is_private: isPrivate,
        });

      if (error) throw error;

      toast.success('Commentaire ajouté');
      setContent('');
      setAttachmentFile(null);
      setShowAttachmentInput(false);
      setIsPrivate(true);
      onNoteAdded();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error("Erreur lors de l'ajout du commentaire");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Checkbox 
          id="private-comment"
          checked={isPrivate}
          onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
        />
        <Label 
          htmlFor="private-comment" 
          className="text-sm text-muted-foreground cursor-pointer"
        >
          Commentaire privé (visible uniquement par Admin/Équipe)
        </Label>
      </div>
      
      <div className="flex items-start gap-2 p-4 border border-input rounded-lg bg-background">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ajouter un commentaire..."
          rows={1}
          className="flex-1 resize-none border-0 p-0 focus-visible:ring-0 shadow-none bg-transparent min-h-[40px]"
          disabled={loading}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowAttachmentInput(!showAttachmentInput)}
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={loading || !content.trim()}
            className="h-10 w-10 shrink-0 rounded-lg bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {showAttachmentInput && (
        <div className="space-y-2 px-4">
          <div className="flex items-center gap-2">
            <input
              type="file"
              onChange={handleFileChange}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />
          </div>
          {attachmentFile && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md w-fit">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{attachmentFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeAttachment}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Max 10MB - Tous formats acceptés
          </p>
        </div>
      )}
    </form>
  );
}
