import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  FileText, 
  CheckSquare, 
  MessageSquare, 
  FolderKanban, 
  Users, 
  Clock,
  UserPlus,
  Edit,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ActivityStats } from './ActivityStats';
import { cn } from '@/lib/utils';

interface ActivityFeedItemProps {
  activity: {
    id: string;
    action_type: string;
    entity_type: string;
    entity_id: string;
    user_id: string | null;
    old_values: any;
    new_values: any;
    created_at: string;
    profiles?: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    } | null;
  };
}

export function ActivityFeedItem({ activity }: ActivityFeedItemProps) {
  const navigate = useNavigate();

  const getActionIcon = () => {
    switch (activity.action_type) {
      case 'INSERT':
        return UserPlus;
      case 'UPDATE':
        return Edit;
      case 'DELETE':
        return Trash2;
      default:
        return FileText;
    }
  };

  const getEntityIcon = () => {
    switch (activity.entity_type) {
      case 'tasks':
        return CheckSquare;
      case 'task_comments':
        return MessageSquare;
      case 'projects':
        return FolderKanban;
      case 'clients':
        return Users;
      case 'meeting_notes':
        return FileText;
      default:
        return FileText;
    }
  };

  const getActionText = () => {
    const entityName = activity.new_values?.company || 
                       activity.new_values?.name || 
                       activity.new_values?.title || 
                       activity.old_values?.company || 
                       activity.old_values?.name || 
                       activity.old_values?.title;

    // Détails pour les modifications
    if (activity.action_type === 'UPDATE' && activity.old_values && activity.new_values) {
      // Pour les clients
      if (activity.entity_type === 'clients') {
        const changes = [];
        if (activity.old_values.contact_email !== activity.new_values.contact_email) {
          changes.push('le contact');
        }
        if (activity.old_values.phone !== activity.new_values.phone) {
          changes.push('le téléphone');
        }
        if (activity.old_values.logo_url !== activity.new_values.logo_url && activity.new_values.logo_url) {
          return `a ajouté un logo à ${entityName || 'un client'}`;
        }
        if (activity.old_values.status_id !== activity.new_values.status_id) {
          changes.push('le statut');
        }
        if (changes.length > 0) {
          return `a modifié ${changes.join(', ')} de ${entityName || 'un client'}`;
        }
        return `a modifié le client ${entityName || ''}`;
      }
      
      // Pour les projets
      if (activity.entity_type === 'projects') {
        if (activity.old_values.status !== activity.new_values.status) {
          const statusText = {
            'completed': 'est terminé',
            'in_progress': 'est en cours',
            'on_hold': 'est en pause',
            'cancelled': 'est annulé'
          }[activity.new_values.status] || 'a changé de statut';
          return `Le projet ${entityName || ''} ${statusText}`;
        }
        if (activity.old_values.archived !== activity.new_values.archived && activity.new_values.archived) {
          return `a archivé le projet ${entityName || ''}`;
        }
        return `a modifié le projet ${entityName || ''}`;
      }
      
      // Pour les tâches
      if (activity.entity_type === 'tasks') {
        const taskTitle = activity.new_values.title || 'la tâche';
        const projectName = activity.new_values.project_name;
        const projectText = projectName ? ` du projet ${projectName}` : '';
        
        if (activity.old_values.status !== activity.new_values.status) {
          if (activity.new_values.status === 'done') {
            return `a terminé la tâche ${taskTitle}${projectText}`;
          }
          return `a changé le statut de la tâche ${taskTitle}${projectText}`;
        }
        if (activity.old_values.assigned_to !== activity.new_values.assigned_to && activity.new_values.assigned_to) {
          const assignedToName = activity.new_values.assigned_to_name;
          if (assignedToName) {
            return `a attribué la tâche ${taskTitle} à ${assignedToName}`;
          }
          return `a attribué la tâche ${taskTitle}`;
        }
        return `a modifié la tâche ${taskTitle}${projectText}`;
      }

      // Pour les project_attachments
      if (activity.entity_type === 'project_attachments') {
        const projectName = activity.new_values.project_name || 'un projet';
        const fileName = activity.new_values.file_name;
        return `a ajouté un fichier dans le projet ${projectName}${fileName ? ` : ${fileName}` : ''}`;
      }
    }

    // Textes pour les créations
    if (activity.action_type === 'INSERT') {
      if (activity.entity_type === 'task_comments') {
        const taskTitle = activity.new_values?.task_title || 'une tâche';
        const comment = activity.new_values?.content;
        if (comment) {
          // Remove mention markup before displaying
          const cleanComment = comment.replace(/@\[([^\]]+)\]\([^\)]+\)/g, '@$1');
          const shortComment = cleanComment.length > 60 ? cleanComment.substring(0, 60) + '...' : cleanComment;
          return `a commenté la tâche ${taskTitle} : "${shortComment}"`;
        }
        return `a commenté la tâche ${taskTitle}`;
      }
      
      if (activity.entity_type === 'meeting_notes') {
        const clientName = activity.new_values?.client_name || 'un client';
        return `a créé un compte rendu pour ${clientName}`;
      }

      if (activity.entity_type === 'project_attachments') {
        const projectName = activity.new_values?.project_name || 'un projet';
        const fileName = activity.new_values?.file_name;
        return `a ajouté un fichier dans le projet ${projectName}${fileName ? ` : ${fileName}` : ''}`;
      }

      if (activity.entity_type === 'projects') {
        const projectName = activity.new_values?.name;
        if (projectName) {
          return `a créé le projet ${projectName}`;
        }
        return 'a créé un nouveau projet';
      }

      if (activity.entity_type === 'clients') {
        const clientName = activity.new_values?.company;
        if (clientName) {
          return `a ajouté le client ${clientName}`;
        }
        return 'a ajouté un nouveau client';
      }

      if (activity.entity_type === 'tasks') {
        const taskTitle = activity.new_values?.title;
        const projectName = activity.new_values?.project_name;
        const assignedToName = activity.new_values?.assigned_to_name;
        const projectText = projectName ? ` dans le projet ${projectName}` : '';
        
        if (assignedToName && taskTitle) {
          return `a créé la tâche ${taskTitle}${projectText} et l'a attribuée à ${assignedToName}`;
        }
        if (taskTitle) {
          return `a créé la tâche ${taskTitle}${projectText}`;
        }
        return 'a créé une nouvelle tâche';
      }

      const entityNameGeneric = {
        agencies: `l'agence ${entityName || ''}`,
      }[activity.entity_type] || 'un élément';
      
      return `a créé ${entityNameGeneric}`;
    }

    // Textes pour les suppressions
    if (activity.action_type === 'DELETE') {
      const entityNameGeneric = {
        tasks: `la tâche ${entityName || ''}`,
        task_comments: 'un commentaire',
        projects: `le projet ${entityName || ''}`,
        clients: `le client ${entityName || ''}`,
        meeting_notes: 'un compte rendu',
        agencies: `l'agence ${entityName || ''}`,
      }[activity.entity_type] || 'un élément';
      
      return `a supprimé ${entityNameGeneric}`;
    }

    return 'a effectué une action';
  };

  const getEntityLink = () => {
    switch (activity.entity_type) {
      case 'tasks':
        if (activity.new_values?.project_id) {
          return `/project/${activity.new_values.project_id}?tab=tasks`;
        }
        return null;
      case 'projects':
        return `/project/${activity.entity_id}`;
      case 'clients':
        return `/client/${activity.entity_id}`;
      case 'meeting_notes':
        if (activity.new_values?.client_id) {
          return `/client/${activity.new_values.client_id}?tab=meeting-notes`;
        }
        return null;
      default:
        return null;
    }
  };

  const getDetailText = () => {
    if (activity.entity_type === 'tasks' && activity.new_values?.title) {
      return activity.new_values.title;
    }
    if (activity.entity_type === 'projects' && activity.new_values?.name) {
      return activity.new_values.name;
    }
    if (activity.entity_type === 'clients' && activity.new_values?.company) {
      return activity.new_values.company;
    }
    if (activity.entity_type === 'task_comments' && activity.new_values?.content) {
      return activity.new_values.content.substring(0, 100) + (activity.new_values.content.length > 100 ? '...' : '');
    }
    if (activity.entity_type === 'meeting_notes' && activity.new_values?.title) {
      return activity.new_values.title;
    }
    return null;
  };

  const handleClick = () => {
    const link = getEntityLink();
    if (link) {
      navigate(link);
    }
  };

  const ActionIcon = getActionIcon();
  const EntityIcon = getEntityIcon();
  const userName = activity.profiles 
    ? `${activity.profiles.first_name} ${activity.profiles.last_name}`
    : 'Utilisateur inconnu';
  const userInitials = activity.profiles
    ? `${activity.profiles.first_name[0]}${activity.profiles.last_name[0]}`
    : '?';
  const clickable = !!getEntityLink();

  return (
    <div 
      className={cn(
        "border rounded-lg bg-card/50 p-3 md:p-4 transition-colors",
        clickable && "cursor-pointer hover:bg-accent/50"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2 md:gap-3">
        <Avatar className="h-8 w-8 md:h-10 md:w-10">
          <AvatarImage src={activity.profiles?.avatar_url || undefined} />
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <span className="font-medium text-sm md:text-base">{userName}</span>
          </div>
          
          <div className="text-muted-foreground text-xs md:text-sm mb-1">
            {getActionText()}
          </div>

          {getDetailText() && (
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-2">
              {getDetailText()}
            </p>
          )}

          {/* Display entity image if available */}
          {activity.new_values?.logo_url && (
            <div className="mt-2 mb-2">
              <img 
                src={activity.new_values.logo_url} 
                alt="Entity image"
                className="rounded-lg max-h-48 object-cover"
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <EntityIcon className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <Clock className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <span>
              {formatDistanceToNow(new Date(activity.created_at), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          <ActionIcon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
        </div>
      </div>

      <ActivityStats activityId={activity.id} />
    </div>
  );
}
