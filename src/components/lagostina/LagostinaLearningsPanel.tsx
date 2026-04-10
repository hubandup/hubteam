import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Trash2, MessageSquare, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Map main tab to levier key for learnings
const TAB_TO_LEVIER: Record<string, string> = {
  scorecard: 'media',
  influence: 'influence',
  mediatisation: 'media',
  budget: 'media',
};

interface Comment {
  id: string;
  tab: string;
  content: string;
  user_id: string;
  resolved: boolean;
  parent_id: string | null;
  created_at: string;
  author?: { first_name: string; last_name: string; avatar_url: string | null };
  replies?: Comment[];
}

interface LearningsData {
  works: string;
  does_not_work: string;
}

interface Props {
  activeTab: string;
}

export function LagostinaLearningsPanel({ activeTab }: Props) {
  const { role } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = role === 'admin' || role === 'team';
  const levierKey = TAB_TO_LEVIER[activeTab] || activeTab;

  // ─── Learnings ───
  const { data: learnings } = useQuery({
    queryKey: ['lagostina-learnings', levierKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_learnings')
        .select('*')
        .eq('levier', levierKey)
        .maybeSingle();
      if (error) throw error;
      return data ? { works: data.works || '', does_not_work: data.does_not_work || '' } : { works: '', does_not_work: '' };
    },
  });

  // Parse entries from stored newline-separated text
  const worksEntries = (learnings?.works || '').split('\n').filter(Boolean);
  const doesNotWorkEntries = (learnings?.does_not_work || '').split('\n').filter(Boolean);

  const [newWorks, setNewWorks] = useState('');
  const [newDoesNotWork, setNewDoesNotWork] = useState('');

  const saveLearning = useMutation({
    mutationFn: async (data: LearningsData) => {
      const { data: existing } = await supabase
        .from('lagostina_learnings')
        .select('id')
        .eq('levier', levierKey)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from('lagostina_learnings')
          .update({ ...data, updated_by: user?.id, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lagostina_learnings')
          .insert({ levier: levierKey, ...data, updated_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lagostina-learnings', levierKey] }),
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const addEntry = useCallback((field: 'works' | 'does_not_work', value: string) => {
    if (!value.trim()) return;
    const currentEntries = field === 'works' ? worksEntries : doesNotWorkEntries;
    const updated = [...currentEntries, value.trim()].join('\n');
    const current = learnings || { works: '', does_not_work: '' };
    saveLearning.mutate({ ...current, [field]: updated });
    if (field === 'works') setNewWorks('');
    else setNewDoesNotWork('');
  }, [worksEntries, doesNotWorkEntries, learnings, saveLearning]);

  const removeEntry = useCallback((field: 'works' | 'does_not_work', index: number) => {
    const currentEntries = field === 'works' ? [...worksEntries] : [...doesNotWorkEntries];
    currentEntries.splice(index, 1);
    const updated = currentEntries.join('\n');
    const current = learnings || { works: '', does_not_work: '' };
    saveLearning.mutate({ ...current, [field]: updated });
  }, [worksEntries, doesNotWorkEntries, learnings, saveLearning]);

  // ─── Comments ───
  const { data: comments = [] } = useQuery({
    queryKey: ['lagostina-comments', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_comments')
        .select('*')
        .eq('tab', activeTab)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const topLevel: Comment[] = [];
      const repliesMap = new Map<string, Comment[]>();

      for (const c of data) {
        const comment: Comment = {
          ...c,
          author: profileMap.get(c.user_id) || { first_name: '?', last_name: '', avatar_url: null },
        };
        if (c.parent_id) {
          const arr = repliesMap.get(c.parent_id) || [];
          arr.push(comment);
          repliesMap.set(c.parent_id, arr);
        } else {
          topLevel.push(comment);
        }
      }

      for (const c of topLevel) {
        c.replies = (repliesMap.get(c.id) || []).reverse();
      }

      return topLevel;
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('lagostina-comments-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lagostina_comments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['lagostina-comments', activeTab] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab, queryClient]);

  const [newComment, setNewComment] = useState('');
  const commentFilter = 'all';

  const addComment = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      const { error } = await supabase
        .from('lagostina_comments')
        .insert({ tab: activeTab, content, user_id: user!.id, parent_id: parentId || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['lagostina-comments', activeTab] });
    },
    onError: () => toast.error('Erreur'),
  });

  const toggleResolved = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase
        .from('lagostina_comments')
        .update({ resolved })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lagostina-comments', activeTab] }),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lagostina_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lagostina-comments', activeTab] }),
  });

  const filteredComments = comments;

  return (
    <div className="border border-border/20 bg-background dark:bg-[#111827] mt-4 rounded-[7px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/30">
        {/* Learnings columns */}
        <div className="p-5 space-y-3">
          <h3 className="text-xs font-['Roboto'] font-semibold uppercase tracking-wider text-[#22c55e]">
            Ce qui fonctionne ✅
          </h3>
          <div className="bg-green-50 dark:bg-green-900/20 min-h-[200px] p-3 space-y-2">
            {worksEntries.length === 0 && (
              <p className="text-muted-foreground font-['Roboto'] text-xs italic">Aucun élément</p>
            )}
            {worksEntries.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 group">
                <p className="flex-1 text-sm font-['Roboto'] text-foreground/80">• {entry}</p>
                {canEdit && (
                  <button onClick={() => removeEntry('works', i)} className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" title="Supprimer">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input
                value={newWorks}
                onChange={(e) => setNewWorks(e.target.value)}
                placeholder="Ajouter…"
                className="flex-1 bg-muted/50 border border-border/30 text-foreground font-['Roboto'] text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded"
                onKeyDown={(e) => { if (e.key === 'Enter' && newWorks.trim()) { e.preventDefault(); addEntry('works', newWorks); } }}
              />
              <button onClick={() => addEntry('works', newWorks)} disabled={!newWorks.trim()} className="p-2 text-primary hover:bg-primary/10 transition-colors disabled:opacity-30">
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <h3 className="text-xs font-['Roboto'] font-semibold uppercase tracking-wider text-[#ef4444]">
            Ce qui ne fonctionne pas ❌
          </h3>
          <div className="bg-red-50 dark:bg-red-900/20 min-h-[200px] p-3 space-y-2">
            {doesNotWorkEntries.length === 0 && (
              <p className="text-muted-foreground font-['Roboto'] text-xs italic">Aucun élément</p>
            )}
            {doesNotWorkEntries.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 group">
                <p className="flex-1 text-sm font-['Roboto'] text-foreground/80">• {entry}</p>
                {canEdit && (
                  <button onClick={() => removeEntry('does_not_work', i)} className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" title="Supprimer">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input
                value={newDoesNotWork}
                onChange={(e) => setNewDoesNotWork(e.target.value)}
                placeholder="Ajouter…"
                className="flex-1 bg-muted/50 border border-border/30 text-foreground font-['Roboto'] text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded"
                onKeyDown={(e) => { if (e.key === 'Enter' && newDoesNotWork.trim()) { e.preventDefault(); addEntry('does_not_work', newDoesNotWork); } }}
              />
              <button onClick={() => addEntry('does_not_work', newDoesNotWork)} disabled={!newDoesNotWork.trim()} className="p-2 text-primary hover:bg-primary/10 transition-colors disabled:opacity-30">
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="p-5 space-y-4">
          <h3 className="text-foreground font-['Instrument_Sans'] font-bold text-base">Comments</h3>

          {/* Comment input */}
          <div className="flex gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire…"
              className="flex-1 bg-muted/50 border border-border/30 text-foreground font-['Roboto'] text-sm p-2 resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
                  e.preventDefault();
                  addComment.mutate({ content: newComment.trim() });
                }
              }}
            />
            <button
              onClick={() => newComment.trim() && addComment.mutate({ content: newComment.trim() })}
              disabled={!newComment.trim()}
              className="self-end p-2 text-primary hover:bg-primary/10 transition-colors disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Comments list */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {filteredComments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-muted-foreground font-['Roboto'] text-xs">Aucun commentaire</p>
              </div>
            )}
            {filteredComments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={user?.id}
                onDelete={(id) => deleteComment.mutate(id)}
                onReply={(parentId, content) => addComment.mutate({ content, parentId })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  isReply = false,
}: {
  comment: Comment;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string) => void;
  isReply?: boolean;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const isOwn = currentUserId === comment.user_id;
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: false, locale: fr });

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(comment.id, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  return (
    <div className={`border-l-2 pl-3 py-1 space-y-1 ${isReply ? 'border-primary/20' : 'border-border/40'}`}>
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={comment.author?.avatar_url || undefined} />
          <AvatarFallback className="text-[9px] bg-muted">
            {comment.author?.first_name?.[0]}{comment.author?.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-['Roboto'] font-medium text-foreground">
          {comment.author?.first_name} {comment.author?.last_name}
        </span>
        <span className="text-xs text-muted-foreground font-['Roboto']">
          {timeAgo}
        </span>
        <div className="ml-auto flex gap-1">
          {!isReply && (
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="p-1 text-muted-foreground hover:text-primary transition-colors"
              title="Répondre"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm font-['Roboto'] text-foreground/80 whitespace-pre-wrap">{comment.content}</p>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onReply={onReply}
              isReply
            />
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <div className="ml-4 mt-2 flex gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Répondre…"
            className="flex-1 bg-muted/50 border border-border/30 text-foreground font-['Roboto'] text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded"
            onKeyDown={(e) => { if (e.key === 'Enter' && replyText.trim()) { e.preventDefault(); handleReply(); } }}
            autoFocus
          />
          <button onClick={handleReply} disabled={!replyText.trim()} className="p-1.5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-30">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
