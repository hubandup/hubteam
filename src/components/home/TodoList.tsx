import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Loader2, ListTodo, Trash2, ArrowRight, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  project_clients?: { client_id: string }[];
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
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [convertProject, setConvertProject] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
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

      const newTodo = {
        title: newTitle.trim(),
        user_id: user.id,
        completed: false,
        description: null,
        project_id: null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('todos')
        .insert([newTodo])
        .select()
        .single();

      if (error) throw error;
      
      // Ajout optimiste dans l'état local
      if (data) {
        setTodos(prev => [data, ...prev]);
      }
      
      setNewTitle('');
      toast.success('Tâche ajoutée');
    } catch (error) {
      console.error('Error adding todo:', error);
      toast.error('Erreur lors de l\'ajout de la tâche');
    }
  };

  const handleToggleTodo = async (id: string, currentCompleted: boolean) => {
    try {
      // Mise à jour optimiste
      setTodos(prev => prev.map(todo => 
        todo.id === id ? { ...todo, completed: !currentCompleted } : todo
      ));

      const { error } = await supabase
        .from('todos')
        .update({ completed: !currentCompleted })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling todo:', error);
      toast.error('Erreur lors de la mise à jour');
      // Revenir à l'état précédent en cas d'erreur
      setTodos(prev => prev.map(todo => 
        todo.id === id ? { ...todo, completed: currentCompleted } : todo
      ));
    }
  };

  const handleStartEdit = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
  };

  const handleSaveEdit = async (todoId: string) => {
    if (!editingTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('todos')
        .update({ title: editingTitle.trim() })
        .eq('id', todoId);

      if (error) throw error;
      
      setTodos(prev => prev.map(t => 
        t.id === todoId ? { ...t, title: editingTitle.trim() } : t
      ));
      
      setEditingTodoId(null);
      toast.success('Tâche mise à jour');
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      // Mise à jour optimiste
      setTodos(prev => prev.filter(todo => todo.id !== id));

      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Tâche supprimée');
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast.error('Erreur lors de la suppression');
      // Recharger les todos en cas d'erreur
      fetchTodos();
    }
  };

  const handleConvertToTask = async () => {
    if (!selectedTodo || !convertProject) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: taskError } = await supabase
        .from('tasks')
        .insert([{
          title: selectedTodo.title,
          description: selectedTodo.description,
          project_id: convertProject,
          status: 'todo',
          priority: 'medium',
          created_by: user.id,
        }]);

      if (taskError) throw taskError;

      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('id', selectedTodo.id);

      if (deleteError) throw deleteError;

      toast.success('Tâche convertie avec succès');
      setConvertDialogOpen(false);
      setConvertProject('');
      setSelectedClient(null);
    } catch (error) {
      console.error('Error converting todo:', error);
      toast.error('Erreur lors de la conversion');
    }
  };

  const filteredProjects = selectedClient
    ? projects.filter(project => 
        project.project_clients?.some(pc => pc.client_id === selectedClient.id)
      )
    : projects;

  if (loading) {
    return (
      <div className="border rounded-lg bg-card/50 p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <ListTodo className="h-4 w-4 md:h-5 md:w-5" />
          <h2 className="text-base md:text-lg font-semibold">Ma to-do list</h2>
        </div>
        <div className="flex items-center justify-center py-8 md:py-12">
          <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg bg-card/50 p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <ListTodo className="h-4 w-4 md:h-5 md:w-5" />
          <h2 className="text-base md:text-lg font-semibold">Ma to-do list</h2>
        </div>
        <div className="space-y-2 md:space-y-3">
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
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-start gap-2 md:gap-3 p-2 md:p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                onMouseEnter={() => setHoveredTodoId(todo.id)}
                onMouseLeave={() => setHoveredTodoId(null)}
              >
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => handleToggleTodo(todo.id, todo.completed)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    {editingTodoId === todo.id ? (
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(todo.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onBlur={() => handleSaveEdit(todo.id)}
                        autoFocus
                        className="h-7 text-sm"
                      />
                    ) : (
                      <p 
                        className={cn(
                          "text-sm break-words cursor-pointer hover:text-primary transition-colors",
                          todo.completed && "line-through text-muted-foreground"
                        )}
                        onClick={() => handleStartEdit(todo)}
                      >
                        {todo.title}
                      </p>
                    )}
                    {todo.description && (
                      <p className="text-xs text-muted-foreground mt-1">{todo.description}</p>
                    )}
                  </div>
                  {hoveredTodoId === todo.id && editingTodoId !== todo.id && (
                    <div className="flex gap-1 opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedTodo(todo);
                          setConvertDialogOpen(true);
                        }}
                        className="h-7 w-7"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer à un projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                    {selectedClient ? <span className="uppercase">{selectedClient.company}</span> : "Sélectionner un client..."}
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
                            setConvertProject('');
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="uppercase">{client.company}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Projet</Label>
              <Select 
                value={convertProject} 
                onValueChange={setConvertProject}
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
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setConvertDialogOpen(false);
                setSelectedClient(null);
                setConvertProject('');
              }}>
                Annuler
              </Button>
              <Button onClick={handleConvertToTask} disabled={!convertProject}>
                Convertir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
