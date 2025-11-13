import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { MobileBottomNav } from './MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && <Sidebar />}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4 md:flex hidden">
            <SidebarTrigger />
          </header>
          <main className="flex-1 min-h-0 min-w-0 overflow-hidden bg-background pb-20 md:pb-0">
            <div className="px-4 md:px-6 py-4">
              <Breadcrumbs />
            </div>
            <div className="px-4 md:px-6 pb-6">
              {children}
            </div>
          </main>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
