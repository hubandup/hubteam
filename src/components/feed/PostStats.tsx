import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Heart, MessageCircle } from 'lucide-react';

interface PostStatsProps {
  postId: string;
}

export function PostStats({ postId }: PostStatsProps) {
  const [reactionCount, setReactionCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

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
  }, [postId]);

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

      setReactionCount(reactions || 0);
      setCommentCount(comments || 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Don't show if no reactions and no comments
  if (reactionCount === 0 && commentCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 mt-3 py-2 border-b text-sm text-muted-foreground">
      {reactionCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" />
          <span>{reactionCount} like{reactionCount > 1 ? 's' : ''}</span>
        </div>
      )}
      {commentCount > 0 && (
        <div className="flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4" />
          <span>{commentCount} commentaire{commentCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
