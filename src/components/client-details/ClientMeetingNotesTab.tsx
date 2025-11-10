import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Paperclip, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MeetingNoteForm } from './MeetingNoteForm';

interface ClientMeetingNotesTabProps {
  clientId: string;
}

export function ClientMeetingNotesTab({ clientId }: ClientMeetingNotesTabProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
  }, [clientId]);

  const fetchNotes = async () => {
    try {
      const { data: notesData, error: notesError } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      // Fetch profiles separately for each note
      const notesWithProfiles = await Promise.all(
        (notesData || []).map(async (note) => {
          if (note.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', note.user_id)
              .single();
            
            return { ...note, profiles: profile };
          }
          return { ...note, profiles: null };
        })
      );

      setNotes(notesWithProfiles);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Erreur lors du chargement des comptes rendus');
    } finally {
      setLoading(false);
    }
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
      <Card>
        <CardContent className="pt-6">
          <MeetingNoteForm clientId={clientId} onNoteAdded={fetchNotes} />
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Aucun commentaire pour le moment
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => {
            const profile = note.profiles;
            const initials = profile
              ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
              : '?';
            const fullName = profile
              ? `${profile.first_name} ${profile.last_name}`
              : 'Utilisateur inconnu';

            return (
              <Card key={note.id}>
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      {note.attachment_url && (
                        <div className="flex items-center gap-2 pt-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            asChild
                          >
                            <a href={note.attachment_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3 mr-1" />
                              Télécharger la pièce jointe
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
