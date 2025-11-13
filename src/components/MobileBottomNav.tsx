import { Users, FolderKanban, MessageSquare, Activity } from 'lucide-react';
import { NavLink } from './NavLink';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  // Check if running as PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true;

  const navItems = [
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
  ];

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
