import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { fetchClients } from './useClients';
import { fetchTasks } from './useTasks';
import { fetchProjects } from './useProjects';

/**
 * Précharge en arrière-plan les jeux de données utilisés par les pages
 * critiques (CRM, Projets, Tâches, détails client) pour que la première
 * navigation soit instantanée.
 *
 * - Lancé dès qu'un utilisateur est authentifié.
 * - Utilise `prefetchQuery` pour respecter le cache React Query existant
 *   et éviter les doubles appels si la page est ouverte directement.
 * - `requestIdleCallback` (ou `setTimeout` en fallback) pour ne pas
 *   bloquer le rendu initial.
 */
export function usePrefetchAppData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const schedule = (cb: () => void) => {
      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout: number }) => number)
        | undefined;
      if (ric) ric(cb, { timeout: 1500 });
      else setTimeout(cb, 200);
    };

    schedule(() => {
      // Prefetch des listes principales (idempotent grâce au cache)
      queryClient.prefetchQuery({ queryKey: ['clients'], queryFn: fetchClients });
      queryClient.prefetchQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
      queryClient.prefetchQuery({
        queryKey: ['projects', user.id],
        queryFn: () => fetchProjects(user.id),
      });
    });
  }, [user?.id, queryClient]);
}

/**
 * Précharge un client + ses projets/tâches associés. À appeler au survol
 * d'un lien vers /client/:id pour que la page s'affiche instantanément.
 */
export function prefetchClientDetails(
  queryClient: ReturnType<typeof useQueryClient>,
  clientId: string,
) {
  if (!clientId) return;
  queryClient.prefetchQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      return data;
    },
  });
}
