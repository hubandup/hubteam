import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTargets() {
  return useQuery({
    queryKey: ['client-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_targets')
        .select('client_id');
      if (error) throw error;
      return new Set((data || []).map((r) => r.client_id as string));
    },
    staleTime: 30_000,
  });
}

export function useToggleTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, starred }: { clientId: string; starred: boolean }) => {
      if (starred) {
        const { error } = await supabase
          .from('client_targets')
          .delete()
          .eq('client_id', clientId);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('client_targets')
          .insert({ client_id: clientId, starred_by: userData.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['client-targets'] });
      qc.invalidateQueries({ queryKey: ['targets-clients'] });
      toast.success(vars.starred ? 'Retiré des Targets' : 'Ajouté aux Targets');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });
}
