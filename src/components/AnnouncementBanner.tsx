import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createSafeHtml } from '@/lib/sanitize';
import { useUserRole, type UserRole } from '@/hooks/useUserRole';
import { X, Megaphone } from 'lucide-react';
import { Button } from './ui/button';

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience_type: 'all' | 'role' | 'users';
  target_roles: string[] | null;
  target_user_ids: string[] | null;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
}

export function AnnouncementBanner() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  const { data: announcements = [] } = useQuery({
    queryKey: ['active-announcements'],
    queryFn: async () => {
      const now = new Date().toISOString();

      // Fetch active announcements
      const { data: anns, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('active', true)
        .lte('starts_at', now)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out expired
      const valid = (anns || []).filter(a => !a.ends_at || a.ends_at > now);

      // Fetch user's dismissals
      const { data: dismissals } = await supabase
        .from('announcement_dismissals')
        .select('announcement_id');

      const dismissedIds = new Set((dismissals || []).map(d => d.announcement_id));

      return valid.filter(a => !dismissedIds.has(a.id)) as Announcement[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const dismissMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase
        .from('announcement_dismissals')
        .insert({ announcement_id: announcementId, user_id: user!.id });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
    },
  });

  // Filter by audience
  const visibleAnnouncements = announcements.filter(ann => {
    if (ann.audience_type === 'all') return true;
    if (ann.audience_type === 'role' && role && ann.target_roles?.includes(role)) return true;
    if (ann.audience_type === 'users' && user && ann.target_user_ids?.includes(user.id)) return true;
    return false;
  });

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-0">
      {visibleAnnouncements.map(ann => (
        <div
          key={ann.id}
          className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3 text-sm"
        >
          <Megaphone className="h-4 w-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{ann.title}</div>
            {ann.content && (
              <div className="opacity-90 [&_a]:underline [&_a]:text-primary-foreground [&_p]:mb-2 [&_p:last-child]:mb-0 [&_div]:mb-2 [&_div:last-child]:mb-0 [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:mb-1 [&_br]:content-[''] [&_br]:block" dangerouslySetInnerHTML={createSafeHtml(ann.content)} />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => dismissMutation.mutate(ann.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
