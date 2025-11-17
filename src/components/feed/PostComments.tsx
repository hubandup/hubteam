import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { RichMentionInput } from '@/components/common/RichMentionInput';
import { Card } from '@/components/ui/card';
import { MessageCircle, Send, Trash2, Edit2, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  user?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface PostCommentsProps {
  postId: string;
}

export function PostComments({ postId }: PostCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [postId, showComments]);

  useEffect(() => {
    if (!showComments) return;

    const channel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_post_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, showComments]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('user_post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles for comments
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      const commentsWithUsers = data.map((comment) => ({
        ...comment,
        user: profiles?.find((p) => p.id === comment.user_id),
      }));

      setComments(commentsWithUsers);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('user_post_comments').insert({
        post_id: postId,
        user_id: user.id,
        content: newComment.trim(),
        parent_id: replyTo,
      });

      if (error) throw error;

      setNewComment('');
      setReplyTo(null);
      toast.success('Commentaire publié');
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error('Erreur lors de la publication');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const { error } = await supabase
        .from('user_post_comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      setEditingId(null);
      setEditContent('');
      toast.success('Commentaire modifié');
    } catch (error) {
      console.error('Error editing comment:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Supprimer ce commentaire ?')) return;

    try {
      const { error } = await supabase
        .from('user_post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Commentaire supprimé');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isOwner = user?.id === comment.user_id;
    const isEditing = editingId === comment.id;

    // Function to render content with mentions highlighted
    const renderContent = (content: string) => {
      const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = mentionRegex.exec(content)) !== null) {
        // Add text before mention
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        // Add mention with styling
        parts.push(
          <span key={match.index} className="text-primary font-medium">
            @{match[1]}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }
      // Add remaining text
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      return parts.length > 0 ? parts : content;
    };

    return (
      <div
        key={comment.id}
        className={`flex gap-3 ${isReply ? 'ml-12 mt-2' : 'mt-3'}`}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.user?.avatar_url || undefined} />
          <AvatarFallback>
            {comment.user?.first_name?.[0]}
            {comment.user?.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">
                {comment.user?.first_name} {comment.user?.last_name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <RichMentionInput
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Modifier votre commentaire..."
                  className="min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleEdit(comment.id)}
                    disabled={!editContent.trim()}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setEditContent('');
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{renderContent(comment.content)}</p>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 ml-1">
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                onClick={() => setReplyTo(comment.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Répondre
              </Button>
            )}
            {isOwner && !isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditContent(comment.content);
                  }}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Supprimer
                </Button>
              </>
            )}
          </div>
          {/* Render replies */}
          {comments
            .filter((c) => c.parent_id === comment.id)
            .map((reply) => renderComment(reply, true))}
        </div>
      </div>
    );
  };

  const commentCount = comments.length;

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowComments(!showComments)}
        className="text-muted-foreground hover:text-foreground"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        {commentCount > 0 ? `${commentCount} commentaire${commentCount > 1 ? 's' : ''}` : 'Commenter'}
      </Button>

      {showComments && (
        <Card className="mt-3 p-4">
          {/* Comment input */}
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user?.user_metadata?.first_name?.[0]}
                {user?.user_metadata?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              {replyTo && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Reply className="h-3 w-3" />
                  Réponse en cours...
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs hover:text-primary"
                    onClick={() => setReplyTo(null)}
                  >
                    Annuler
                  </Button>
                </div>
              )}
              <RichMentionInput
                value={newComment}
                onChange={setNewComment}
                placeholder="Écrivez un commentaire..."
                className="min-h-[60px]"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || loading}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Publier
                </Button>
              </div>
            </div>
          </div>

          {/* Comments list */}
          {comments
            .filter((c) => !c.parent_id)
            .map((comment) => renderComment(comment))}
        </Card>
      )}
    </div>
  );
}
