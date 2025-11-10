import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Loader2, Paperclip, Download } from 'lucide-react';
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
      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
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
      <MeetingNoteForm clientId={clientId} onNoteAdded={fetchNotes} />
      
      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Aucun compte rendu de réunion pour le moment
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
        <Card key={note.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{note.title}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(new Date(note.meeting_date), 'dd MMMM yyyy', { locale: fr })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground whitespace-pre-wrap">{note.content}</p>
            {note.attachment_url && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto"
                  asChild
                >
                  <a href={note.attachment_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger la pièce jointe
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
          </Card>
          ))}
        </div>
      )}
    </div>
  );
}
