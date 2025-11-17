import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Heart, Flame, PartyPopper, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

interface PostReactionsProps {
  postId: string;
}

const REACTION_TYPES = [
  { type: 'love', icon: Heart, label: 'Adore', color: 'text-red-500' },
  { type: 'like', icon: ThumbsUp, label: "J'aime", color: 'text-blue-500' },
  { type: 'fire', icon: Flame, label: 'Impressionnant', color: 'text-orange-500' },
  { type: 'celebrate', icon: PartyPopper, label: 'Félicitations', color: 'text-purple-500' },
];

export function PostReactions({ postId }: PostReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReactions();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`post-reactions-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_post_reactions',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const fetchReactions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_post_reactions')
        .select('*')
        .eq('post_id', postId);

      if (error) throw error;
      setReactions(data || []);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  };

  const addReaction = async (reactionType: string) => {
    if (!user) return;

    // Check if user already reacted with this type
    const existingReaction = reactions.find(
      r => r.user_id === user.id && r.reaction_type === reactionType
    );

    if (existingReaction) {
      // Remove reaction
      try {
        setLoading(true);
        const { error } = await supabase
          .from('user_post_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error removing reaction:', error);
        toast.error('Erreur lors de la suppression de la réaction');
      } finally {
        setLoading(false);
      }
    } else {
      // Add reaction
      try {
        setLoading(true);
        const { error } = await supabase
          .from('user_post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType,
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error adding reaction:', error);
        toast.error("Erreur lors de l'ajout de la réaction");
      } finally {
        setLoading(false);
      }
    }
  };

  // Group reactions by type
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.reaction_type]) {
      acc[reaction.reaction_type] = [];
    }
    acc[reaction.reaction_type].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const hasUserReacted = (reactionType: string) => {
    return reactions.some(
      r => r.user_id === user?.id && r.reaction_type === reactionType
    );
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      {/* Display existing reactions */}
      {Object.entries(groupedReactions).map(([type, reactionList]) => {
        const reactionConfig = REACTION_TYPES.find(r => r.type === type);
        if (!reactionConfig) return null;

        const Icon = reactionConfig.icon;
        const isUserReacted = hasUserReacted(type);

        return (
          <Button
            key={type}
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1.5 px-2',
              isUserReacted && 'bg-accent'
            )}
            onClick={() => addReaction(type)}
            disabled={loading}
          >
            <Icon className={cn('h-4 w-4', reactionConfig.color)} />
            <span className="text-xs font-medium">{reactionList.length}</span>
          </Button>
        );
      })}

      {/* Add reaction popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={loading}
          >
            <Heart className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {REACTION_TYPES.map((reaction) => {
              const Icon = reaction.icon;
              const isReacted = hasUserReacted(reaction.type);

              return (
                <Button
                  key={reaction.type}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-10 w-10 p-0',
                    isReacted && 'bg-accent'
                  )}
                  onClick={() => addReaction(reaction.type)}
                  title={reaction.label}
                >
                  <Icon className={cn('h-5 w-5', reaction.color)} />
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
