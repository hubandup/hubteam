import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RichMentionInput } from '@/components/common/RichMentionInput';

interface ChatWindowProps {
  roomId: string | null;
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

export function ChatWindow({ roomId }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      return;
    }

    fetchMessages();

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

      // Insert mentions if any
      if (mentions.length > 0 && messageData) {
        const mentionInserts = mentions.map(userId => ({
          message_id: messageData.id,
          user_id: userId,
        }));

        const { error: mentionsError } = await supabase
          .from('chat_message_mentions')
          .insert(mentionInserts);

        if (mentionsError) {
          console.error('Error inserting mentions:', mentionsError);
        }
      }

      setNewMessage('');
      setMentions([]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  const renderMessageContent = (content: string, isOwn: boolean) => {
    // Replace mention format with highlighted text
    const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      // Every third item starting from index 1 is a user ID (which we skip in rendering)
      if (index % 3 === 1) {
        // This is a display name - use background with contrast
        return (
          <span 
            key={index} 
            className={`font-semibold px-1 rounded ${
              isOwn 
                ? 'bg-primary-foreground/20 text-primary-foreground' 
                : 'bg-primary/10 text-primary'
            }`}
          >
            @{part}
          </span>
        );
      } else if (index % 3 === 2) {
        // This is a user ID, skip it
        return null;
      }
      // Regular text
      return <span key={index}>{part}</span>;
    });
  };

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Sélectionnez une conversation pour commencer
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => {
            const isOwn = message.user_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.profiles.avatar_url || undefined} />
                  <AvatarFallback>
                    {message.profiles.first_name[0]}
                    {message.profiles.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex flex-col ${isOwn ? 'items-end' : ''}`}>
                  <div
                    className={`rounded-lg px-4 py-2 max-w-md ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{renderMessageContent(message.content, isOwn)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="border-t p-4">
        <div className="flex gap-2 items-end">
          <RichMentionInput
            value={newMessage}
            onChange={setNewMessage}
            onMentionsChange={setMentions}
            placeholder="Écrivez votre message... (utilisez @ pour mentionner)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }}
          />
          <Button type="submit" disabled={sending || !newMessage.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
