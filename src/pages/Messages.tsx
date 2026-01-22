import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Loader2,
  Trash2,
  MoreVertical,
  Search,
  ArrowLeft,
  Paperclip,
  Image as ImageIcon,
  File,
  X,
  Download,
  Reply,
  CornerDownRight,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatRoom {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
  last_message?: {
    content: string;
    created_at: string;
    user_name: string;
    attachment_type?: string | null;
  };
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  }[];
  unread_count?: number;
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  reply_to_id?: string | null;
  reply_to?: ChatMessage | null;
  user?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function Messages() {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<ChatRoom | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle new conversation from navigation state
  useEffect(() => {
    const state = location.state as { newConversation?: boolean; contactEmail?: string; contactName?: string } | null;
    if (state?.newConversation && state?.contactEmail && user && !creatingRoom) {
      handleCreateConversation(state.contactEmail, state.contactName || 'Contact');
      window.history.replaceState({}, document.title);
    }
  }, [location.state, user]);

  useEffect(() => {
    fetchRooms();
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);
      markRoomAsRead(selectedRoom.id);

      const channel = supabase
        .channel(`room-${selectedRoom.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `room_id=eq.${selectedRoom.id}`,
          },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new as any;
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
              
              // Mark as read if the message is from another user
              if (newMsg.user_id !== user?.id) {
                markRoomAsRead(selectedRoom.id);
              }
            } else if (payload.eventType === 'DELETE') {
              setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedRoom]);

  const markRoomAsRead = async (roomId: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('chat_message_reads')
        .upsert(
          { room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() },
          { onConflict: 'room_id,user_id' }
        );
      
      // Update local state
      setRooms(prev => prev.map(room => 
        room.id === roomId ? { ...room, unread_count: 0 } : room
      ));
    } catch (error) {
      console.error('Error marking room as read:', error);
    }
  };

  const handleCreateConversation = async (contactEmail: string, contactName: string) => {
    if (!user) return;

    setCreatingRoom(true);
    try {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('email', contactEmail)
        .maybeSingle();

      if (targetProfile) {
        const { data: myRooms } = await supabase
          .from('chat_room_members')
          .select('room_id')
          .eq('user_id', user.id);

        const { data: theirRooms } = await supabase
          .from('chat_room_members')
          .select('room_id')
          .eq('user_id', targetProfile.id);

        const myRoomIds = myRooms?.map((r) => r.room_id) || [];
        const theirRoomIds = theirRooms?.map((r) => r.room_id) || [];
        const commonRoomIds = myRoomIds.filter((id) => theirRoomIds.includes(id));

        if (commonRoomIds.length > 0) {
          for (const roomId of commonRoomIds) {
            const { data: room } = await supabase
              .from('chat_rooms')
              .select('*')
              .eq('id', roomId)
              .eq('type', 'direct')
              .single();

            if (room) {
              const { count } = await supabase
                .from('chat_room_members')
                .select('*', { count: 'exact', head: true })
                .eq('room_id', roomId);

              if (count === 2) {
                await fetchRooms();
                const existingRoom = rooms.find((r) => r.id === roomId) || {
                  ...room,
                  members: [targetProfile],
                };
                setSelectedRoom(existingRoom);
                toast.success(`Conversation avec ${contactName} ouverte`);
                setCreatingRoom(false);
                return;
              }
            }
          }
        }

        const roomId = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        const { error: roomError } = await supabase.from('chat_rooms').insert({
          id: roomId,
          type: 'direct',
          name: null,
        });

        if (roomError) throw roomError;

        const { error: memberError } = await supabase.from('chat_room_members').insert([
          { room_id: roomId, user_id: user.id },
          { room_id: roomId, user_id: targetProfile.id },
        ]);

        if (memberError) throw memberError;

        await fetchRooms();
        setSelectedRoom({
          id: roomId,
          type: 'direct',
          name: null,
          created_at: nowIso,
          members: [targetProfile],
        });
        toast.success(`Nouvelle conversation créée avec ${contactName}`);
      } else {
        const roomId = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        const { error: roomError } = await supabase.from('chat_rooms').insert({
          id: roomId,
          type: 'direct',
          name: contactName,
        });

        if (roomError) throw roomError;

        const { error: memberError } = await supabase
          .from('chat_room_members')
          .insert([{ room_id: roomId, user_id: user.id }]);

        if (memberError) throw memberError;

        await fetchRooms();
        setSelectedRoom({
          id: roomId,
          type: 'direct',
          name: contactName,
          created_at: nowIso,
          members: [],
        });
        toast.success(`Nouvelle conversation créée pour ${contactName}`);
        toast.info(`${contactName} n'a pas encore de compte. Il pourra voir vos messages une fois inscrit.`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Erreur lors de la création de la conversation');
    } finally {
      setCreatingRoom(false);
    }
  };

  const fetchRooms = async () => {
    if (!user) return;

    try {
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

      // Fetch read status for all rooms
      const { data: readStatuses } = await supabase
        .from('chat_message_reads')
        .select('room_id, last_read_at')
        .eq('user_id', user.id)
        .in('room_id', roomIds);

      const readStatusMap = new Map(
        readStatuses?.map(r => [r.room_id, r.last_read_at]) || []
      );

      const roomsWithDetails = await Promise.all(
        (roomsData || []).map(async (room) => {
          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('content, created_at, user_id, attachment_type')
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
              attachment_type: lastMessage.attachment_type,
            };
          }

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

          // Calculate unread count
          const lastReadAt = readStatusMap.get(room.id);
          let unreadCount = 0;
          
          if (lastReadAt) {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id)
              .gt('created_at', lastReadAt)
              .neq('user_id', user.id);
            unreadCount = count || 0;
          } else {
            // If never read, count all messages from others
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id)
              .neq('user_id', user.id);
            unreadCount = count || 0;
          }

          return {
            ...room,
            last_message: lastMessageWithUser,
            members: memberProfiles.filter(Boolean),
            unread_count: unreadCount,
          };
        })
      );

      // Sort by last message date
      roomsWithDetails.sort((a, b) => {
        const dateA = a.last_message?.created_at || a.created_at;
        const dateB = b.last_message?.created_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

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
        .select('*, attachment_url, attachment_type, attachment_name, reply_to_id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithUsers = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', msg.user_id)
            .single();

          // Fetch reply_to message if exists
          let replyTo = null;
          if (msg.reply_to_id) {
            const { data: replyMsg } = await supabase
              .from('chat_messages')
              .select('id, content, user_id, attachment_type')
              .eq('id', msg.reply_to_id)
              .single();
            
            if (replyMsg) {
              const { data: replyProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', replyMsg.user_id)
                .single();
              
              replyTo = {
                ...replyMsg,
                user: replyProfile,
              };
            }
          }

          return {
            ...msg,
            user: profile,
            reply_to: replyTo,
          };
        })
      );

      setMessages(messagesWithUsers);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Type de fichier non supporté. Utilisez des images, PDF ou documents Office.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Le fichier est trop volumineux. Maximum 10 Mo.');
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(fileName);

    return {
      url: publicUrl,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      name: file.name,
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !selectedRoom || !user) return;

    setSendingMessage(true);
    setUploadingFile(!!selectedFile);

    try {
      let attachmentData: { url: string; type: string; name: string } | null = null;

      if (selectedFile) {
        attachmentData = await uploadFile(selectedFile);
      }

      const { error } = await supabase.from('chat_messages').insert({
        room_id: selectedRoom.id,
        user_id: user.id,
        content: newMessage.trim() || (attachmentData ? `📎 ${attachmentData.name}` : ''),
        attachment_url: attachmentData?.url || null,
        attachment_type: attachmentData?.type || null,
        attachment_name: attachmentData?.name || null,
        reply_to_id: replyingTo?.id || null,
      });

      if (error) throw error;

      setNewMessage('');
      handleRemoveFile();
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setSendingMessage(false);
      setUploadingFile(false);
    }
  };

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const getReplyPreviewContent = (message: ChatMessage) => {
    if (message.attachment_type === 'image') return '📷 Photo';
    if (message.attachment_type === 'file') return '📎 Fichier';
    return message.content?.substring(0, 50) + (message.content && message.content.length > 50 ? '...' : '');
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    setDeletingMessage(true);
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('id', messageToDelete);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.id !== messageToDelete));
      toast.success('Message supprimé');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erreur lors de la suppression du message');
    } finally {
      setDeletingMessage(false);
      setMessageToDelete(null);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;

    setDeletingRoom(true);
    try {
      // Delete all messages first (they should cascade, but let's be explicit)
      await supabase.from('chat_messages').delete().eq('room_id', roomToDelete.id);
      
      // Delete read status
      await supabase.from('chat_message_reads').delete().eq('room_id', roomToDelete.id);
      
      // Delete room members
      await supabase.from('chat_room_members').delete().eq('room_id', roomToDelete.id);
      
      // Delete the room
      const { error } = await supabase.from('chat_rooms').delete().eq('id', roomToDelete.id);

      if (error) throw error;

      // Update local state
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      
      // If the deleted room was selected, deselect it
      if (selectedRoom?.id === roomToDelete.id) {
        setSelectedRoom(null);
        setMessages([]);
      }
      
      toast.success('Conversation supprimée');
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Erreur lors de la suppression de la conversation');
    } finally {
      setDeletingRoom(false);
      setRoomToDelete(null);
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

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.type === 'direct' && room.members) {
      const otherMember = room.members.find((m) => m.id !== user?.id);
      if (otherMember) {
        return {
          url: otherMember.avatar_url,
          initials: `${otherMember.first_name?.[0] || ''}${otherMember.last_name?.[0] || ''}`,
        };
      }
    }
    return {
      url: null,
      initials: room.name?.[0]?.toUpperCase() || 'C',
    };
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: fr });
    } else if (isYesterday(date)) {
      return `Hier ${format(date, 'HH:mm', { locale: fr })}`;
    }
    return format(date, 'dd/MM HH:mm', { locale: fr });
  };

  const getLastMessagePreview = (room: ChatRoom) => {
    if (!room.last_message) return null;
    
    if (room.last_message.attachment_type === 'image') {
      return '📷 Photo';
    } else if (room.last_message.attachment_type === 'file') {
      return '📎 Fichier';
    }
    return room.last_message.content;
  };

  const filteredRooms = rooms.filter((room) =>
    getRoomDisplayName(room).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = rooms.reduce((acc, room) => acc + (room.unread_count || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const showConversationList = !isMobile || !selectedRoom;
  const showMessages = !isMobile || selectedRoom;

  return (
    <div className="h-[calc(100vh-100px)] p-4 md:p-6">
      <div className="h-full flex gap-4 max-w-7xl mx-auto">
        {/* Conversations List */}
        {showConversationList && (
          <div
            className={cn(
              'flex flex-col bg-card rounded-2xl border shadow-sm overflow-hidden',
              isMobile ? 'w-full' : 'w-80 min-w-80'
            )}
          >
            {/* Search Header */}
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold">Messages</h2>
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Badge>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            </div>

            {/* Rooms List */}
            <ScrollArea className="flex-1">
              {filteredRooms.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucune conversation</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredRooms.map((room) => {
                    const avatar = getRoomAvatar(room);
                    const isSelected = selectedRoom?.id === room.id;
                    const hasUnread = (room.unread_count || 0) > 0;
                    return (
                      <div
                        key={room.id}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 relative group',
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : hasUnread
                            ? 'hover:bg-accent/50 bg-accent/30'
                            : 'hover:bg-accent/50'
                        )}
                      >
                        <button
                          onClick={() => setSelectedRoom(room)}
                          className="flex items-start gap-3 flex-1 min-w-0"
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-11 w-11 ring-2 ring-background shadow-sm">
                              <AvatarImage src={avatar.url || undefined} />
                              <AvatarFallback
                                className={cn(
                                  'font-medium',
                                  isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
                                )}
                              >
                                {avatar.initials}
                              </AvatarFallback>
                            </Avatar>
                            {hasUnread && !isSelected && (
                              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full px-1">
                                {room.unread_count! > 9 ? '9+' : room.unread_count}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className={cn('font-medium truncate', hasUnread && !isSelected && 'font-semibold')}>
                              {getRoomDisplayName(room)}
                            </p>
                            {room.last_message && (
                              <p
                                className={cn(
                                  'text-xs truncate -mt-2.5',
                                  isSelected 
                                    ? 'text-primary-foreground/70' 
                                    : hasUnread 
                                    ? 'text-foreground font-medium' 
                                    : 'text-muted-foreground'
                                )}
                              >
                                {getLastMessagePreview(room)}
                              </p>
                            )}
                          </div>
                          {room.last_message && (
                            <span
                              className={cn(
                                'text-[10px] whitespace-nowrap shrink-0',
                                isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground'
                              )}
                            >
                              {formatMessageDate(room.last_message.created_at)}
                            </span>
                          )}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                                isSelected ? 'hover:bg-primary-foreground/20 text-primary-foreground' : ''
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRoomToDelete(room);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer la conversation
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Messages Area */}
        {showMessages && (
          <div className="flex-1 flex flex-col bg-card rounded-2xl border shadow-sm overflow-hidden">
            {selectedRoom ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
                  {isMobile && (
                    <Button variant="ghost" size="icon" onClick={() => setSelectedRoom(null)} className="shrink-0">
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                    <AvatarImage src={getRoomAvatar(selectedRoom).url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getRoomAvatar(selectedRoom).initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{getRoomDisplayName(selectedRoom)}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedRoom.members?.length
                        ? `${selectedRoom.members.length + 1} participants`
                        : 'Conversation directe'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Commencez la conversation</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isOwn = message.user_id === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={cn('flex gap-2 group', isOwn ? 'justify-end' : 'justify-start')}
                          >
                            {!isOwn && (
                              <Avatar className="h-8 w-8 mt-1 shrink-0">
                                <AvatarImage src={message.user?.avatar_url || undefined} />
                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                  {message.user?.first_name?.[0]}
                                  {message.user?.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={cn('max-w-[75%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
                              <div className="flex items-center gap-2 mb-1">
                                {!isOwn && (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {message.user?.first_name} {message.user?.last_name}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground/60">
                                  {formatMessageDate(message.created_at)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {isOwn && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <MoreVertical className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleReply(message)}>
                                        <Reply className="h-4 w-4 mr-2" />
                                        Répondre
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setMessageToDelete(message.id)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                                {!isOwn && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleReply(message)}
                                  >
                                    <Reply className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
                                  {/* Reply Preview */}
                                  {message.reply_to && (
                                    <div
                                      className={cn(
                                        'px-3 py-1.5 rounded-t-xl text-xs mb-0 border-l-2',
                                        isOwn
                                          ? 'bg-primary/80 text-primary-foreground/80 border-primary-foreground/40 rounded-br-md'
                                          : 'bg-muted/80 text-muted-foreground border-primary/60 rounded-bl-md'
                                      )}
                                    >
                                      <div className="flex items-center gap-1 font-medium opacity-80">
                                        <CornerDownRight className="h-3 w-3" />
                                        {message.reply_to.user?.first_name} {message.reply_to.user?.last_name}
                                      </div>
                                      <p className="truncate max-w-48 opacity-70">
                                        {getReplyPreviewContent(message.reply_to as ChatMessage)}
                                      </p>
                                    </div>
                                  )}
                                  <div
                                    className={cn(
                                      'px-4 py-2.5 rounded-2xl',
                                      isOwn
                                        ? 'bg-primary text-primary-foreground rounded-br-md'
                                        : 'bg-muted rounded-bl-md',
                                      message.reply_to && 'rounded-t-none'
                                    )}
                                  >
                                    {/* Attachment Display */}
                                    {message.attachment_url && (
                                      <div className="mb-2">
                                        {message.attachment_type === 'image' ? (
                                          <a 
                                            href={message.attachment_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block"
                                          >
                                            <img
                                              src={message.attachment_url}
                                              alt={message.attachment_name || 'Image'}
                                              className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            href={message.attachment_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(
                                              'flex items-center gap-2 p-2 rounded-lg transition-colors',
                                              isOwn 
                                                ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' 
                                                : 'bg-background hover:bg-accent'
                                            )}
                                          >
                                            <File className="h-5 w-5 shrink-0" />
                                            <span className="text-sm truncate flex-1">
                                              {message.attachment_name || 'Fichier'}
                                            </span>
                                            <Download className="h-4 w-4 shrink-0" />
                                          </a>
                                        )}
                                      </div>
                                    )}
                                    {/* Only show text if it's not just the attachment placeholder */}
                                    {message.content && !message.content.startsWith('📎') && (
                                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {isOwn && (
                              <Avatar className="h-8 w-8 mt-1 shrink-0">
                                <AvatarImage src={message.user?.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {message.user?.first_name?.[0]}
                                  {message.user?.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* File Preview */}
                {selectedFile && (
                  <div className="px-4 py-2 border-t bg-muted/30">
                    <div className="flex items-center gap-3 p-2 bg-background rounded-lg max-w-md">
                      {selectedFile.type.startsWith('image/') ? (
                        <div className="h-12 w-12 rounded overflow-hidden shrink-0">
                          <img
                            src={URL.createObjectURL(selectedFile)}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                          <File className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleRemoveFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reply Preview */}
                {replyingTo && (
                  <div className="px-4 py-2 border-t bg-muted/30">
                    <div className="flex items-center gap-3 p-2 bg-background rounded-lg max-w-3xl mx-auto border-l-2 border-primary">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-xs text-primary font-medium">
                          <Reply className="h-3 w-3" />
                          Réponse à {replyingTo.user?.first_name} {replyingTo.user?.last_name}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {getReplyPreviewContent(replyingTo)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={cancelReply}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t bg-muted/30">
                  <div className="flex gap-2 max-w-3xl mx-auto items-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ALLOWED_FILE_TYPES.join(',')}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-full h-10 w-10"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendingMessage}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Input
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={replyingTo ? "Écrivez votre réponse..." : "Écrivez votre message..."}
                      disabled={sendingMessage}
                      className="flex-1 rounded-full bg-background px-4"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={sendingMessage || (!newMessage.trim() && !selectedFile)}
                      className="rounded-full h-10 w-10 shrink-0"
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-10 w-10 opacity-50" />
                  </div>
                  <p className="text-lg font-medium">Sélectionnez une conversation</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Choisissez une discussion dans la liste
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Message Confirmation Dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le message sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMessage}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              disabled={deletingMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Room Confirmation Dialog */}
      <AlertDialog open={!!roomToDelete} onOpenChange={() => setRoomToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les messages de cette conversation seront définitivement supprimés pour tous les participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRoom}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoom}
              disabled={deletingRoom}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRoom ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
