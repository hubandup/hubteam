import { ReactNode, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { MobileBottomNav } from './MobileBottomNav';
import { PWAInstallBanner } from './PWAInstallBanner';
import { useIsMobile, useIsNative } from '@/hooks/use-mobile';
import { useCapacitor } from '@/hooks/useCapacitor';
import { HeaderUserProfile } from './HeaderUserProfile';
import { NotificationBell } from './notifications/NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { SwissTransferDialog } from './SwissTransferDialog';
import { ArrowUpFromLine } from 'lucide-react';
import { Button } from './ui/button';
import logo from '@/assets/logo-hubandup.svg';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { isNative } = useCapacitor();
  const [swissTransferOpen, setSwissTransferOpen] = useState(false);

  // Sur mobile/PWA, layout simplifié sans sidebar
  if (isMobile || isNative) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-sidebar">
        {/* Header mobile simplifié - fond continu avec la status bar */}
        <header className="sticky top-0 z-50 bg-sidebar px-4 pt-[env(safe-area-inset-top)] pb-3 flex items-center justify-between">
          <img src={logo} alt="Hub & Up" className="h-8 [filter:brightness(0)_invert(1)]" />
          <div className="flex items-center gap-1 [&_button]:text-white [&_svg]:text-white">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSwissTransferOpen(true)}
              className="h-9 w-9"
              aria-label="SwissTransfer"
            >
              <ArrowUpFromLine className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        
        {/* Contenu principal */}
        <main className="flex-1 overflow-auto bg-background rounded-t-2xl">
          <div className="px-4 py-4 pb-24">
            {children}
          </div>
        </main>
        
        {/* Navigation bas */}
        <MobileBottomNav />
        
        {/* Bannière d'installation PWA */}
        <PWAInstallBanner />

        {/* SwissTransfer Dialog */}
        <SwissTransferDialog open={swissTransferOpen} onOpenChange={setSwissTransferOpen} />
      </div>
    );
  }

  // Version desktop avec Sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <NotificationBell />
              <HeaderUserProfile />
            </div>
          </header>
          <main className="flex-1 min-h-0 min-w-0 overflow-hidden bg-background">
            <div className="px-4 md:px-6 py-4">
              <Breadcrumbs />
            </div>
            <div className="px-4 md:px-6 pb-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
