import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UserPost {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

interface UserPostItemProps {
  post: UserPost;
}

export function UserPostItem({ post }: UserPostItemProps) {
  const { user } = useAuth();
  const isOwner = user?.id === post.user_id;

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce post ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      toast.success('Post supprimé');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.profiles?.avatar_url || undefined} />
          <AvatarFallback>
            {post.profiles?.first_name?.[0]}
            {post.profiles?.last_name?.[0]}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {post.profiles?.first_name} {post.profiles?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            </div>

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p className="mt-3 text-sm whitespace-pre-wrap break-words">
            {post.content}
          </p>
        </div>
      </div>
    </Card>
  );
}
