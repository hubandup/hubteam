import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Paperclip, X } from 'lucide-react';

const noteSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis').max(200),
  content: z.string().trim().min(1, 'Le contenu est requis'),
  meeting_date: z.string().min(1, 'La date est requise'),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface MeetingNoteFormProps {
  clientId: string;
  onNoteAdded: () => void;
}

export function MeetingNoteForm({ clientId, onNoteAdded }: MeetingNoteFormProps) {
  const [loading, setLoading] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
  });

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

  const onSubmit = async (data: NoteFormData) => {
    setLoading(true);
    try {
      const attachmentUrl = await uploadAttachment();

      const { error } = await supabase
        .from('meeting_notes')
        .insert({
          client_id: clientId,
          title: data.title,
          content: data.content,
          meeting_date: data.meeting_date,
          attachment_url: attachmentUrl,
        });

      if (error) throw error;

      toast.success('Compte rendu ajouté');
      reset();
      setAttachmentFile(null);
      onNoteAdded();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error("Erreur lors de l'ajout du compte rendu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau compte rendu</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Ex: Réunion de suivi projet"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting_date">Date de réunion *</Label>
            <Input
              id="meeting_date"
              type="datetime-local"
              {...register('meeting_date')}
            />
            {errors.meeting_date && (
              <p className="text-sm text-destructive">{errors.meeting_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Contenu *</Label>
            <Textarea
              id="content"
              {...register('content')}
              placeholder="Notes de la réunion..."
              rows={6}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachment">Pièce jointe (optionnel)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="attachment"
                type="file"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {attachmentFile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
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
            </div>
            <p className="text-xs text-muted-foreground">
              Max 10MB - Tous formats acceptés
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter le compte rendu
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
