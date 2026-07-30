import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Supplier {
  id: string;
  company_name: string;
  last_name: string | null;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  address_1: string | null;
  address_2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  vat_number: string | null;
  iban: string | null;
  bic: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface VatRate {
  id: string;
  label: string;
  rate: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface CompanySettings {
  id: string;
  legal_name: string;
  address_1: string | null;
  address_2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vat_number: string | null;
  phone: string | null;
  accounting_email: string | null;
  logo_url: string | null;
}

/* ---------------------------------- Suppliers --------------------------------- */

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("company_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
    staleTime: 60_000,
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: ["supplier", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Supplier | null;
    },
  });
}

export interface SupplierPurchaseOrder {
  id: string;
  po_number: string;
  hubup_dossier_ref: string;
  validation_date: string;
  description: string | null;
  amount_ht: number;
  amount_ttc: number;
  currency: string;
  status: string;
}

export function useSupplierPurchaseOrders(supplierId?: string) {
  return useQuery({
    queryKey: ["supplier-purchase-orders", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          "id, po_number, hubup_dossier_ref, validation_date, description, amount_ht, amount_ttc, currency, status",
        )
        .eq("supplier_id", supplierId!)
        .order("validation_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierPurchaseOrder[];
    },
  });
}

export function useSaveSupplier() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Record<string, unknown> }) => {
      const payload = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v === "" ? null : v]),
      );

      if (id) {
        const { data, error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Supplier;
      }

      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...payload, created_by: user?.id ?? null } as never)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}

export function useToggleSupplierActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("suppliers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}

/* -------------------------------- Categories -------------------------------- */

export function usePurchaseCategories() {
  return useQuery({
    queryKey: ["purchase-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PurchaseCategory[];
    },
    staleTime: 5 * 60_000,
  });
}

/* --------------------------------- VAT rates -------------------------------- */

export function useVatRates() {
  return useQuery({
    queryKey: ["vat-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vat_rates")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VatRate[];
    },
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------ Company settings ----------------------------- */

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });
}
