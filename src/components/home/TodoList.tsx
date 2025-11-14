import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2, ListTodo, Trash2, Edit, Copy, ArrowRight } from 'lucide-react';
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

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [newTodo, setNewTodo] = useState({ title: '', description: '' });
  const [convertProject, setConvertProject] = useState('');

  useEffect(() => {
    fetchTodos();
    fetchProjects();

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

  const handleAddTodo = async () => {
    if (!newTodo.title.trim()) {
      toast.error('Le titre est obligatoire');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('todos')
        .insert({
          user_id: user.id,
          title: newTodo.title,
          description: newTodo.description || null,
        });

      if (error) throw error;

      toast.success('Tâche ajoutée');
      setNewTodo({ title: '', description: '' });
      setAddDialogOpen(false);
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

  const handleDuplicateTodo = async (todo: Todo) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('todos')
        .insert({
          user_id: user.id,
          title: `${todo.title} (copie)`,
          description: todo.description,
        });

      if (error) throw error;
      toast.success('Tâche dupliquée');
    } catch (error) {
      console.error('Error duplicating todo:', error);
      toast.error('Erreur lors de la duplication');
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
    } catch (error) {
      console.error('Error converting todo:', error);
      toast.error('Erreur lors de la conversion');
    }
  };

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Ma to-do list
          </CardTitle>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle tâche</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Titre *</Label>
                  <Input
                    value={newTodo.title}
                    onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                    placeholder="Titre de la tâche"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newTodo.description}
                    onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                    placeholder="Description (optionnel)"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
                  <Button onClick={handleAddTodo}>Ajouter</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {todos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune tâche à faire</p>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => handleToggleTodo(todo)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="text-xs text-muted-foreground truncate">{todo.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedTodo(todo);
                        setConvertDialogOpen(true);
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDuplicateTodo(todo)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
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
            <DialogTitle>Convertir en tâche de projet</DialogTitle>
          </DialogHeader>
          {selectedTodo && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Tâche: <span className="font-medium text-foreground">{selectedTodo.title}</span>
                </p>
              </div>
              <div>
                <Label>Projet *</Label>
                <Select value={convertProject} onValueChange={setConvertProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleConvertToTask}>Convertir</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
