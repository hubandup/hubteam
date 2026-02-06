import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProspectCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export function useProspectCategories() {
  return useQuery({
    queryKey: ['prospect-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as ProspectCategory[];
    },
  });
}

export function useCreateProspectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from('prospect_categories')
        .insert({ name, color })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-categories'] });
    },
  });
}

export function useDeleteProspectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('prospect_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-categories'] });
    },
  });
}
