import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

export type ProspectChannel = 'Email' | 'Téléphone' | 'LinkedIn' | 'Bouche-à-oreille';
export type ProspectStatus = 'À contacter' | 'Contacté' | 'Relance 1' | 'Relance 2' | 'RDV planifié' | 'Besoin qualifié' | 'Proposition envoyée' | 'Négociation' | 'Gagné' | 'Perdu' | 'En veille';
export type ProspectPriority = 'A' | 'B' | 'C';
export type InteractionActionType = 'Email' | 'Appel' | 'Message LinkedIn' | 'RDV' | 'Autre';

export interface Prospect {
  id: string;
  contact_id: string | null;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  channel: ProspectChannel;
  referrer: string | null;
  status: ProspectStatus;
  priority: ProspectPriority;
  last_contact_at: string | null;
  last_action: string | null;
  next_action: string | null;
  next_action_at: string | null;
  need_summary: string | null;
  offer_tags: string[];
  estimated_amount: number;
  probability: number;
  notes: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  prospect_id: string;
  happened_at: string;
  channel: ProspectChannel;
  action_type: InteractionActionType;
  subject: string | null;
  content: string | null;
  outcome: string | null;
  next_step: string | null;
  next_action_at: string | null;
  created_by: string | null;
  created_at: string;
}

export const PROSPECT_STATUSES: { value: ProspectStatus; label: string; color: string }[] = [
  { value: 'À contacter', label: 'À contacter', color: 'bg-slate-100 dark:bg-slate-800' },
  { value: 'Contacté', label: 'Contacté', color: 'bg-blue-100 dark:bg-blue-900' },
  { value: 'Relance 1', label: 'Relance 1', color: 'bg-yellow-100 dark:bg-yellow-900' },
  { value: 'Relance 2', label: 'Relance 2', color: 'bg-orange-100 dark:bg-orange-900' },
  { value: 'RDV planifié', label: 'RDV planifié', color: 'bg-purple-100 dark:bg-purple-900' },
  { value: 'Besoin qualifié', label: 'Besoin qualifié', color: 'bg-cyan-100 dark:bg-cyan-900' },
  { value: 'Proposition envoyée', label: 'Proposition envoyée', color: 'bg-indigo-100 dark:bg-indigo-900' },
  { value: 'Négociation', label: 'Négociation', color: 'bg-pink-100 dark:bg-pink-900' },
  { value: 'Gagné', label: 'Gagné', color: 'bg-green-100 dark:bg-green-900' },
  { value: 'Perdu', label: 'Perdu', color: 'bg-red-100 dark:bg-red-900' },
  { value: 'En veille', label: 'En veille', color: 'bg-gray-100 dark:bg-gray-800' },
];

export const PROSPECT_CHANNELS: ProspectChannel[] = ['Email', 'Téléphone', 'LinkedIn', 'Bouche-à-oreille'];
export const PROSPECT_PRIORITIES: ProspectPriority[] = ['A', 'B', 'C'];
export const INTERACTION_ACTION_TYPES: InteractionActionType[] = ['Email', 'Appel', 'Message LinkedIn', 'RDV', 'Autre'];

async function fetchProspects() {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  // Ensure offer_tags is always an array
  return (data || []).map(p => ({
    ...p,
    offer_tags: p.offer_tags || [],
  })) as Prospect[];
}

async function fetchInteractions(prospectId?: string) {
  let query = supabase
    .from('interactions')
    .select('*')
    .order('happened_at', { ascending: false });

  if (prospectId) {
    query = query.eq('prospect_id', prospectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Interaction[];
}

export function useProspects() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['prospects'],
    queryFn: fetchProspects,
  });

  useEffect(() => {
    const channel = supabase
      .channel('prospects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prospects',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['prospects'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useInteractions(prospectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['interactions', prospectId],
    queryFn: () => fetchInteractions(prospectId),
  });

  useEffect(() => {
    const channel = supabase
      .channel('interactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interactions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['interactions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useCreateProspect() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (prospect: Partial<Prospect>) => {
      const insertData = {
        company_name: prospect.company_name || 'N/A',
        contact_name: prospect.contact_name || 'N/A',
        email: prospect.email || '',
        phone: prospect.phone,
        linkedin_url: prospect.linkedin_url,
        channel: prospect.channel,
        referrer: prospect.referrer,
        status: prospect.status,
        priority: prospect.priority,
        last_contact_at: prospect.last_contact_at,
        last_action: prospect.last_action,
        next_action: prospect.next_action,
        next_action_at: prospect.next_action_at,
        need_summary: prospect.need_summary,
        offer_tags: prospect.offer_tags || [],
        estimated_amount: prospect.estimated_amount,
        probability: prospect.probability,
        notes: prospect.notes,
        contact_id: prospect.contact_id,
        owner_id: prospect.owner_id || user?.id,
      };
      const { data, error } = await supabase
        .from('prospects')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

export function useUpdateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Prospect> & { id: string }) => {
      const { data, error } = await supabase
        .from('prospects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

export function useDeleteProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

export function useCreateInteraction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (interaction: Partial<Interaction>) => {
      const insertData = {
        prospect_id: interaction.prospect_id!,
        action_type: interaction.action_type!,
        channel: interaction.channel,
        subject: interaction.subject,
        content: interaction.content,
        outcome: interaction.outcome,
        next_step: interaction.next_step,
        next_action_at: interaction.next_action_at,
        happened_at: interaction.happened_at,
        created_by: user?.id,
      };
      const { data, error } = await supabase
        .from('interactions')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

// Helper to find or create a prospect from email
export async function findOrCreateProspectByEmail(
  email: string,
  defaults: Partial<Prospect>,
  userId: string
): Promise<Prospect> {
  // First, try to find existing prospect
  const { data: existing } = await supabase
    .from('prospects')
    .select('*')
    .eq('email', email)
    .single();

  if (existing) {
    return {
      ...existing,
      offer_tags: existing.offer_tags || [],
    } as Prospect;
  }

  // Create new prospect
  const { data: created, error } = await supabase
    .from('prospects')
    .insert({
      email,
      company_name: defaults.company_name || 'N/A',
      contact_name: defaults.contact_name || 'N/A',
      owner_id: userId,
      offer_tags: defaults.offer_tags || [],
      ...defaults,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...created,
    offer_tags: created.offer_tags || [],
  } as Prospect;
}
