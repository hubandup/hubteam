import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Expertise {
  id: string;
  nom: string;
  categorie: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export const EXPERTISE_CATEGORIES = [
  'Communication',
  'Relations Presse & Influence',
  'Création & Production',
  'Digital & Web',
  'Data & Performance',
  'IA & Innovation',
  'Événementiel',
  'Production & Fabrication',
  'Formations',
  'Ressources déportées',
  'Autre',
] as const;

const QK = ['expertises'];

export function useExpertises() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expertises' as any)
        .select('*')
        .order('categorie', { ascending: true })
        .order('nom', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Expertise[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveExpertises() {
  const q = useExpertises();
  return {
    ...q,
    data: (q.data || []).filter((e) => e.actif),
  };
}

export function useUpdateExpertise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Expertise, 'nom' | 'categorie' | 'actif'>> }) => {
      const { error } = await supabase
        .from('expertises' as any)
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData<Expertise[]>(QK);
      qc.setQueryData<Expertise[]>(QK, (old) =>
        (old || []).map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK, ctx.prev);
      toast.error('Erreur lors de la mise à jour');
    },
    onSuccess: () => toast.success('Expertise mise à jour'),
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useCreateExpertise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nom, categorie }: { nom: string; categorie: string }) => {
      const { error } = await supabase
        .from('expertises' as any)
        .insert({ nom: nom.trim(), categorie });
      if (error) throw error;
    },
    onError: (err: any) => {
      if (err?.code === '23505') toast.error('Cette expertise existe déjà');
      else toast.error("Erreur lors de l'ajout");
    },
    onSuccess: () => {
      toast.success('Expertise ajoutée');
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}
