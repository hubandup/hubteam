import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, User, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateChatRoomDialog } from './CreateChatRoomDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ChatRoom {
  id: string;
  name: string | null;
  type: 'direct';
  memberCount?: number;
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

      // For each room, fetch members
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

          return {
            ...room,
            type: 'direct' as const,
            memberCount: members.length + 1,
            members
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
      <div className="w-64 border-r flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-64 border-r flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Messages</h2>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {rooms.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-muted-foreground mb-4">
                Aucune conversation
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Démarrer une conversation
              </Button>
            </div>
          ) : (
            rooms.map((room) => {
              const otherMembers = room.members || [];
              const displayName = otherMembers.length > 0
                ? otherMembers.map(m => 
                    m.profiles.display_name || `${m.profiles.first_name} ${m.profiles.last_name}`
                  ).join(', ')
                : room.name || 'Sans nom';

              return (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg hover:bg-muted transition-colors',
                    selectedRoomId === room.id && 'bg-primary/10'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {otherMembers.length === 1 ? (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={otherMembers[0].profiles.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {otherMembers[0].profiles.first_name[0]}
                          {otherMembers[0].profiles.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {displayName}
                      </p>
                      {otherMembers.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {otherMembers.length + 1} participants
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      <CreateChatRoomDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchRooms();
        }}
      />
    </div>
  );
}
