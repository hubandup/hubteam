import { QueryClient, QueryCache } from '@tanstack/react-query';

const isDev = import.meta.env.DEV;

/**
 * Détecteur de fetchs en double (debug only).
 *
 * Compte les appels au queryFn dans une courte fenêtre pour chaque queryKey.
 * Si une même clé est récupérée plusieurs fois en < 2s sans changement de
 * paramètre, c'est probablement un doublon (refetchOnMount qui se déclenche
 * alors qu'un abonnement Realtime vient déjà d'invalider la même donnée).
 */
const fetchTimestamps = new Map<string, number[]>();
const DUP_WINDOW_MS = 2000;

function trackFetch(queryKey: readonly unknown[]) {
  if (!isDev) return;
  const key = JSON.stringify(queryKey);
  const now = Date.now();
  const recent = (fetchTimestamps.get(key) || []).filter((t) => now - t < DUP_WINDOW_MS);
  recent.push(now);
  fetchTimestamps.set(key, recent);

  if (recent.length >= 2) {
    // eslint-disable-next-line no-console
    console.warn(
      `[react-query] Fetch dupliqué détecté pour ${key} — ${recent.length} appels en ${DUP_WINDOW_MS}ms. ` +
        `Vérifie staleTime / refetchOnMount / abonnement Realtime.`,
    );
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onSuccess: (_data, query) => trackFetch(query.queryKey),
  }),
  defaultOptions: {
    queries: {
      // staleTime: 30s — les données restent considérées fraîches pendant 30s.
      // Pendant cette fenêtre :
      //   • la navigation entre pages NE refetch PAS (pas de doublon avec Realtime),
      //   • les abonnements Supabase Realtime continuent d'invalider en temps réel
      //     dès qu'un changement survient en base.
      // Au-delà de 30s, un refetch au montage assure la fraîcheur si un event
      // Realtime a été manqué (perte réseau, onglet en arrière-plan, etc.).
      staleTime: 30_000,
      gcTime: 1000 * 60 * 30, // 30 min en cache mémoire
      retry: 1,
      // 'true' (défaut) : refetch au montage seulement si la query est stale.
      // 'always' provoquait un refetch systématique → doublon avec Realtime.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
