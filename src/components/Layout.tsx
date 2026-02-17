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
import { LanguageSelector } from './LanguageSelector';
import { SmashDialog } from './SmashDialog';
import { GlobalSearch } from './GlobalSearch';
import { OfflineBanner } from './common/OfflineBanner';
import { SkipToContent } from './common/SkipToContent';
import { ArrowUpFromLine, Search } from 'lucide-react';
import { Button } from './ui/button';
import logo from '@/assets/logo-hubandup.svg';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { isNative } = useCapacitor();
  const [smashOpen, setSmashOpen] = useState(false);

  // Sur mobile/PWA, layout simplifié sans sidebar
  if (isMobile || isNative) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-sidebar">
        <SkipToContent />
        <OfflineBanner />
        {/* Header mobile simplifié - fond continu avec la status bar */}
        <header className="sticky top-0 z-50 bg-sidebar px-4 pt-[env(safe-area-inset-top)] pb-3 flex items-center justify-between">
          <img src={logo} alt="Hub & Up" className="h-8 [filter:brightness(0)_invert(1)]" />
          <div className="flex items-center gap-1 [&_button]:text-white [&_svg]:text-white">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSmashOpen(true)}
              className="h-9 w-9"
              aria-label="Smash"
            >
              <ArrowUpFromLine className="h-5 w-5" />
            </Button>
            <LanguageSelector />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        
        {/* Contenu principal */}
        <main id="main-content" className="flex-1 overflow-auto bg-background rounded-t-2xl transition-opacity duration-150">
          <div className="px-4 py-4 pb-24">
            {children}
          </div>
        </main>
        
        {/* Navigation bas */}
        <MobileBottomNav />
        
        {/* Bannière d'installation PWA */}
        <PWAInstallBanner />

        <SmashDialog open={smashOpen} onOpenChange={setSmashOpen} />
        <GlobalSearch />
      </div>
    );
  }

  // Version desktop avec Sidebar
  return (
    <SidebarProvider>
      <SkipToContent />
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <OfflineBanner />
          <header className="h-14 border-b border-border/40 bg-background/80 backdrop-blur-xl flex items-center justify-between px-5 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => {
                  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
                }}
                aria-label="Rechercher"
              >
                <Search className="h-4 w-4" />
              </Button>
              <LanguageSelector />
              <ThemeToggle />
              <NotificationBell />
              <HeaderUserProfile />
            </div>
          </header>
          <main id="main-content" className="flex-1 min-h-0 min-w-0 overflow-auto bg-background transition-opacity duration-150" style={{ scrollbarGutter: 'stable' }}>
            <div className="px-5 md:px-8 py-4">
              <Breadcrumbs />
            </div>
            <div className="px-5 md:px-8 pb-8">
              {children}
            </div>
          </main>
        </div>
        <GlobalSearch />
      </div>
    </SidebarProvider>
  );
}
