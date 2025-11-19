import { Home, StickyNote, Users, Briefcase, MessageCircle } from 'lucide-react';
import { NavLink } from './NavLink';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useIsNative } from '@/hooks/use-mobile';
import { useNotifications } from '@/hooks/useNotifications';
import { useActivities } from '@/hooks/useActivities';
import { usePosts } from '@/hooks/usePosts';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

export function MobileBottomNav() {
  const isNative = useIsNative();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { data: activities } = useActivities();
  const { data: posts } = usePosts();
  const { data: tasks } = useTasks();

  // Count new activities/posts in Feed (last 24 hours)
  const feedCount = useMemo(() => {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const recentActivities = activities?.filter(
      a => new Date(a.created_at) > yesterday
    ).length || 0;
    
    const recentPosts = posts?.filter(
      p => new Date(p.created_at) > yesterday
    ).length || 0;
    
    return recentActivities + recentPosts;
  }, [activities, posts]);

  // Count my incomplete tasks in Projects
  const projectsCount = useMemo(() => {
    if (!user || !tasks) return 0;
    return tasks.filter(
      t => t.assigned_to === user.id && t.status !== 'Terminée'
    ).length;
  }, [tasks, user]);

  // Check if running as PWA or native app
  const isMobileApp = useMemo(() => 
    isNative ||
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true,
    [isNative]
  );

  const navItems = useMemo(() => [
    {
      to: '/feed',
      icon: Home,
      label: 'Feed',
    },
    {
      to: '/notes',
      icon: StickyNote,
      label: 'Notes',
    },
    {
      to: '/crm',
      icon: Users,
      label: 'CRM',
    },
    {
      to: '/projects',
      icon: Briefcase,
      label: 'Projets',
    },
    {
      to: '/messages',
      icon: MessageCircle,
      label: 'Messages',
    },
  ], []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden backdrop-blur-lg bg-opacity-100">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          
          let badgeCount = 0;
          if (item.to === '/messages') badgeCount = unreadCount;
          if (item.to === '/feed') badgeCount = feedCount;
          if (item.to === '/projects') badgeCount = projectsCount;
          
          const showBadge = badgeCount > 0;
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted-foreground transition-colors relative"
              activeClassName="text-primary"
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
