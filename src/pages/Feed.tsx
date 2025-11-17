import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { ActivityFeedItem } from '@/components/feed/ActivityFeedItem';
import { OnlineUsersIndicator } from '@/components/feed/OnlineUsersIndicator';
import { CreatePostDialog } from '@/components/feed/CreatePostDialog';
import { UserPostItem } from '@/components/feed/UserPostItem';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

export default function Feed() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    fetchPosts();

    // Subscribe to realtime updates for activities
    const activityChannel = supabase
      .channel('activity-feed-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_log',
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    // Subscribe to realtime updates for posts
    const postsChannel = supabase
      .channel('user-posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_posts',
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(postsChannel);
    };
  }, []);

  const fetchActivities = async () => {
    try {
      const { data: activityData, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(activityData?.map(a => a.user_id).filter(Boolean) || [])];

      // Fetch profiles for these users
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', userIds);

        profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
      }

      // Merge activities with profiles
      const activitiesWithProfiles = (activityData || []).map(activity => ({
        ...activity,
        profiles: activity.user_id ? profilesMap[activity.user_id] : null,
      }));

      setActivities(activitiesWithProfiles);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('user_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(postsData?.map(p => p.user_id).filter(Boolean) || [])];

      // Fetch profiles for these users
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', userIds);

        profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
      }

      // Merge posts with profiles
      const postsWithProfiles = (postsData || []).map(post => ({
        ...post,
        profiles: post.user_id ? profilesMap[post.user_id] : null,
      }));

      setPosts(postsWithProfiles);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full md:container md:mx-auto p-4 pb-24 md:pb-8 md:max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Fil d'actualité</h1>
        <p className="text-muted-foreground mt-2">
          Partagez et découvrez les actualités de l'équipe
        </p>
      </div>

      <OnlineUsersIndicator />

      <div className="mb-4">
        <CreatePostDialog />
      </div>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">Activité système</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <ScrollArea className="h-[calc(100vh-20rem)] md:h-[calc(100vh-16rem)]">
            <div className="space-y-4">
              {posts.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Aucun post pour le moment. Soyez le premier à partager !</p>
                </Card>
              ) : (
                posts.map((post) => (
                  <UserPostItem key={post.id} post={post} />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="activity">
          <ScrollArea className="h-[calc(100vh-20rem)] md:h-[calc(100vh-16rem)]">
            <div className="space-y-4">
              {activities.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Aucune activité récente</p>
                </Card>
              ) : (
                activities.map((activity) => (
                  <ActivityFeedItem key={activity.id} activity={activity} />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
