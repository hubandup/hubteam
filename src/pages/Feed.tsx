import { ScrollArea } from '@/components/ui/scroll-area';
import { ActivityFeedItem } from '@/components/feed/ActivityFeedItem';
import { OnlineUsersIndicator } from '@/components/feed/OnlineUsersIndicator';
import { CreatePostInput } from '@/components/feed/CreatePostInput';
import { UserPostItem } from '@/components/feed/UserPostItem';
import { useAuth } from '@/hooks/useAuth';
import { useFeedActivities } from '@/hooks/useFeedActivities';
import { usePosts } from '@/hooks/usePosts';
import { PageLoader } from '@/components/PageLoader';


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
    return <PageLoader />;
  }

  return (
    <div className="w-full md:container md:mx-auto md:p-4 md:max-w-2xl">
      <div className="mb-3 md:mb-6">
        <h1 className="text-xl md:text-3xl font-bold mb-0.5">Fil d'actualité</h1>
        <p className="text-muted-foreground text-xs md:text-base">
          Partagez et découvrez les actualités de l'équipe
        </p>
      </div>

      <div className="mb-3 md:mb-4">
        <OnlineUsersIndicator />
      </div>

      <div className="mb-3 md:mb-4">
        <CreatePostInput />
      </div>

      <ScrollArea className="h-[calc(100vh-16rem)] md:h-[calc(100vh-16rem)]">
        <div className="space-y-3 md:space-y-4 pr-2">
          {posts.length === 0 && activities.length === 0 ? (
            <div className="p-6 md:p-8 text-center border rounded-xl bg-card/50">
              <p className="text-muted-foreground text-sm md:text-base">Aucune activité pour le moment. Soyez le premier à partager !</p>
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
