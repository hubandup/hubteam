import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { MobileBottomNav } from './MobileBottomNav';
import { useIsMobile, useIsNative } from '@/hooks/use-mobile';
import { useCapacitor } from '@/hooks/useCapacitor';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { isNative } = useCapacitor();

  // Sur mobile/PWA, on ne wrap pas avec SidebarProvider pour éviter les conflits
  if (isMobile || isNative) {
    return (
      <div className="min-h-screen flex w-full">
        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 min-h-0 min-w-0 overflow-auto bg-background pb-20">
            <div className="px-3 py-3">
              {children}
            </div>
          </main>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  // Version desktop avec Sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4">
            <SidebarTrigger />
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
