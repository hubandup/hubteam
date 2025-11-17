import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PenSquare } from 'lucide-react';

export function CreatePostDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

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
      const { error } = await supabase
        .from('user_posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
        });

      if (error) throw error;

      toast.success('Post publié avec succès');
      setContent('');
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
      <DialogContent>
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
