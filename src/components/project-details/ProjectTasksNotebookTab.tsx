import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Calendar as CalendarIcon, MessageSquare, User, Send, Check, ChevronsUpDown, Trash2, FolderPlus, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  end_date: string | null;
  position: number;
  comment_count?: number;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  email: string;
}

interface ProjectTasksNotebookTabProps {
  projectId: string;
  onTasksChange?: () => void;
}

export function ProjectTasksNotebookTab({ projectId, onTasksChange }: ProjectTasksNotebookTabProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskComments, setTaskComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [assignPopoverOpen, setAssignPopoverOpen] = useState<Record<string, boolean>>({});
  const [datePopoverOpen, setDatePopoverOpen] = useState<Record<string, boolean>>({});
  const [taskToConvert, setTaskToConvert] = useState<Task | null>(null);
  useEffect(() => {
    fetchTasks();
    fetchTeamMembers();

    const channel = supabase
      .channel('project-tasks-notebook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, () => {
        fetchTasks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `project_id=eq.${projectId}` }, () => {
        if (expandedTaskId) {
          fetchTaskComments(expandedTaskId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, assigned_to, end_date, position')
        .eq('project_id', projectId)
        .order('position', { ascending: true });

      if (error) throw error;

      // Fetch profile data and comment counts separately for each task
      const tasksWithProfilesAndCounts = await Promise.all(
        (data || []).map(async (task) => {
          // Fetch profile if assigned
          let profile = null;
          if (task.assigned_to) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, avatar_url')
              .eq('id', task.assigned_to)
              .single();
            profile = profileData;
          }
          
          // Fetch comment count
          const { count } = await supabase
            .from('task_comments')
            .select('*', { count: 'exact', head: true })
            .eq('task_id', task.id);
          
          return { ...task, profiles: profile, comment_count: count || 0 };
        })
      );

      setTasks(tasksWithProfilesAndCounts);
      onTasksChange?.();
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, email')
        .order('first_name');

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchTaskComments = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, content, created_at, user_id')
        .eq('task_id', taskId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profile data separately for each comment
      const commentsWithProfiles = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', comment.user_id)
            .single();
          
          return { ...comment, profiles: profile };
        })
      );

      setTaskComments(prev => ({ ...prev, [taskId]: commentsWithProfiles }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !newTaskTitle.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get max position for new task
      const maxPosition = tasks.length > 0 ? Math.max(...tasks.map(t => t.position || 0)) + 1 : 0;

      const newTaskData = {
        title: newTaskTitle.trim(),
        project_id: projectId,
        status: 'todo',
        priority: 'medium',
        created_by: user.id,
        position: 0, // New tasks go to top
      };

      // Mise à jour optimiste
      const tempTask: Task = {
        id: `temp-${Date.now()}`,
        title: newTaskData.title,
        status: newTaskData.status,
        assigned_to: null,
        end_date: null,
        position: 0,
        profiles: null,
      };
      
      setTasks(prev => [tempTask, ...prev.map(t => ({ ...t, position: t.position + 1 }))]);
      setNewTaskTitle('');

      const { data, error } = await supabase
        .from('tasks')
        .insert([newTaskData])
        .select()
        .single();

      if (error) throw error;

      // Remplacer la tâche temporaire par la vraie
      setTasks(prev => prev.map(t => t.id === tempTask.id ? { ...data, profiles: null, position: 0 } : t));
      onTasksChange?.();
      toast.success('Tâche ajoutée');
    } catch (error) {
      console.error('Error adding task:', error);
      // Retirer la tâche temporaire en cas d'erreur
      fetchTasks();
      toast.error('Erreur lors de l\'ajout de la tâche');
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      
      // Mise à jour optimiste
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      ));

      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      onTasksChange?.();
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Erreur lors de la mise à jour');
      // Revenir à l'état précédent
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // Mise à jour optimiste
      setTasks(prev => prev.filter(t => t.id !== taskId));

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      onTasksChange?.();
      toast.success('Tâche supprimée');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Erreur lors de la suppression');
      fetchTasks();
    }
  };

  const handleUpdateTitle = async (taskId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      toast.error('Le titre ne peut pas être vide');
      return false;
    }

    const originalTask = tasks.find(t => t.id === taskId);
    if (!originalTask || originalTask.title === trimmedTitle) return true;

    // Mise à jour optimiste
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, title: trimmedTitle } : t
    ));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ title: trimmedTitle })
        .eq('id', taskId);

      if (error) throw error;

      onTasksChange?.();
      return true;
    } catch (error) {
      console.error('Error updating task title:', error);
      // Rollback
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, title: originalTask.title } : t
      ));
      toast.error('Erreur lors de la mise à jour du titre');
      return false;
    }
  };

  const handleAssignUser = async (taskId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: userId })
        .eq('id', taskId);

      if (error) throw error;

      setAssignPopoverOpen(prev => ({ ...prev, [taskId]: false }));
      toast.success('Utilisateur assigné');
      fetchTasks();
    } catch (error) {
      console.error('Error assigning user:', error);
      toast.error('Erreur lors de l\'assignation');
    }
  };

  const handleSetDate = async (taskId: string, date: Date | undefined) => {
    if (!date) return;

    try {
      // Use format to get local date string (yyyy-MM-dd) to avoid timezone issues
      const { error } = await supabase
        .from('tasks')
        .update({ end_date: format(date, 'yyyy-MM-dd') })
        .eq('id', taskId);

      if (error) throw error;

      setDatePopoverOpen(prev => ({ ...prev, [taskId]: false }));
      toast.success('Date définie');
      fetchTasks();
    } catch (error) {
      console.error('Error setting date:', error);
      toast.error('Erreur lors de la définition de la date');
    }
  };

  const handleToggleComments = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
      fetchTaskComments(taskId);
    }
  };

  const handleAddComment = async (taskId: string) => {
    const content = newComment[taskId]?.trim();
    if (!content) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('task_comments')
        .insert([{
          task_id: taskId,
          project_id: projectId,
          user_id: user.id,
          content: content,
        }]);

      if (error) throw error;

      setNewComment(prev => ({ ...prev, [taskId]: '' }));
      fetchTaskComments(taskId);
      // Update comment count
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t
      ));
      toast.success('Commentaire ajouté');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erreur lors de l\'ajout du commentaire');
    }
  };

  const handleConvertToProject = async () => {
    if (!taskToConvert) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer le client du projet actuel
      const { data: projectData } = await supabase
        .from('project_clients')
        .select('client_id')
        .eq('project_id', projectId)
        .single();

      // Créer le nouveau projet avec le nom de la tâche
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert([{
          name: taskToConvert.title,
          status: 'planning',
          created_by: user.id,
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      // Associer le client au nouveau projet s'il existe
      if (projectData?.client_id) {
        await supabase
          .from('project_clients')
          .insert([{
            project_id: newProject.id,
            client_id: projectData.client_id,
          }]);
      }

      // Supprimer la tâche originale
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToConvert.id);

      if (deleteError) throw deleteError;

      toast.success('Tâche convertie en projet');
      setTaskToConvert(null);
      fetchTasks();
      onTasksChange?.();

      // Naviguer vers le nouveau projet
      navigate(`/project/${newProject.id}`);
    } catch (error) {
      console.error('Error converting task to project:', error);
      toast.error('Erreur lors de la conversion');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Mise à jour optimiste
        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
        setTasks(reorderedTasks);

        // Mettre à jour les positions en base
        try {
          const updates = reorderedTasks.map((task, index) => ({
            id: task.id,
            position: index,
          }));

          for (const update of updates) {
            await supabase
              .from('tasks')
              .update({ position: update.position })
              .eq('id', update.id);
          }
        } catch (error) {
          console.error('Error updating task positions:', error);
          toast.error('Erreur lors de la réorganisation');
          fetchTasks(); // Revenir à l'état précédent
        }
      }
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
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Tâches du projet</h2>
        
        {/* Add Task Input */}
        <div>
          <Input
            placeholder="Ajouter une tâche... (Appuyez sur Entrée)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleAddTask}
            className="w-full"
          />
        </div>

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune tâche</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    expandedTaskId={expandedTaskId}
                    taskComments={taskComments}
                    newComment={newComment}
                    assignPopoverOpen={assignPopoverOpen}
                    datePopoverOpen={datePopoverOpen}
                    teamMembers={teamMembers}
                    onToggleTask={handleToggleTask}
                    onAssignUser={handleAssignUser}
                    onSetDate={handleSetDate}
                    onToggleComments={handleToggleComments}
                    onAddComment={handleAddComment}
                    onDeleteTask={handleDeleteTask}
                    onConvertToProject={setTaskToConvert}
                    onCommentChange={(taskId, value) => setNewComment(prev => ({ ...prev, [taskId]: value }))}
                    onAssignPopoverChange={(taskId, open) => setAssignPopoverOpen(prev => ({ ...prev, [taskId]: open }))}
                    onDatePopoverChange={(taskId, open) => setDatePopoverOpen(prev => ({ ...prev, [taskId]: open }))}
                    onUpdateTitle={handleUpdateTitle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Convert to Project Confirmation Dialog */}
      <AlertDialog open={!!taskToConvert} onOpenChange={() => setTaskToConvert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transformer en projet</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous transformer la tâche "{taskToConvert?.title}" en nouveau projet ? La tâche sera supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToProject}>
              Créer le projet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Sortable Task Item Component
interface SortableTaskItemProps {
  task: Task;
  expandedTaskId: string | null;
  taskComments: Record<string, Comment[]>;
  newComment: Record<string, string>;
  assignPopoverOpen: Record<string, boolean>;
  datePopoverOpen: Record<string, boolean>;
  teamMembers: TeamMember[];
  onToggleTask: (taskId: string, status: string) => void;
  onAssignUser: (taskId: string, userId: string) => void;
  onSetDate: (taskId: string, date: Date | undefined) => void;
  onToggleComments: (taskId: string) => void;
  onAddComment: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onConvertToProject: (task: Task) => void;
  onCommentChange: (taskId: string, value: string) => void;
  onAssignPopoverChange: (taskId: string, open: boolean) => void;
  onDatePopoverChange: (taskId: string, open: boolean) => void;
  onUpdateTitle: (taskId: string, newTitle: string) => Promise<boolean>;
}

function SortableTaskItem({
  task,
  expandedTaskId,
  taskComments,
  newComment,
  assignPopoverOpen,
  datePopoverOpen,
  teamMembers,
  onToggleTask,
  onAssignUser,
  onSetDate,
  onToggleComments,
  onAddComment,
  onDeleteTask,
  onConvertToProject,
  onCommentChange,
  onAssignPopoverChange,
  onDatePopoverChange,
  onUpdateTitle,
}: SortableTaskItemProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Sync editedTitle when task.title changes externally
  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(task.title);
    }
  }, [task.title, isEditingTitle]);

  const handleTitleClick = () => {
    if (task.status !== 'done') {
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = async () => {
    const success = await onUpdateTitle(task.id, editedTitle);
    if (success) {
      setIsEditingTitle(false);
    } else {
      // Reset to original title on failure
      setEditedTitle(task.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditedTitle(task.title);
      setIsEditingTitle(false);
    }
  };

  const handleTitleBlur = () => {
    if (editedTitle.trim() !== task.title) {
      handleTitleSave();
    } else {
      setIsEditingTitle(false);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      {/* Task Row */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Checkbox
          checked={task.status === 'done'}
          onCheckedChange={() => onToggleTask(task.id, task.status)}
        />
        
        {isEditingTitle ? (
          <Input
            ref={titleInputRef}
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleTitleBlur}
            className="flex-1 h-auto py-0 px-1 text-sm border-0 border-b border-primary bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
          />
        ) : (
          <p 
            onClick={handleTitleClick}
            className={cn(
              "flex-1 text-sm cursor-text hover:bg-muted/50 rounded px-1 -mx-1",
              task.status === 'done' && "line-through text-muted-foreground cursor-default hover:bg-transparent"
            )}
          >
            {task.title}
          </p>
        )}

        {/* Assign User */}
        <Popover 
          open={assignPopoverOpen[task.id]} 
          onOpenChange={(open) => onAssignPopoverChange(task.id, open)}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {task.profiles ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={task.profiles.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {task.profiles.first_name[0]}{task.profiles.last_name[0]}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <User className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher..." />
              <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {teamMembers.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={`${member.first_name} ${member.last_name}`}
                    onSelect={() => onAssignUser(task.id, member.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        task.assigned_to === member.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Avatar className="h-6 w-6 mr-2">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {member.first_name[0]}{member.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    {member.first_name} {member.last_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Set Date */}
        <Popover 
          open={datePopoverOpen[task.id]} 
          onOpenChange={(open) => onDatePopoverChange(task.id, open)}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                {task.end_date && (
                  <span className="text-xs">
                    {format(new Date(task.end_date), 'dd/MM', { locale: fr })}
                  </span>
                )}
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.end_date ? new Date(task.end_date) : undefined}
              onSelect={(date) => onSetDate(task.id, date)}
              locale={fr}
            />
          </PopoverContent>
        </Popover>

        {/* Comments Toggle */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2 gap-1"
          onClick={() => onToggleComments(task.id)}
        >
          <MessageSquare className={cn(
            "h-4 w-4",
            expandedTaskId === task.id && "text-primary"
          )} />
          {(task.comment_count || 0) > 0 && (
            <span className={cn(
              "text-xs font-medium",
              expandedTaskId === task.id ? "text-primary" : "text-muted-foreground"
            )}>
              {task.comment_count}
            </span>
          )}
        </Button>

        {/* Convert to Project */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onConvertToProject(task)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Transformer en projet</p>
          </TooltipContent>
        </Tooltip>

        {/* Delete Task */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDeleteTask(task.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Comments Section */}
      {expandedTaskId === task.id && (
        <div className="ml-10 space-y-3 p-4 bg-muted/30 rounded-lg border">
          {/* Existing Comments */}
          {taskComments[task.id]?.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {comment.profiles?.first_name[0]}{comment.profiles?.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.profiles?.first_name} {comment.profiles?.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), 'dd MMM à HH:mm', { locale: fr })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{comment.content}</p>
              </div>
            </div>
          ))}

          {/* Add Comment */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Écrivez un commentaire... (Entrée pour publier)"
              value={newComment[task.id] || ''}
              onChange={(e) => onCommentChange(task.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onAddComment(task.id);
                }
              }}
              className="flex-1 min-h-[60px]"
            />
            <Button 
              size="icon"
              onClick={() => onAddComment(task.id)}
              disabled={!newComment[task.id]?.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
