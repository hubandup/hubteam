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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && !isNative && <Sidebar />}
        <div className="flex-1 min-w-0 flex flex-col">
          {!isNative && (
            <header className="h-14 border-b bg-card flex items-center px-4 md:flex hidden">
              <SidebarTrigger />
            </header>
          )}
          <main className={`flex-1 min-h-0 min-w-0 overflow-hidden bg-background ${isMobile || isNative ? 'pb-20' : 'pb-0'}`}>
            {!isNative && (
              <div className="px-4 md:px-6 py-4">
                <Breadcrumbs />
              </div>
            )}
            <div className={`${isNative ? 'px-4 py-4' : 'px-4 md:px-6 pb-6'}`}>
              {children}
            </div>
          </main>
        </div>
        {(isMobile || isNative) && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
