import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PenSquare, Image, Link as LinkIcon, X } from 'lucide-react';

// Helper function to create thumbnail
const createThumbnail = async (file: File, maxWidth = 800): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          const thumbFile = new File([blob], file.name, { type: file.type });
          resolve(thumbFile);
        } else {
          reject(new Error('Failed to create thumbnail'));
        }
      }, file.type, 0.85);
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

interface CreatePostDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreatePostDialog({ open: controlledOpen, onOpenChange }: CreatePostDialogProps = {}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [content, setContent] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMediaFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setMediaFiles(files => files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error('Le contenu ne peut pas être vide');
      return;
    }

    if (!user) {
      toast.error('Vous devez être connecté pour publier');
      return;
    }

    setLoading(true);

    try {
      let mediaUrls: string[] = [];

      // Upload media files if any
      if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Math.random()}.${fileExt}`;
          
          // Check if it's an image to create thumbnail
          const isImage = file.type.startsWith('image/');
          let fileToUpload = file;
          
          if (isImage) {
            try {
              fileToUpload = await createThumbnail(file);
            } catch (error) {
              console.error('Error creating thumbnail:', error);
              // If thumbnail creation fails, upload original
            }
          }
          
          const { error: uploadError, data } = await supabase.storage
            .from('post-media')
            .upload(fileName, fileToUpload);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('post-media')
            .getPublicUrl(fileName);

          mediaUrls.push(publicUrl);
        }
      }

      const { error } = await supabase
        .from('user_posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          embed_url: embedUrl.trim() || null,
        });

      if (error) throw error;

      toast.success('Post publié avec succès');
      setContent('');
      setEmbedUrl('');
      setMediaFiles([]);
      setOpen(false);
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Erreur lors de la publication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <PenSquare className="mr-2 h-4 w-4" />
          Créer un post
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer un post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Partagez vos idées, actualités ou réflexions..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="resize-none"
          />
          
          <div className="space-y-2">
            <Label htmlFor="media" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Photos ou vidéos
            </Label>
            <Input
              id="media"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
              disabled={loading}
            />
            {mediaFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="relative bg-muted rounded px-3 py-1 text-sm flex items-center gap-2">
                    {file.name}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="embed" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Lien embed (YouTube, Vimeo, etc.)
            </Label>
            <Input
              id="embed"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !content.trim()}>
              {loading ? 'Publication...' : 'Publier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
