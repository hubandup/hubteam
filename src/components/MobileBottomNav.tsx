import { Home, StickyNote, Users, Briefcase, MessageCircle } from 'lucide-react';
import { NavLink } from './NavLink';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useIsNative } from '@/hooks/use-mobile';
import { useNotifications } from '@/hooks/useNotifications';
import { useActivities } from '@/hooks/useActivities';
import { usePosts } from '@/hooks/usePosts';
import { useTasks } from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { useTabVisits } from '@/hooks/useTabVisits';
import { Badge } from '@/components/ui/badge';

export function MobileBottomNav() {
  const isNative = useIsNative();
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const { data: activities } = useActivities();
  const { data: posts } = usePosts();
  const { data: tasks } = useTasks();
  const { data: clients } = useClients();
  const lastVisits = useTabVisits();

  // Count new activities/posts in Feed since last visit
  const feedCount = useMemo(() => {
    const lastVisit = lastVisits.feed;
    
    const newActivities = activities?.filter(
      a => new Date(a.created_at).getTime() > lastVisit
    ).length || 0;
    
    const newPosts = posts?.filter(
      p => new Date(p.created_at).getTime() > lastVisit
    ).length || 0;
    
    return newActivities + newPosts;
  }, [activities, posts, lastVisits.feed]);

  // Count clients with deadlines today or overdue (updated/created since last visit)
  const crmCount = useMemo(() => {
    if (!clients) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastVisit = lastVisits.crm;
    
    return clients.filter(c => {
      if (!c.follow_up_date) return false;
      const deadline = new Date(c.follow_up_date);
      deadline.setHours(0, 0, 0, 0);
      if (deadline > today) return false; // Only today or overdue
      
      // Count only if client was updated/created after last visit
      const updatedAt = new Date(c.updated_at).getTime();
      return updatedAt > lastVisit;
    }).length;
  }, [clients, lastVisits.crm]);

  // Count my incomplete tasks in Projects since last visit
  const projectsCount = useMemo(() => {
    if (!user || !tasks) return 0;
    return tasks.filter(
      t => t.assigned_to === user.id && 
      t.status !== 'Terminée' && 
      new Date(t.created_at).getTime() > lastVisits.projects
    ).length;
  }, [tasks, user, lastVisits.projects]);

  // Count unread message notifications since last visit
  const messagesCount = useMemo(() => {
    if (!notifications) return 0;
    const lastVisit = lastVisits.messages;
    
    return notifications.filter(n => 
      !n.read && 
      n.type === 'message' && 
      new Date(n.created_at).getTime() > lastVisit
    ).length;
  }, [notifications, lastVisits.messages]);

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 border-t md:hidden backdrop-blur-xl shadow-lg">
      <div className="flex justify-around items-center h-20 px-2 safe-area-inset-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          
          let badgeCount = 0;
          if (item.to === '/messages') badgeCount = messagesCount;
          if (item.to === '/feed') badgeCount = feedCount;
          if (item.to === '/crm') badgeCount = crmCount;
          if (item.to === '/projects') badgeCount = projectsCount;
          
          const showBadge = badgeCount > 0;
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1.5 text-muted-foreground transition-all duration-200 active:scale-95 rounded-lg min-w-[60px]"
              activeClassName="text-primary font-semibold"
            >
              <div className="relative p-2">
                <Icon className="h-6 w-6 transition-transform duration-200" />
                {showBadge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-bold animate-fade-in shadow-md"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
