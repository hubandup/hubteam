import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { ActivityFeedItem } from '@/components/feed/ActivityFeedItem';
import { OnlineUsersIndicator } from '@/components/feed/OnlineUsersIndicator';
import { CreatePostInput } from '@/components/feed/CreatePostInput';
import { UserPostItem } from '@/components/feed/UserPostItem';
import { useAuth } from '@/hooks/useAuth';
import { useFeedActivities } from '@/hooks/useFeedActivities';
import { usePosts } from '@/hooks/usePosts';


interface ActivityLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

interface UserPost {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  media_urls?: string[] | null;
  embed_url?: string | null;
  link_title?: string | null;
  link_description?: string | null;
  link_image?: string | null;
  link_site_name?: string | null;
  pdf_url?: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

export default function Feed() {
  const { user } = useAuth();
  const { data: activities = [], isLoading: activitiesLoading } = useFeedActivities();
  const { data: posts = [], isLoading: postsLoading } = usePosts();
  
  const loading = activitiesLoading || postsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full md:container md:mx-auto p-2 md:p-4 pb-20 md:pb-8 md:max-w-2xl">
      <div className="mb-3 md:mb-6">
        <h1 className="text-xl md:text-3xl font-bold">Fil d'actualité</h1>
        <p className="text-muted-foreground mt-0.5 md:mt-2 text-xs md:text-base">
          Partagez et découvrez les actualités de l'équipe
        </p>
      </div>

      <OnlineUsersIndicator />

      <div className="mb-2 md:mb-4">
        <CreatePostInput />
      </div>

      <ScrollArea className="h-[calc(100vh-18rem)] md:h-[calc(100vh-16rem)]">
        <div className="space-y-2 md:space-y-4">
          {posts.length === 0 && activities.length === 0 ? (
            <div className="p-4 md:p-8 text-center border rounded-lg bg-card/50">
              <p className="text-muted-foreground text-xs md:text-base">Aucune activité pour le moment. Soyez le premier à partager !</p>
            </div>
          ) : (
            <>
              {[...posts.map(p => ({ ...p, type: 'post' as const })), ...activities.map(a => ({ ...a, type: 'activity' as const }))]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((item) => (
                  item.type === 'post' ? (
                    <UserPostItem key={`post-${item.id}`} post={item} />
                  ) : (
                    <ActivityFeedItem key={`activity-${item.id}`} activity={item} />
                  )
                ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
