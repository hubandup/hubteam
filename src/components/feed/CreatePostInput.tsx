import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreatePostDialog } from './CreatePostDialog';
import { useAuth } from '@/hooks/useAuth';
import { Video, Image, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CreatePostInput() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Get user profile data from auth context
  const userMetadata = user?.user_metadata;
  const firstName = userMetadata?.first_name || 'Utilisateur';
  const avatarUrl = userMetadata?.avatar_url;

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

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <Video className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <Image className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <Calendar className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </Card>

      <CreatePostDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
