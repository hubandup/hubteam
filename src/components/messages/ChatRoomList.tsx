import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Hash, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateChatRoomDialog } from './CreateChatRoomDialog';

interface ChatRoom {
  id: string;
  name: string | null;
  type: 'project' | 'direct';
  project_id: string | null;
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

      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRooms((data || []).map(room => ({
        ...room,
        type: room.type as 'project' | 'direct'
      })));
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
        <h2 className="font-semibold">Conversations</h2>
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
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune conversation
            </p>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg hover:bg-muted transition-colors',
                  selectedRoomId === room.id && 'bg-primary/10'
                )}
              >
                <div className="flex items-center gap-2">
                  {room.type === 'project' ? (
                    <Hash className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium truncate">
                    {room.name || 'Sans nom'}
                  </span>
                </div>
              </button>
            ))
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
