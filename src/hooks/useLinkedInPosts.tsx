import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface LinkedInPost {
  id: string;
  linkedin_id: string;
  title: string | null;
  content: string;
  link: string | null;
  image_url: string | null;
  published_at: string;
  created_at: string;
}

async function fetchLinkedInPosts(): Promise<LinkedInPost[]> {
  const { data, error } = await supabase
    .from('linkedin_posts')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

export function useLinkedInPosts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['linkedin-posts'],
    queryFn: fetchLinkedInPosts,
  });

  useEffect(() => {
    const channel = supabase
      .channel('linkedin-posts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'linkedin_posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['linkedin-posts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
