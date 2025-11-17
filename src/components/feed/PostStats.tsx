import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PostStatsProps {
  postId: string;
  onCommentClick?: () => void;
}

export function PostStats({ postId, onCommentClick }: PostStatsProps) {
  const { user } = useAuth();
  const [reactionCount, setReactionCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [hasUserLiked, setHasUserLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();

    // Subscribe to realtime updates for reactions
    const reactionsChannel = supabase
      .channel(`post-stats-reactions-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_post_reactions',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    // Subscribe to realtime updates for comments
    const commentsChannel = supabase
      .channel(`post-stats-comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_post_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [postId, user]);

  const fetchStats = async () => {
    try {
      // Fetch reaction count
      const { count: reactions } = await supabase
        .from('user_post_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      // Fetch comment count
      const { count: comments } = await supabase
        .from('user_post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      // Check if current user has liked
      if (user) {
        const { data: userReaction } = await supabase
          .from('user_post_reactions')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('reaction_type', 'like')
          .single();

        setHasUserLiked(!!userReaction);
      }

      setReactionCount(reactions || 0);
      setCommentCount(comments || 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLike = async () => {
    if (!user || loading) return;

    try {
      setLoading(true);

      if (hasUserLiked) {
        // Remove like
        const { error } = await supabase
          .from('user_post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('reaction_type', 'like');

        if (error) throw error;
      } else {
        // Add like
        const { error } = await supabase
          .from('user_post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: 'like',
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Erreur lors de la réaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 mt-3 py-2">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 gap-1.5 px-2 hover:text-primary',
          hasUserLiked && 'text-primary'
        )}
        onClick={handleLike}
        disabled={loading}
      >
        <Heart className={cn('h-4 w-4', hasUserLiked && 'fill-current')} />
        <span className="text-sm">{reactionCount}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 hover:text-primary"
        onClick={onCommentClick}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="text-sm">{commentCount}</span>
      </Button>
    </div>
  );
}
