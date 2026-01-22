import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Send, Loader2, Plus, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface ChatRoom {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
  last_message?: {
    content: string;
    created_at: string;
    user_name: string;
  };
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  }[];
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export default function Messages() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);

      // Subscribe to new messages
      const channel = supabase
        .channel(`room-${selectedRoom.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `room_id=eq.${selectedRoom.id}`,
          },
          async (payload) => {
            const newMsg = payload.new as any;
            // Fetch user info for the new message
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, avatar_url')
              .eq('id', newMsg.user_id)
              .single();

            setMessages((prev) => [
              ...prev,
              {
                ...newMsg,
                user: profile,
              },
            ]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedRoom]);

  const fetchRooms = async () => {
    if (!user) return;

    try {
      // Get rooms where user is a member
      const { data: memberRooms, error: memberError } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberRooms || memberRooms.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      const roomIds = memberRooms.map((m) => m.room_id);

      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .order('created_at', { ascending: false });

      if (roomsError) throw roomsError;

      // Fetch last message and members for each room
      const roomsWithDetails = await Promise.all(
        (roomsData || []).map(async (room) => {
          // Get last message
          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('content, created_at, user_id')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          let lastMessageWithUser = undefined;
          if (lastMessage) {
            const { data: msgUser } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', lastMessage.user_id)
              .single();

            lastMessageWithUser = {
              content: lastMessage.content,
              created_at: lastMessage.created_at,
              user_name: msgUser ? `${msgUser.first_name} ${msgUser.last_name}` : 'Utilisateur',
            };
          }

          // Get members
          const { data: members } = await supabase
            .from('chat_room_members')
            .select('user_id')
            .eq('room_id', room.id);

          const memberProfiles = await Promise.all(
            (members || []).map(async (m) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, avatar_url')
                .eq('id', m.user_id)
                .single();
              return profile;
            })
          );

          return {
            ...room,
            last_message: lastMessageWithUser,
            members: memberProfiles.filter(Boolean),
          };
        })
      );

      setRooms(roomsWithDetails);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Erreur lors du chargement des conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user info for each message
      const messagesWithUsers = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', msg.user_id)
            .single();

          return {
            ...msg,
            user: profile,
          };
        })
      );

      setMessages(messagesWithUsers);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom || !user) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        room_id: selectedRoom.id,
        user_id: user.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setSendingMessage(false);
    }
  };

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.name) return room.name;
    if (room.type === 'direct' && room.members) {
      const otherMembers = room.members.filter((m) => m.id !== user?.id);
      return otherMembers.map((m) => `${m.first_name} ${m.last_name}`).join(', ') || 'Conversation';
    }
    return 'Conversation';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Messages</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100%-80px)]">
        {/* Rooms List */}
        <Card className="md:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-350px)]">
              {rooms.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune conversation</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedRoom?.id === room.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <p className="font-medium truncate">{getRoomDisplayName(room)}</p>
                      {room.last_message && (
                        <p className={`text-sm truncate ${
                          selectedRoom?.id === room.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {room.last_message.user_name}: {room.last_message.content}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages Area */}
        <Card className="md:col-span-2 flex flex-col">
          {selectedRoom ? (
            <>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">{getRoomDisplayName(selectedRoom)}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col">
                <ScrollArea className="flex-1 h-[calc(100vh-450px)] p-4">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isOwn = message.user_id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.user?.avatar_url || undefined} />
                            <AvatarFallback>
                              {message.user?.first_name?.[0]}
                              {message.user?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
                            <p className="text-xs text-muted-foreground mb-1">
                              {message.user?.first_name} {message.user?.last_name} •{' '}
                              {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                            </p>
                            <div
                              className={`inline-block p-3 rounded-lg ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez votre message..."
                    disabled={sendingMessage}
                  />
                  <Button type="submit" disabled={sendingMessage || !newMessage.trim()}>
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Sélectionnez une conversation</p>
                <p className="text-sm">ou créez-en une nouvelle</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
