import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Lock, Unlock, Trash2, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { RichTextEditor } from '@/components/faq/RichTextEditor';
import { createSafeHtml, sanitizeHtml } from '@/lib/sanitize';

interface ProjectNote {
  id: string;
  content: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface ProjectNotesTabProps {
  projectId: string;
}

export function ProjectNotesTab({ projectId }: ProjectNotesTabProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel('project-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_notes', filter: `project_id=eq.${projectId}` }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('project_notes')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for each note
      const notesWithProfiles = await Promise.all(
        (data || []).map(async (note) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', note.created_by)
            .single();
          return { ...note, profiles: profile };
        })
      );

      setNotes(notesWithProfiles);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Erreur lors du chargement des notes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_notes')
        .insert([{
          project_id: projectId,
          content: newNote.trim(),
          is_private: isPrivate,
          created_by: user.id,
        }]);

      if (error) throw error;

      setNewNote('');
      setIsPrivate(false);
      toast.success('Note ajoutée');
      fetchNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Erreur lors de l\'ajout de la note');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Supprimer cette note ?')) return;

    try {
      const { error } = await supabase
        .from('project_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      toast.success('Note supprimée');
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleStartEdit = (note: ProjectNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditIsPrivate(note.is_private);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
    setEditIsPrivate(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !editingNoteId) return;

    try {
      const { error } = await supabase
        .from('project_notes')
        .update({
          content: editContent.trim(),
          is_private: editIsPrivate,
        })
        .eq('id', editingNoteId);

      if (error) throw error;

      toast.success('Note modifiée');
      handleCancelEdit();
      fetchNotes();
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const canEditNote = (note: ProjectNote) => {
    return user?.id === note.created_by;
  };

  const canDeleteNote = (note: ProjectNote) => {
    return user?.id === note.created_by || isAdmin;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Aucune note pour ce projet</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id} className={note.is_private ? 'border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10' : ''}>
              <CardContent className="pt-4">
                {editingNoteId === note.id ? (
                  <div className="space-y-4">
                    <RichTextEditor
                      value={editContent}
                      onChange={setEditContent}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-private-${note.id}`}
                          checked={editIsPrivate}
                          onCheckedChange={(checked) => setEditIsPrivate(checked as boolean)}
                        />
                        <label htmlFor={`edit-private-${note.id}`} className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer">
                          {editIsPrivate ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          Note privée
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                          <X className="h-4 w-4 mr-1" />
                          Annuler
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Save className="h-4 w-4 mr-1" />
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={note.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {note.profiles?.first_name?.[0]}{note.profiles?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {note.profiles?.first_name} {note.profiles?.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                          </span>
                          {note.is_private && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Privée
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {canEditNote(note) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleStartEdit(note)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteNote(note) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={createSafeHtml(note.content)}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Note Section */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Ajouter une note</h3>
          <RichTextEditor
            value={newNote}
            onChange={setNewNote}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-private"
                checked={isPrivate}
                onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
              />
              <label htmlFor="is-private" className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer">
                {isPrivate ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Note privée (visible uniquement par vous et les admins)
              </label>
            </div>
            <Button onClick={handleAddNote} disabled={!newNote.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Publier
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
