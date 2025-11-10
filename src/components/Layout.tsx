import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 min-h-0 overflow-hidden bg-background">
            <div className="px-6 pt-4">
              <Breadcrumbs />
            </div>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
