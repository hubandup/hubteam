import { Home, Users, FolderKanban, MessageSquare, Activity, HelpCircle } from 'lucide-react';
import { NavLink } from './NavLink';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export function MobileBottomNav() {
  // Check if running as PWA (memoized to avoid recalculation)
  const isPWA = useMemo(() => 
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true,
    []
  );

  const navItems = useMemo(() => [
    {
      to: '/',
      icon: Home,
      label: 'Accueil',
    },
    ...(isPWA ? [{
      to: '/feed',
      icon: Activity,
      label: 'Feed',
    }] : []),
    {
      to: '/crm',
      icon: Users,
      label: 'CRM',
    },
    {
      to: '/projects',
      icon: FolderKanban,
      label: 'Projets',
    },
    {
      to: '/messages',
      icon: MessageSquare,
      label: 'Messages',
    },
    {
      to: '/faq',
      icon: HelpCircle,
      label: 'FAQ',
    },
  ], [isPWA]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted-foreground transition-colors"
              activeClassName="text-primary"
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
