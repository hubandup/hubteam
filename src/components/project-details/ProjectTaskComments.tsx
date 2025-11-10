import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, Send, Paperclip, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  task_id: string | null;
  attachment_url: string | null;
  profiles: {
    first_name: string;
    last_name: string;
  };
  tasks: {
    title: string;
  } | null;
}

interface ProjectTaskCommentsProps {
  projectId: string;
}

export function ProjectTaskComments({ projectId }: ProjectTaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
        .select('id, title')
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
      // Get all tasks for this project first
      const { data: projectTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      const taskIds = projectTasks?.map(t => t.id) || [];

      // Fetch comments for all tasks in this project OR comments without task
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          task_id,
          attachment_url
        `)
        .or(`task_id.in.(${taskIds.join(',')}),task_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile and task data separately for each comment
      const commentsWithDetails = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
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
            profiles: profile || { first_name: '', last_name: '' },
            tasks: taskData
          };
        })
      );

      setComments(commentsWithDetails as Comment[]);
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
          task_id: selectedTaskId || null,
          user_id: user.id,
          attachment_url: attachmentUrl,
          project_id: projectId,
        });

      if (error) throw error;

      toast.success('Commentaire ajouté avec succès');
      setNewComment('');
      setSelectedFile(null);
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erreur lors de l\'ajout du commentaire');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tâche (optionnel)</label>
            <select
              value={selectedTaskId || ''}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Commentaire libre</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Commentaire</label>
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajoutez un commentaire..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Pièce jointe (optionnel)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={handleFileSelect}
                className="flex-1"
              />
              {selectedFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Fichier sélectionné : {selectedFile.name}
              </p>
            )}
          </div>

          <Button type="submit" disabled={submitting || uploading || !newComment.trim()}>
            {submitting || uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {uploading ? 'Envoi en cours...' : 'Envoyer'}
          </Button>
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
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback>
                      {comment.profiles?.first_name?.[0]}{comment.profiles?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {comment.profiles?.first_name} {comment.profiles?.last_name}
                      </p>
                      {comment.tasks && (
                        <span className="text-xs text-muted-foreground">
                          sur "{comment.tasks.title}"
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground break-words">{comment.content}</p>
                    {comment.attachment_url && (
                      <button
                        onClick={() => handleDownload(comment.attachment_url!, comment.attachment_url?.split('/').pop())}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Télécharger la pièce jointe
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun commentaire pour l'instant. Soyez le premier à commenter !
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
