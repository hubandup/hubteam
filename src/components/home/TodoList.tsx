import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2, ListTodo, Trash2, Edit, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  project_id: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

interface Client {
  id: string;
  company: string;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [convertProject, setConvertProject] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [hoveredTodoId, setHoveredTodoId] = useState<string | null>(null);

  useEffect(() => {
    fetchTodos();
    fetchProjects();
    fetchClients();

    const channel = supabase
      .channel('todos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        fetchTodos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTodos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
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

  const handleAddTodo = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !newTitle.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('todos')
        .insert({
          user_id: user.id,
          title: newTitle,
        });

      if (error) throw error;

      toast.success('Tâche ajoutée');
      setNewTitle('');
    } catch (error) {
      console.error('Error adding todo:', error);
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', todo.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling todo:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateTodo = async () => {
    if (!selectedTodo || !selectedTodo.title.trim()) return;

    try {
      const { error } = await supabase
        .from('todos')
        .update({
          title: selectedTodo.title,
          description: selectedTodo.description,
        })
        .eq('id', selectedTodo.id);

      if (error) throw error;

      toast.success('Tâche modifiée');
      setEditDialogOpen(false);
      setSelectedTodo(null);
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Erreur lors de la modification');
    }
  };


  const handleDeleteTodo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Tâche supprimée');
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleConvertToTask = async () => {
    if (!selectedTodo || !convertProject) {
      toast.error('Veuillez sélectionner un projet');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: convertProject,
          title: selectedTodo.title,
          description: selectedTodo.description,
          status: 'todo',
          priority: 'medium',
          assigned_to: user.id,
          created_by: user.id,
        });

      if (taskError) throw taskError;

      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('id', selectedTodo.id);

      if (deleteError) throw deleteError;

      toast.success('Tâche convertie en tâche de projet');
      setConvertDialogOpen(false);
      setSelectedTodo(null);
      setConvertProject('');
      setClientFilter('');
    } catch (error) {
      console.error('Error converting todo:', error);
      toast.error('Erreur lors de la conversion');
    }
  };

  const filteredProjects = clientFilter
    ? projects.filter(p => {
        // Check if project has this client
        return true; // We'll need to join with project_clients
      })
    : projects;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Ma to-do list
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
            <ListTodo className="h-5 w-5" />
            Ma to-do list
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Input
              placeholder="Ajouter une tâche... (Appuyez sur Entrée)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleAddTodo}
              className="w-full"
            />
          </div>

          {todos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune tâche à faire</p>
          ) : (
            <div className="space-y-2">
              {todos.filter(t => !t.completed).map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  onMouseEnter={() => setHoveredTodoId(todo.id)}
                  onMouseLeave={() => setHoveredTodoId(null)}
                >
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => handleToggleTodo(todo)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="text-xs text-muted-foreground truncate">{todo.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {hoveredTodoId === todo.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setSelectedTodo(todo);
                          setConvertDialogOpen(true);
                        }}
                      >
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Attribuer
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedTodo(todo);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteTodo(todo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
          </DialogHeader>
          {selectedTodo && (
            <div className="space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input
                  value={selectedTodo.title}
                  onChange={(e) => setSelectedTodo({ ...selectedTodo, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={selectedTodo.description || ''}
                  onChange={(e) => setSelectedTodo({ ...selectedTodo, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleUpdateTodo}>Enregistrer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to Task Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer à un projet</DialogTitle>
          </DialogHeader>
          {selectedTodo && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Tâche: <span className="font-medium text-foreground">{selectedTodo.title}</span>
                </p>
              </div>
              <div>
                <Label>Filtrer par client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tous les clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projet *</Label>
                <Select value={convertProject} onValueChange={setConvertProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un projet" />
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setConvertDialogOpen(false);
                  setClientFilter('');
                }}>Annuler</Button>
                <Button onClick={handleConvertToTask}>Convertir en tâche</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
