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
import { AnnouncementBanner } from './AnnouncementBanner';
import { OfflineBanner } from './common/OfflineBanner';
import { SkipToContent } from './common/SkipToContent';
import { ArrowUpFromLine, Search } from 'lucide-react';
import { Button } from './ui/button';
import { IconButton } from './ui/icon-button';

import logo from '@/assets/logo-hubandup.svg';
import { usePrefetchAppData } from '@/hooks/usePrefetchAppData';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { isNative } = useCapacitor();
  const [smashOpen, setSmashOpen] = useState(false);
  // Précharge en arrière-plan les données des pages clés (CRM, Projets, Tâches)
  usePrefetchAppData();

  // Sur mobile/PWA, layout simplifié sans sidebar
  if (isMobile || isNative) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-sidebar">
        <SkipToContent />
        <OfflineBanner />
        {/* Header mobile simplifié - fond continu avec la status bar */}
        <header className="sticky top-0 z-50 bg-sidebar px-4 pt-[env(safe-area-inset-top)] pb-3 flex items-center justify-between">
          <img src={logo} alt="Hub & Up" className="h-8 [filter:brightness(0)_invert(1)]" />
          <div className="flex items-center gap-1 [&_button]:text-background [&_svg]:text-background">
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
        
        {/* Annonces */}
        <AnnouncementBanner />
        
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
      <div className="min-h-screen flex w-full bg-app-bg">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <OfflineBanner />
          <AnnouncementBanner />
          <header
            className="border-b border-border bg-card flex items-center justify-between sticky top-0 z-10 transition-all"
            style={{ height: 66, paddingLeft: 20, paddingRight: 24 }}
          >
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-10 w-10 rounded-[10px] text-foreground hover:bg-muted transition-colors" />
            </div>
            <div className="flex items-center gap-1.5">
              <IconButton
                aria-label="Rechercher"
                onClick={() => {
                  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
                }}
              >
                <Search className="h-4 w-4" />
              </IconButton>
              <LanguageSelector />
              <ThemeToggle />
              <NotificationBell />
              <div className="pl-1.5 ml-1.5 border-l border-border">
                <HeaderUserProfile />
              </div>
            </div>
          </header>
          <main
            id="main-content"
            className="flex-1 min-h-0 min-w-0 overflow-auto bg-app-bg transition-opacity duration-150"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="mx-auto w-full" style={{ maxWidth: 1240, paddingLeft: 28, paddingRight: 28 }}>
              <div className="py-4">
                <Breadcrumbs />
              </div>
              <div className="pb-10">
                {children}
              </div>
            </div>
          </main>
        </div>
        <GlobalSearch />
      </div>
    </SidebarProvider>
  );
}

