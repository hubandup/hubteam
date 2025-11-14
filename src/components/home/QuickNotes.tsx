import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StickyNote, Loader2, Trash2, ArrowRight, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NoteEditor } from './NoteEditor';

interface QuickNote {
  id: string;
  content: string;
  task_id: string | null;
  meeting_note_id: string | null;
  created_at: string;
}

interface Client {
  id: string;
  company: string;
}

interface Project {
  id: string;
  name: string;
  project_clients?: { client_id: string }[];
}

interface Task {
  id: string;
  title: string;
}

export function QuickNotes() {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<QuickNote | null>(null);
  const [assignType, setAssignType] = useState<'task' | 'meeting'>('task');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
    fetchClients();
    fetchProjects();

    const channel = supabase
      .channel('quick-notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quick_notes' }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchTasksForProject(selectedProject);
    }
  }, [selectedProject]);

  const fetchNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('quick_notes')
        .select('*')
        .eq('user_id', user.id)
        .is('task_id', null)
        .is('meeting_note_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Erreur lors du chargement des notes');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company')
        .eq('active', true)
        .order('company');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, 
          name,
          project_clients(client_id)
        `)
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchTasksForProject = async (projectId: string) => {
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

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('quick_notes')
        .insert([{
          content: noteContent,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setNotes(prev => [data, ...prev]);
        // Extract and save mentions
        await saveMentions(data.id, noteContent);
      }

      setNoteContent('');
      toast.success('Note ajoutée');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error("Erreur lors de l'ajout de la note");
    }
  };

  const saveMentions = async (noteId: string, content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push({ note_id: noteId, user_id: match[2] });
    }

    if (mentions.length > 0) {
      await supabase.from('quick_note_mentions').insert(mentions);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      setNotes(prev => prev.filter(note => note.id !== id));

      const { error } = await supabase
        .from('quick_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Note supprimée');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Erreur lors de la suppression');
      fetchNotes();
    }
  };

  const handleAssignNote = async () => {
    if (!selectedNote) return;

    try {
      if (assignType === 'task' && selectedTask) {
        const { error } = await supabase
          .from('quick_notes')
          .update({ task_id: selectedTask })
          .eq('id', selectedNote.id);

        if (error) throw error;
        toast.success('Note attribuée à la tâche');
      } else if (assignType === 'meeting' && selectedClient) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('meeting_notes')
          .insert([{
            client_id: selectedClient.id,
            content: selectedNote.content,
            user_id: user.id,
          }]);

        if (error) throw error;

        await supabase
          .from('quick_notes')
          .delete()
          .eq('id', selectedNote.id);

        toast.success('Note convertie en compte rendu');
      }

      setAssignDialogOpen(false);
      setSelectedNote(null);
      setSelectedClient(null);
      setSelectedProject('');
      setSelectedTask('');
      fetchNotes();
    } catch (error) {
      console.error('Error assigning note:', error);
      toast.error("Erreur lors de l'attribution");
    }
  };

  const filteredProjects = selectedClient
    ? projects.filter(project => 
        project.project_clients?.some(pc => pc.client_id === selectedClient.id)
      )
    : projects;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes rapides
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes rapides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <NoteEditor
              value={noteContent}
              onChange={setNoteContent}
              placeholder="Écrire une note rapide... (utilisez @ pour mentionner quelqu'un)"
            />
            <Button 
              onClick={handleAddNote} 
              disabled={!noteContent.trim()}
              className="w-full"
            >
              Ajouter la note
            </Button>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune note</p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                  onMouseEnter={() => setHoveredNoteId(note.id)}
                  onMouseLeave={() => setHoveredNoteId(null)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 text-sm"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    {hoveredNoteId === note.id && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedNote(note);
                            setAssignDialogOpen(true);
                          }}
                          className="h-7 w-7"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteNote(note.id)}
                          className="h-7 w-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer la note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={assignType} onValueChange={(value: 'task' | 'meeting') => {
                setAssignType(value);
                setSelectedClient(null);
                setSelectedProject('');
                setSelectedTask('');
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Tâche de projet</SelectItem>
                  <SelectItem value="meeting">Compte rendu client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Client</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientPopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedClient ? selectedClient.company : "Sélectionner un client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher un client..." />
                    <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.company}
                          onSelect={() => {
                            setSelectedClient(client);
                            setSelectedProject('');
                            setSelectedTask('');
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {client.company}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {assignType === 'task' && (
              <>
                <div>
                  <Label>Projet</Label>
                  <Select 
                    value={selectedProject} 
                    onValueChange={setSelectedProject}
                    disabled={!selectedClient}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedClient ? "Sélectionner un projet" : "Sélectionnez d'abord un client"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tâche</Label>
                  <Select 
                    value={selectedTask} 
                    onValueChange={setSelectedTask}
                    disabled={!selectedProject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedProject ? "Sélectionner une tâche" : "Sélectionnez d'abord un projet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setAssignDialogOpen(false);
                setSelectedNote(null);
                setSelectedClient(null);
                setSelectedProject('');
                setSelectedTask('');
              }}>
                Annuler
              </Button>
              <Button 
                onClick={handleAssignNote} 
                disabled={
                  !selectedClient || 
                  (assignType === 'task' && (!selectedProject || !selectedTask))
                }
              >
                Attribuer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
