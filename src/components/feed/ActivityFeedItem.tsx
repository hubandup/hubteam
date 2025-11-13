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
import { ActivityReactions } from './ActivityReactions';

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
        return `a modifié ${entityName || 'un client'}`;
      }
      
      // Pour les projets
      if (activity.entity_type === 'projects') {
        if (activity.old_values.status !== activity.new_values.status) {
          return `a changé le statut du projet ${entityName || ''}`;
        }
        return `a modifié le projet ${entityName || ''}`;
      }
      
      // Pour les tâches
      if (activity.entity_type === 'tasks') {
        if (activity.old_values.status !== activity.new_values.status) {
          return `a changé le statut de la tâche ${entityName || ''}`;
        }
        if (activity.old_values.assigned_to !== activity.new_values.assigned_to) {
          return `a assigné la tâche ${entityName || ''}`;
        }
        return `a modifié la tâche ${entityName || ''}`;
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
          const shortComment = comment.length > 50 ? comment.substring(0, 50) + '...' : comment;
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

      const entityNameGeneric = {
        tasks: `la tâche ${entityName || ''}`,
        projects: `le projet ${entityName || ''}`,
        clients: `le client ${entityName || ''}`,
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

  return (
    <Card className="p-4">
      <div 
        className={`${getEntityLink() ? 'cursor-pointer hover:bg-accent/50 -m-4 p-4 rounded-lg' : ''} transition-colors`}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={activity.profiles?.avatar_url || undefined} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{userName}</span>
              <span className="text-muted-foreground text-sm">{getActionText()}</span>
            </div>

            {getDetailText() && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {getDetailText()}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <EntityIcon className="h-3.5 w-3.5" />
              <Clock className="h-3.5 w-3.5" />
              <span>
                {formatDistanceToNow(new Date(activity.created_at), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </div>
          </div>

          <div className="flex-shrink-0">
            <ActionIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      <ActivityReactions activityId={activity.id} />
    </Card>
  );
}
