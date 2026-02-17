import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

export type ProspectionStage = 
  | 'added_linkedin' 
  | 'first_contact' 
  | 'followup_1' 
  | 'followup_2' 
  | 'meeting_planned' 
  | 'no_followup';

export const PROSPECTION_STAGES: { value: ProspectionStage; label: string; color: string }[] = [
  { value: 'added_linkedin', label: 'Ajouté sur LinkedIn', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'first_contact', label: '1er contact', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  { value: 'followup_1', label: 'Relance 1', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'followup_2', label: 'Relance 2', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'meeting_planned', label: 'RDV Planifié', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'no_followup', label: 'Sans suite', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
];

export interface ProspectionContact {
  id: string;
  company: string;
  contact_name: string;
  job_title: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  stage: ProspectionStage;
  notes: string | null;
  owner_id: string | null;
  linked_client_id: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchProspectionContacts() {
  const { data, error } = await supabase
    .from('prospection_contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ProspectionContact[];
}

export function useProspectionContacts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['prospection_contacts'],
    queryFn: fetchProspectionContacts,
  });

  useEffect(() => {
    const channel = supabase
      .channel('prospection-contacts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prospection_contacts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['prospection_contacts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useCreateProspectionContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contact: Partial<ProspectionContact>) => {
      const { data, error } = await supabase
        .from('prospection_contacts')
        .insert({
          company: contact.company || '',
          contact_name: contact.contact_name || '',
          job_title: contact.job_title || '',
          linkedin_url: contact.linkedin_url || '',
          email: contact.email || '',
          phone: contact.phone || '',
          stage: contact.stage || 'added_linkedin',
          notes: contact.notes || '',
          owner_id: contact.owner_id || user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection_contacts'] });
    },
  });
}

export function useUpdateProspectionContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProspectionContact> & { id: string }) => {
      const { data, error } = await supabase
        .from('prospection_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection_contacts'] });
    },
  });
}

export function useDeleteProspectionContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('prospection_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection_contacts'] });
    },
  });
}

export function useBulkCreateProspectionContacts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contacts: Partial<ProspectionContact>[]) => {
      const rows = contacts.map(c => ({
        company: c.company || '',
        contact_name: c.contact_name || '',
        job_title: c.job_title || '',
        linkedin_url: c.linkedin_url || '',
        email: c.email || '',
        phone: c.phone || '',
        stage: c.stage || 'added_linkedin',
        notes: c.notes || '',
        owner_id: c.owner_id || user?.id,
      }));

      const { data, error } = await supabase
        .from('prospection_contacts')
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection_contacts'] });
    },
  });
}
