import { Home, StickyNote, Users, Briefcase, MessageCircle } from 'lucide-react';
import { NavLink } from './NavLink';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useIsNative } from '@/hooks/use-mobile';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';

export function MobileBottomNav() {
  const isNative = useIsNative();
  const { unreadCount } = useNotifications();

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
          const showBadge = item.to === '/messages' && unreadCount > 0;
          
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
                    {unreadCount > 9 ? '9+' : unreadCount}
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
