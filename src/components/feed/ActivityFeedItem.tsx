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
    const entityName = {
      tasks: 'une tâche',
      task_comments: 'un commentaire',
      projects: 'un projet',
      clients: 'un client',
      meeting_notes: 'un compte rendu',
      agencies: 'une agence',
    }[activity.entity_type] || 'un élément';

    switch (activity.action_type) {
      case 'INSERT':
        return `a créé ${entityName}`;
      case 'UPDATE':
        return `a modifié ${entityName}`;
      case 'DELETE':
        return `a supprimé ${entityName}`;
      default:
        return `a effectué une action sur ${entityName}`;
    }
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
