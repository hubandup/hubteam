import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';

interface PresenceState {
  [key: string]: {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    online_at: string;
  }[];
}

interface OnlineUser {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export function OnlineUsersIndicator() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch current user profile
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', user.id)
        .single();
      
      setUserProfile(data);
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user || !userProfile) return;

    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as PresenceState;
        const users: OnlineUser[] = [];
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            // Don't include current user
            if (presence.user_id !== user.id) {
              users.push({
                user_id: presence.user_id,
                first_name: presence.first_name,
                last_name: presence.last_name,
                avatar_url: presence.avatar_url,
              });
            }
          });
        });
        
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            first_name: userProfile.first_name,
            last_name: userProfile.last_name,
            avatar_url: userProfile.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userProfile]);

  if (onlineUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 mb-4 p-4 bg-card rounded-lg border">
      <Users className="h-4 w-4 text-green-500" />
      <span className="text-sm text-muted-foreground">
        {onlineUsers.length} utilisateur{onlineUsers.length > 1 ? 's' : ''} en ligne
      </span>
      <div className="flex -space-x-2 ml-2">
        <TooltipProvider>
          {onlineUsers.slice(0, 5).map((onlineUser) => (
            <Tooltip key={onlineUser.user_id}>
              <TooltipTrigger>
                <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-green-500">
                  <AvatarImage src={onlineUser.avatar_url || undefined} />
                  <AvatarFallback>
                    {onlineUser.first_name[0]}{onlineUser.last_name[0]}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{onlineUser.first_name} {onlineUser.last_name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {onlineUsers.length > 5 && (
            <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
              +{onlineUsers.length - 5}
            </div>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
