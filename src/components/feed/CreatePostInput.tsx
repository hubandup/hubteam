import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreatePostDialog } from './CreatePostDialog';
import { useAuth } from '@/hooks/useAuth';


import { supabase } from '@/integrations/supabase/client';

export function CreatePostInput() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; avatar_url: string | null } | null>(null);
  
  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };
  
  const firstName = profile?.first_name || 'Utilisateur';
  const avatarUrl = profile?.avatar_url;

  return (
    <>
      <Card 
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setDialogOpen(true)}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>
              {firstName?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 bg-muted rounded-full px-4 py-2.5 text-muted-foreground hover:bg-muted/80 transition-colors">
            Quoi de neuf, {firstName} ?
          </div>
        </div>
      </Card>

      <CreatePostDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
