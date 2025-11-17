import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ActivityStatsProps {
  activityId: string;
}

export function ActivityStats({ activityId }: ActivityStatsProps) {
  const { user } = useAuth();
  const [reactionCount, setReactionCount] = useState(0);
  const [hasUserLiked, setHasUserLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();

    // Subscribe to realtime updates for reactions
    const reactionsChannel = supabase
      .channel(`activity-stats-reactions-${activityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_reactions',
          filter: `activity_id=eq.${activityId}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
    };
  }, [activityId, user]);

  const fetchStats = async () => {
    try {
      // Fetch reaction count
      const { count: reactions } = await supabase
        .from('activity_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', activityId);

      // Check if current user has liked
      if (user) {
        const { data: userReaction } = await supabase
          .from('activity_reactions')
          .select('id')
          .eq('activity_id', activityId)
          .eq('user_id', user.id)
          .eq('reaction_type', 'like')
          .maybeSingle();

        setHasUserLiked(!!userReaction);
      }

      setReactionCount(reactions || 0);
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
          .from('activity_reactions')
          .delete()
          .eq('activity_id', activityId)
          .eq('user_id', user.id)
          .eq('reaction_type', 'like');

        if (error) throw error;
      } else {
        // Add like
        const { error } = await supabase
          .from('activity_reactions')
          .insert({
            activity_id: activityId,
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
    </div>
  );
}
