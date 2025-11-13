import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare, ArrowLeft, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  roomId: string | null;
  onBack?: () => void;
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export function ChatWindow({ roomId, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      return;
    }

    fetchMessages();
    fetchRoomInfo();

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRoomInfo = async () => {
    if (!roomId || !user) return;

    try {
      // Get other member
      const { data: membersData } = await supabase
        .from('chat_room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .neq('user_id', user.id)
        .limit(1)
        .single();

      if (membersData) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url, display_name')
          .eq('id', membersData.user_id)
          .single();

        if (profileData) {
          setRoomName(profileData.display_name || `${profileData.first_name} ${profileData.last_name}`);
          setOtherUserAvatar(profileData.avatar_url);
        }
      }
    } catch (error) {
      console.error('Error fetching room info:', error);
    }
  };

  const fetchMessages = async () => {
    if (!roomId) return;

    try {
      // First get messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Get unique user IDs
      const userIds = [...new Set(messagesData.map(m => m.user_id))];

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of profiles
      const profilesMap = new Map(profilesData.map(p => [p.id, p]));

      // Combine messages with profiles
      const enrichedMessages = messagesData.map(message => ({
        ...message,
        profiles: profilesMap.get(message.user_id) || {
          first_name: 'Unknown',
          last_name: 'User',
          avatar_url: null,
        },
      }));

      setMessages(enrichedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId || !user) return;

    setSending(true);
    try {
      // Insert message
      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          content: newMessage.trim(),
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Get all room members except current user for notifications
      const { data: members } = await supabase
        .from('chat_room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .neq('user_id', user.id);

      // Get current user profile for sender name
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, display_name')
        .eq('id', user.id)
        .single();

      const senderName = senderProfile?.display_name || 
                        `${senderProfile?.first_name} ${senderProfile?.last_name}` ||
                        'Someone';

      // Send notifications to other members
      if (members && members.length > 0) {
        try {
          await supabase.functions.invoke('send-message-notification', {
            body: {
              recipientIds: members.map(m => m.user_id),
              senderName,
              message: newMessage.trim(),
              roomId,
            },
          });
        } catch (notifError) {
          console.error('Error sending notifications:', notifError);
        }
      }

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  const formatDateSeparator = (date: Date) => {
    if (isToday(date)) {
      return "AUJOURD'HUI";
    } else if (isYesterday(date)) {
      return "HIER";
    } else {
      return format(date, 'EEEE', { locale: fr }).toUpperCase();
    }
  };

  const groupMessagesByDate = () => {
    const grouped: { [key: string]: Message[] } = {};
    
    messages.forEach((message) => {
      const date = new Date(message.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(message);
    });
    
    return grouped;
  };

  if (!roomId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/20">
        <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Sélectionnez une conversation
        </h3>
        <p className="text-sm text-muted-foreground">
          Choisissez une conversation dans la liste ou créez-en une nouvelle
        </p>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate();

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-3">
        {isMobile && onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-16 w-16">
          <AvatarImage src={otherUserAvatar || undefined} />
          <AvatarFallback>
            {roomName.split(' ').map(n => n[0]).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-bold text-foreground">{roomName}</h2>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-6">
          {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => {
            const date = new Date(dateKey);
            
            return (
              <div key={dateKey} className="space-y-4">
                {/* Date separator */}
                <div className="flex items-center justify-center">
                  <div className="text-xs font-medium text-muted-foreground px-3 py-1 rounded-full bg-muted/50">
                    {formatDateSeparator(date)}
                  </div>
                </div>

                {/* Messages for this date */}
                {dateMessages.map((message) => {
                  const isOwnMessage = message.user_id === user?.id;
                  const messageTime = format(new Date(message.created_at), 'HH:mm');
                  
                  return (
                    <div key={message.id} className="space-y-1">
                      {!isOwnMessage && (
                        <div className="flex items-center gap-2 pl-16">
                          <span className="text-sm font-semibold text-foreground">
                            {message.profiles.first_name} {message.profiles.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • {messageTime}
                          </span>
                        </div>
                      )}
                      
                      <div className={cn(
                        "flex gap-3",
                        isOwnMessage && "justify-end"
                      )}>
                        {!isOwnMessage && (
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={message.profiles.avatar_url || undefined} />
                            <AvatarFallback className="text-sm">
                              {message.profiles.first_name[0]}{message.profiles.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={cn(
                          "max-w-[75%] rounded-lg px-4 py-2",
                          isOwnMessage
                            ? "bg-primary/10 text-foreground"
                            : "bg-muted"
                        )}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                        </div>
                      </div>
                      
                      {isOwnMessage && (
                        <div className="flex justify-end pr-3">
                          <span className="text-xs text-muted-foreground">
                            ✓ Lu
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Message input */}
      <div className="border-t p-4 bg-background">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Rédiger un message..."
            className="min-h-[44px] max-h-32 resize-none"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          
          <Button
            type="submit"
            size="icon"
            className="flex-shrink-0 rounded-full h-11 w-11"
            disabled={!newMessage.trim() || sending}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
