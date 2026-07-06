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
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

import logo from '@/assets/logo-hubandup.svg';
import { usePrefetchAppData } from '@/hooks/usePrefetchAppData';

interface LayoutProps {
  children: ReactNode;
}

const MOBILE_BG = '#F4F4F3';
const MOBILE_NAVY = '#0C1320';

function MobileAvatar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });
  const initials = profile
    ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
    : (user?.email?.[0]?.toUpperCase() || 'U');
  return (
    <button
      type="button"
      onClick={() => navigate('/settings')}
      aria-label="Mon profil"
      className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center min-w-[44px] min-h-[44px]"
    >
      <Avatar className="h-9 w-9">
        <AvatarImage src={profile?.avatar_url || undefined} alt={initials} className="object-cover" />
        <AvatarFallback style={{ backgroundColor: '#DDF247', color: MOBILE_NAVY }} className="text-[12px] font-bold">
          {initials || 'CB'}
        </AvatarFallback>
      </Avatar>
    </button>
  );
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { isNative } = useCapacitor();
  const [smashOpen, setSmashOpen] = useState(false);
  usePrefetchAppData();

  // Mobile shell (<768px) or native app — no sidebar, bottom nav, safe-areas
  if (isMobile || isNative) {
    return (
      <div className="min-h-screen flex flex-col w-full" style={{ backgroundColor: MOBILE_NAVY }}>
        <SkipToContent />
        <OfflineBanner />
        {/* Header mobile compact — logo left, actions right */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-3 pb-2"
          style={{
            backgroundColor: MOBILE_NAVY,
            paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
          }}
        >
          <img src={logo} alt="Hub & Up" className="h-7 [filter:brightness(0)_invert(1)]" />
          <div className="flex items-center gap-1 [&_button]:text-white [&_svg]:text-white">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              className="h-11 w-11 min-w-[44px] min-h-[44px]"
              aria-label="Rechercher"
            >
              <Search className="h-5 w-5" />
            </Button>
            <NotificationBell />
            <MobileAvatar />
          </div>
        </header>

        <AnnouncementBanner />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden rounded-t-[22px] transition-opacity duration-150 w-full min-w-0"
          style={{ backgroundColor: MOBILE_BG }}
        >
          <div className="px-4 py-4 pb-28 w-full min-w-0 max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>

        <MobileBottomNav />
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

