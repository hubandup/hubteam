import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime: 0 → toute donnée est considérée périmée immédiatement,
      // donc React Query refetch dès qu'un composant se monte ou que la fenêtre
      // reprend le focus. Combiné avec les abonnements Supabase Realtime,
      // l'UI se met à jour instantanément sans rafraîchissement manuel.
      staleTime: 0,
      gcTime: 1000 * 60 * 30, // 30 minutes — garde le cache en mémoire pour éviter les écrans vides
      retry: 1,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
