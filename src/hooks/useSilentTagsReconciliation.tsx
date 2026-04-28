import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'tags_reconcile_last_run';
const THROTTLE_MS = 60 * 60 * 1000; // 1h

/**
 * Déclenche silencieusement la réconciliation des tags d'agences
 * (mappe les tags legacy → expertises canoniques).
 *
 * - Admin uniquement (l'edge function vérifie le rôle, on évite juste l'appel inutile)
 * - Throttlé 1× par heure via localStorage
 * - Aucune UI, aucun toast
 */
export function useSilentTagsReconciliation() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // Throttle
        const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
        if (Date.now() - last < THROTTLE_MS) return;

        // Vérifier le rôle admin côté client (pour éviter un appel certain d'échouer)
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (!roleData) return;

        // Marquer maintenant pour éviter les retries en cas d'échec
        localStorage.setItem(STORAGE_KEY, String(Date.now()));

        // Appel silencieux en mode apply
        const { error } = await supabase.functions.invoke(
          'reconcile-agency-tags',
          { body: { dryRun: false } },
        );
        if (error) {
          console.warn('[silent-reconcile] failed:', error.message);
        }
      } catch (err) {
        console.warn('[silent-reconcile] unexpected error:', err);
      }
    })();
  }, []);
}
