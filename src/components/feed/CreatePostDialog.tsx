import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Image, X, FileText } from 'lucide-react';

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
      canvas.toBlob(blob => {
        if (blob) {
          const thumbFile = new File([blob], file.name, {
            type: file.type
          });
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

export function CreatePostDialog({
  open: controlledOpen,
  onOpenChange
}: CreatePostDialogProps = {}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMediaFiles(Array.from(e.target.files));
    }
  };
  
  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
      } else {
        toast.error('Veuillez sélectionner un fichier PDF');
      }
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
          const { error: uploadError } = await supabase.storage.from('post-media').upload(fileName, fileToUpload);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(fileName);
          mediaUrls.push(publicUrl);
        }
      }

      // Extract URLs from content and detect video/link
      let linkMetadata = null;
      let embedUrl = '';
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      const matches = content.match(urlRegex);
      
      if (matches && matches.length > 0) {
        const firstUrl = matches[0];
        const lower = firstUrl.toLowerCase();
        
        // Check if it's a video URL (YouTube/Vimeo)
        if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')) {
          embedUrl = firstUrl;
        } else {
          // It's a regular link, fetch preview
          console.log('[CreatePost] Fetching link preview for:', firstUrl);
          try {
            const { data: previewData, error: previewError } = await supabase.functions.invoke('url-preview', {
              method: 'POST',
              body: { url: firstUrl },
            });

            console.log('[CreatePost] Preview response:', previewData);

            if (!previewError && previewData) {
              if (previewData.success) {
                linkMetadata = {
                  embed_url: previewData.url,
                  link_title: previewData.title,
                  link_description: previewData.description,
                  link_image: previewData.image,
                  link_site_name: previewData.siteName || previewData.domain,
                };
              } else {
                // Fallback for failed preview
                linkMetadata = {
                  embed_url: firstUrl,
                  link_site_name: previewData.domain || new URL(firstUrl).hostname,
                };
              }
            }
          } catch (err) {
            console.error('[CreatePost] Error fetching link preview:', err);
            // Continue without preview on error
          }
        }
      }

      // Upload PDF if present
      let pdfUrl = null;
      if (pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('feed-pdfs')
          .upload(fileName, pdfFile);
          
        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          toast.error('Erreur lors de l\'upload du PDF');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('feed-pdfs')
            .getPublicUrl(fileName);
          pdfUrl = publicUrl;
        }
      }

      const { data: postData, error } = await supabase.from('user_posts').insert({
        user_id: user.id,
        content: content.trim(),
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        embed_url: embedUrl || linkMetadata?.embed_url || null,
        link_title: linkMetadata?.link_title || null,
        link_description: linkMetadata?.link_description || null,
        link_image: linkMetadata?.link_image || null,
        link_site_name: linkMetadata?.link_site_name || null,
        pdf_url: pdfUrl,
      }).select().single();
      
      if (error) throw error;

      // Sync to Slack in background
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        
        const authorName = profile 
          ? `${profile.first_name} ${profile.last_name}` 
          : 'Utilisateur';
        
        await supabase.functions.invoke('slack-sync', {
          body: {
            action: 'post_to_slack',
            content: content.trim(),
            author_name: authorName,
            post_id: postData.id,
            media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
            pdf_url: pdfUrl || undefined,
          },
        });
        console.log('Post synced to Slack');
      } catch (slackError) {
        console.error('Error syncing to Slack:', slackError);
        // Don't show error to user, Slack sync is optional
      }

      toast.success('Post publié avec succès');
      setContent('');
      setMediaFiles([]);
      setPdfFile(null);
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
        {/* Trigger is in CreatePostInput */}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer un post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Textarea 
              placeholder="Partagez vos idées, actualités ou réflexions..." 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              rows={6} 
              className="resize-none" 
            />
            
            <div className="flex items-center gap-2 pt-2 border-t">
              <input 
                id="media" 
                type="file" 
                accept="image/*,video/*" 
                multiple 
                onChange={handleFileChange} 
                disabled={loading}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('media')?.click()}
                disabled={loading}
                className="gap-2"
              >
                <Image className="h-4 w-4" />
                Photos/Vidéos
              </Button>
              
              <input 
                id="pdf" 
                type="file" 
                accept=".pdf,application/pdf" 
                onChange={handlePdfChange} 
                disabled={loading}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('pdf')?.click()}
                disabled={loading}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </div>

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

            {pdfFile && (
              <div className="flex items-center gap-2 mt-2 bg-muted rounded px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-red-600" />
                <span className="flex-1">{pdfFile.name}</span>
                <button 
                  type="button" 
                  onClick={() => setPdfFile(null)}
                  className="text-destructive hover:text-destructive/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
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
