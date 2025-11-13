import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateChatRoomDialog } from './CreateChatRoomDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChatRoom {
  id: string;
  name: string | null;
  type: 'direct';
  memberCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  isOnline?: boolean;
  members?: Array<{
    user_id: string;
    profiles: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
      display_name: string | null;
    };
  }>;
}

interface ChatRoomListProps {
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

export function ChatRoomList({ selectedRoomId, onSelectRoom }: ChatRoomListProps) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchRooms();

    const channel = supabase
      .channel('chat-rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms',
        },
        () => {
          fetchRooms();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_room_members',
        },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchRooms = async () => {
    if (!user) return;

    try {
      const { data: membershipData, error: membershipError } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;

      const roomIds = membershipData.map(m => m.room_id);

      if (roomIds.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      // Fetch rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .eq('type', 'direct')
        .order('created_at', { ascending: false });

      if (roomsError) throw roomsError;

      // For each room, fetch members and last message
      const roomsWithMembers = await Promise.all(
        (roomsData || []).map(async (room) => {
          // Get member IDs
          const { data: membersData } = await supabase
            .from('chat_room_members')
            .select('user_id')
            .eq('room_id', room.id)
            .neq('user_id', user.id);

          const memberIds = (membersData || []).map(m => m.user_id);

          // Fetch profiles for these members
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, avatar_url, display_name')
            .in('id', memberIds);

          const members = (profilesData || []).map(profile => ({
            user_id: profile.id,
            profiles: profile
          }));

          // Fetch last message
          const { data: lastMessageData } = await supabase
            .from('chat_messages')
            .select('content, created_at')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...room,
            type: 'direct' as const,
            memberCount: members.length + 1,
            members,
            lastMessage: lastMessageData?.content,
            lastMessageTime: lastMessageData?.created_at,
            isOnline: Math.random() > 0.5 // TODO: implement real online status
          };
        })
      );

      setRooms(roomsWithMembers);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-80 border-r flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const otherMember = (room: ChatRoom) => {
    if (room.type === 'direct' && room.members && room.members.length > 0) {
      const member = room.members[0];
      return member.profiles.display_name || 
             `${member.profiles.first_name} ${member.profiles.last_name}`;
    }
    return room.name || 'Conversation';
  };

  const otherMemberInitials = (room: ChatRoom) => {
    if (room.type === 'direct' && room.members && room.members.length > 0) {
      const member = room.members[0];
      return `${member.profiles.first_name[0]}${member.profiles.last_name[0]}`;
    }
    return 'C';
  };

  const otherMemberAvatar = (room: ChatRoom) => {
    if (room.type === 'direct' && room.members && room.members.length > 0) {
      return room.members[0].profiles.avatar_url;
    }
    return null;
  };

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3) + '.';
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace(' ', ' ');
    }
  };

  const truncateMessage = (text: string | undefined, maxLength: number = 50) => {
    if (!text) return 'Aucun message';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="w-80 border-r flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Messages</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Chat rooms list */}
      <ScrollArea className="flex-1">
        {rooms.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Aucune conversation
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle conversation
            </Button>
          </div>
        ) : (
          <div>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={cn(
                  "w-full px-4 py-3 flex items-start gap-3 hover:bg-accent/30 transition-colors text-left border-b border-border/50",
                  selectedRoomId === room.id && "bg-accent/50"
                )}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={otherMemberAvatar(room) || undefined} />
                    <AvatarFallback className="text-base">
                      {otherMemberInitials(room)}
                    </AvatarFallback>
                  </Avatar>
                  {room.isOnline && (
                    <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-base text-foreground truncate">
                      {otherMember(room)}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatTimestamp(room.lastMessageTime)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {truncateMessage(room.lastMessage)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create chat dialog */}
      <CreateChatRoomDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={(roomId) => {
          setCreateDialogOpen(false);
          onSelectRoom(roomId);
        }}
      />
    </div>
  );
}
