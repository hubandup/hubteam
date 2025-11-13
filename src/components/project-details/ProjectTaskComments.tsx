import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, Send, Paperclip, X, Download, Tag, Edit2, Trash2, Reply } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { MentionInput } from '@/components/common/MentionInput';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  task_id: string | null;
  attachment_url: string | null;
  parent_id: string | null;
  profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  tasks: {
    title: string;
  } | null;
  replies?: Comment[];
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
}

interface ProjectTaskCommentsProps {
  projectId: string;
}

export function ProjectTaskComments({ projectId }: ProjectTaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('none');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [editingMentions, setEditingMentions] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchTasks();
    fetchComments();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('project-task-comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, status')
        .eq('project_id', projectId)
        .order('title');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchComments = async () => {
    try {
      // Fetch comments for this project only
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          task_id,
          attachment_url,
          parent_id
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile and task data separately for each comment
      const commentsWithDetails = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', comment.user_id)
            .single();
          
          let taskData = null;
          if (comment.task_id) {
            const { data: task } = await supabase
              .from('tasks')
              .select('title')
              .eq('id', comment.task_id)
              .single();
            taskData = task;
          }
          
          return { 
            ...comment, 
            profiles: profile || { first_name: '', last_name: '', avatar_url: null },
            tasks: taskData,
            replies: []
          };
        })
      );

      // Organize comments into threads (parent comments with their replies)
      const topLevelComments: Comment[] = [];
      const commentMap = new Map<string, Comment>();

      // First pass: create a map of all comments
      commentsWithDetails.forEach((comment) => {
        commentMap.set(comment.id, comment);
      });

      // Second pass: organize into threads
      commentsWithDetails.forEach((comment) => {
        if (comment.parent_id) {
          // This is a reply, add it to parent's replies
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            if (!parent.replies) parent.replies = [];
            parent.replies.push(comment);
            // Sort replies by date (oldest first for natural conversation flow)
            parent.replies.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          }
        } else {
          // This is a top-level comment
          topLevelComments.push(comment);
        }
      });

      setComments(topLevelComments as Comment[]);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Erreur lors du chargement des commentaires');
    } finally {
      setLoading(false);
    }
  };

  const getFileUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('project-attachments')
      .createSignedUrl(filePath, 3600); // URL valid for 1 hour
    return data?.signedUrl || '';
  };

  const handleDownload = async (filePath: string, fileName?: string) => {
    const url = await getFileUrl(filePath);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'attachment';
      link.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim() || !user) {
      toast.error('Veuillez saisir un commentaire');
      return;
    }

    setSubmitting(true);
    setUploading(true);

    try {
      let attachmentUrl = null;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-attachments')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        attachmentUrl = fileName; // Store the file path, not the URL
      }

      const { error } = await supabase
        .from('task_comments')
        .insert({
          content: newComment.trim(),
          task_id: selectedTaskId === 'none' ? null : selectedTaskId,
          user_id: user.id,
          attachment_url: attachmentUrl,
          project_id: projectId,
        });

      if (error) throw error;

      toast.success('Commentaire ajouté avec succès');
      setNewComment('');
      setMentions([]);
      setSelectedFile(null);
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error("Erreur lors de l'ajout du commentaire");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const renderCommentContent = (content: string) => {
    // Replace mention format with highlighted text
    const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 3 === 1) {
        return (
          <span key={index} className="font-semibold text-primary">
            @{part}
          </span>
        );
      } else if (index % 3 === 2) {
        return null;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditedContent(comment.content);
    setEditingMentions([]);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditedContent('');
    setEditingMentions([]);
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editedContent.trim()) {
      toast.error('Le commentaire ne peut pas être vide');
      return;
    }

    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: editedContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Commentaire modifié avec succès');
      handleCancelEdit();
      fetchComments();
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Erreur lors de la modification du commentaire');
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentToDelete);

      if (error) throw error;

      toast.success('Commentaire supprimé avec succès');
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Erreur lors de la suppression du commentaire');
    }
  };

  const openDeleteDialog = (commentId: string) => {
    setCommentToDelete(commentId);
    setDeleteDialogOpen(true);
  };

  const getTaskBadgeColor = (priority: string, isSelected: boolean) => {
    if (!isSelected) return 'outline';
    
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyContent('');
    setReplyMentions([]);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyContent('');
    setReplyMentions([]);
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !user) {
      toast.error('Veuillez saisir une réponse');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          content: replyContent.trim(),
          task_id: null, // Replies inherit context from parent
          user_id: user.id,
          attachment_url: null,
          project_id: projectId,
          parent_id: parentId,
        });

      if (error) throw error;

      toast.success('Réponse ajoutée avec succès');
      handleCancelReply();
      fetchComments();
    } catch (error) {
      console.error('Error adding reply:', error);
      toast.error("Erreur lors de l'ajout de la réponse");
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyingTo === comment.id;
    const indentClass = depth > 0 ? 'ml-12 border-l-2 border-border pl-4' : '';

    return (
      <div key={comment.id} className={`${indentClass}`}>
        <div className="flex gap-3 py-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            {comment.profiles?.avatar_url && (
              <AvatarImage 
                src={comment.profiles.avatar_url} 
                alt={`${comment.profiles?.first_name} ${comment.profiles?.last_name}`} 
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {comment.profiles?.first_name?.[0]}{comment.profiles?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">
                {comment.profiles?.first_name} {comment.profiles?.last_name}
              </p>
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
              </span>
              {comment.user_id === user?.id && (
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditComment(comment)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(comment.id)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {comment.tasks && (
              <Badge variant="outline" className="mt-1 text-xs gap-1">
                <Tag className="h-3 w-3" />
                {comment.tasks.title}
              </Badge>
            )}
            
            {isEditing ? (
              <div className="space-y-2 pt-2">
                <MentionInput
                  value={editedContent}
                  onChange={setEditedContent}
                  onMentionsChange={setEditingMentions}
                  placeholder="Modifier le commentaire..."
                  rows={3}
                  className="w-full"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleUpdateComment(comment.id)}
                    disabled={!editedContent.trim()}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground break-words whitespace-pre-wrap">
                  {renderCommentContent(comment.content)}
                </p>
                {comment.attachment_url && (
                  <button
                    onClick={() => handleDownload(comment.attachment_url!, comment.attachment_url?.split('/').pop())}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <Paperclip className="h-3 w-3" />
                    Télécharger la pièce jointe
                  </button>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReply(comment.id)}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Répondre
                  </Button>
                  {comment.replies && comment.replies.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {comment.replies.length} {comment.replies.length === 1 ? 'réponse' : 'réponses'}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="ml-12 mb-3 space-y-2">
            <div className="flex items-start gap-2 p-3 border border-input rounded-lg bg-muted/50">
              <MentionInput
                value={replyContent}
                onChange={setReplyContent}
                onMentionsChange={setReplyMentions}
                placeholder="Écrire une réponse..."
                rows={2}
                className="flex-1 resize-none border-0 p-0 focus-visible:ring-0 shadow-none bg-transparent"
                disabled={submitting}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelReply}
                  className="h-8 w-8 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={submitting || !replyContent.trim()}
                  className="h-8 w-8 shrink-0 rounded-lg bg-primary hover:bg-primary/90"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Render replies recursively */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Commentaires des tâches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add comment form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Associer à une tâche (optionnel)
            </label>
            <div className="flex flex-wrap gap-2">
              {tasks.map((task) => (
                <Badge
                  key={task.id}
                  variant={getTaskBadgeColor(task.priority, selectedTaskId === task.id) as any}
                  className="cursor-pointer px-3 py-1.5 text-sm transition-all hover:scale-105"
                  onClick={() => setSelectedTaskId(selectedTaskId === task.id ? 'none' : task.id)}
                >
                  {task.title}
                </Badge>
              ))}
            </div>
          </div>

          <div className="border border-input rounded-lg bg-background">
            <div className="flex gap-2 p-4">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                onMentionsChange={setMentions}
                placeholder="Ajouter un commentaire... (utilisez @ pour mentionner)"
                rows={3}
                className="flex-1 resize-none border-0 p-0 focus-visible:ring-0 shadow-none bg-transparent min-h-[80px]"
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-4 pb-4">
              <label htmlFor="task-comment-file" className="cursor-pointer">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <span>
                    <Paperclip className="h-5 w-5" />
                  </span>
                </Button>
              </label>
              <input
                id="task-comment-file"
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="submit"
                size="icon"
                disabled={submitting || uploading || !newComment.trim()}
                className="h-10 w-10 shrink-0 rounded-lg bg-primary hover:bg-primary/90"
              >
                {submitting || uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md w-fit">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{selectedFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </form>

        {/* Comments list */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="font-semibold text-sm text-muted-foreground">
            Tous les commentaires ({comments.length})
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => renderComment(comment))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun commentaire pour l'instant. Soyez le premier à commenter !
            </p>
          )}
        </div>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le commentaire</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce commentaire ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCommentToDelete(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
