import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import logo from '@/assets/logo-hubandup.svg';

export function AppSkeleton() {
  const isMobile = useIsMobile();

  // Mobile skeleton
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-sidebar">
        {/* Header mobile */}
        <header className="sticky top-0 z-50 bg-sidebar px-4 pt-[env(safe-area-inset-top)] pb-3 flex items-center justify-between">
          <img src={logo} alt="Hub & Up" className="h-8 [filter:brightness(0)_invert(1)]" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full bg-sidebar-accent/30" />
            <Skeleton className="h-8 w-8 rounded-full bg-sidebar-accent/30" />
          </div>
        </header>
        
        {/* Contenu */}
        <main className="flex-1 overflow-auto bg-background rounded-t-2xl">
          <div className="px-4 py-4 pb-24 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="space-y-3 mt-6">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        </main>
        
        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border safe-area-bottom z-50">
          <div className="flex justify-around items-center h-16 px-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-16 rounded-lg bg-sidebar-accent/30" />
            ))}
          </div>
        </nav>
      </div>
    );
  }

  // Desktop skeleton
  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar skeleton */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border p-4 space-y-6">
        <div className="flex items-center gap-2 mb-8">
          <img src={logo} alt="Hub & Up" className="h-7 [filter:brightness(0)_invert(1)]" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg bg-sidebar-accent/30" />
          ))}
        </div>
      </aside>
      
      {/* Main content skeleton */}
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
        
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    </div>
  );
}
