import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Paperclip, Download, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MeetingNoteForm } from './MeetingNoteForm';
import { ProtectedAction } from '@/components/ProtectedAction';

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
              .select('first_name, last_name, email, avatar_url')
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
      <ProtectedAction module="crm" action="create">
        <Card>
          <CardContent className="pt-6">
            <MeetingNoteForm clientId={clientId} onNoteAdded={fetchNotes} />
          </CardContent>
        </Card>
      </ProtectedAction>

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
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={fullName} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{fullName}</span>
                        {note.is_private && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Privé
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-foreground">{note.content}</p>
                      {note.attachment_url && (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-xs"
                          asChild
                        >
                          <a href={note.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            Télécharger la pièce jointe
                          </a>
                        </Button>
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
