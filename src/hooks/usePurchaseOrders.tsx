import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PurchaseOrderStatus = "draft" | "sent" | "invoiced" | "cancelled";

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  hubup_dossier_ref: string;
  facturation_pro_quote_id: string | null;
  supplier_quote_ref: string | null;
  validation_date: string;
  description: string | null;
  category_id: string;
  amount_ht: number;
  vat_rate: number;
  amount_vat: number;
  amount_ttc: number;
  currency: string;
  payment_date: string | null;
  status: PurchaseOrderStatus;
  internal_notes: string | null;
  pdf_path: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: { id: string; company_name: string; email: string | null } | null;
  purchase_categories?: { id: string; name: string } | null;
}

export interface PurchaseOrderEvent {
  id: string;
  purchase_order_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export interface PurchaseOrderFilters {
  search?: string;
  supplierId?: string;
  categoryId?: string;
  status?: string;
  dossierRef?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type PoSortKey =
  | "po_number"
  | "status"
  | "hubup_dossier_ref"
  | "description"
  | "amount_ht"
  | "vat_rate"
  | "amount_ttc"
  | "validation_date"
  | "payment_date";

const sel = (s: string): string => s;

const LIST_SELECT =
  "id, po_number, supplier_id, hubup_dossier_ref, facturation_pro_quote_id, supplier_quote_ref, validation_date, description, category_id, amount_ht, vat_rate, amount_vat, amount_ttc, currency, payment_date, status, internal_notes, pdf_path, sent_at, sent_to_email, cancelled_at, cancellation_reason, created_by, created_at, updated_at, suppliers(id, company_name, email), purchase_categories(id, name)";

/** Applique les filtres partagés entre la requête paginée et la requête de totaux. */
function applyFilters<T>(query: T, filters: PurchaseOrderFilters, supplierIds: string[] | null): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;
  const search = filters.search?.trim();
  if (search) {
    const like = `%${search.replace(/[%,]/g, " ")}%`;
    const clauses = [
      `po_number.ilike.${like}`,
      `hubup_dossier_ref.ilike.${like}`,
      `supplier_quote_ref.ilike.${like}`,
      `description.ilike.${like}`,
    ];
    if (supplierIds && supplierIds.length > 0) {
      clauses.push(`supplier_id.in.(${supplierIds.join(",")})`);
    }
    q = q.or(clauses.join(","));
  }
  if (filters.supplierId) q = q.eq("supplier_id", filters.supplierId);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.dossierRef?.trim()) q = q.ilike("hubup_dossier_ref", `%${filters.dossierRef.trim()}%`);
  if (filters.dateFrom) q = q.gte("validation_date", filters.dateFrom);
  if (filters.dateTo) q = q.lte("validation_date", filters.dateTo);
  return q as T;
}

/** Ids des fournisseurs dont le nom correspond à la recherche (recherche plein texte). */
async function matchingSupplierIds(search?: string): Promise<string[] | null> {
  const term = search?.trim();
  if (!term) return null;
  const { data } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("company_name", `%${term}%`)
    .limit(200);
  return (data ?? []).map((s) => s.id);
}

export function usePurchaseOrders(params: {
  filters: PurchaseOrderFilters;
  sortKey: PoSortKey;
  sortAsc: boolean;
  page: number;
  pageSize: number;
}) {
  const { filters, sortKey, sortAsc, page, pageSize } = params;

  return useQuery({
    queryKey: ["purchase-orders", filters, sortKey, sortAsc, page, pageSize],
    queryFn: async () => {
      const supplierIds = await matchingSupplierIds(filters.search);

      let listQuery = supabase.from("purchase_orders").select(sel(LIST_SELECT), { count: "exact" });
      listQuery = applyFilters(listQuery, filters, supplierIds);
      const from = page * pageSize;
      const { data, error, count } = await listQuery
        .order(sortKey, { ascending: sortAsc, nullsFirst: false })
        .range(from, from + pageSize - 1)
        .returns<PurchaseOrder[]>();
      if (error) throw error;

      let totalsQuery = supabase.from("purchase_orders").select(sel("amount_ht, amount_ttc, status"));
      totalsQuery = applyFilters(totalsQuery, filters, supplierIds);
      const { data: totalsRows, error: totalsError } = await totalsQuery.returns<
        { amount_ht: number; amount_ttc: number; status: PurchaseOrderStatus }[]
      >();
      if (totalsError) throw totalsError;

      const active = (totalsRows ?? []).filter((r) => r.status !== "cancelled");
      const cancelled = (totalsRows ?? []).filter((r) => r.status === "cancelled");
      const sum = (rows: typeof active, key: "amount_ht" | "amount_ttc") =>
        rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

      return {
        rows: data ?? [],
        count: count ?? 0,
        totals: {
          count: active.length,
          ht: sum(active, "amount_ht"),
          ttc: sum(active, "amount_ttc"),
          cancelledCount: cancelled.length,
          cancelledHt: sum(cancelled, "amount_ht"),
          cancelledTtc: sum(cancelled, "amount_ttc"),
        },
      };
    },
    placeholderData: (prev) => prev,
  });
}

export function usePurchaseOrder(id?: string) {
  return useQuery({
    queryKey: ["purchase-order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(sel(LIST_SELECT))
        .eq("id", id!)
        .maybeSingle()
        .returns<PurchaseOrder | null>();
      if (error) throw error;
      return data;
    },
  });
}

export function usePurchaseOrderEvents(id?: string) {
  return useQuery({
    queryKey: ["purchase-order-events", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_events")
        .select("*")
        .eq("purchase_order_id", id!)
        .order("created_at", { ascending: false })
        .returns<PurchaseOrderEvent[]>();
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Doublon non bloquant : même fournisseur + même n° de devis fournisseur. */
export function useDuplicatePurchaseOrder(supplierId?: string, quoteRef?: string, excludeId?: string) {
  const ref = quoteRef?.trim();
  return useQuery({
    queryKey: ["purchase-order-duplicate", supplierId, ref, excludeId],
    enabled: !!supplierId && !!ref,
    queryFn: async () => {
      let q = supabase
        .from("purchase_orders")
        .select("id, po_number, status")
        .eq("supplier_id", supplierId!)
        .eq("supplier_quote_ref", ref!)
        .limit(1);
      if (excludeId) q = q.neq("id", excludeId);
      const { data, error } = await q.returns<{ id: string; po_number: string; status: string }[]>();
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export interface PurchaseOrderInput {
  supplier_id: string;
  hubup_dossier_ref: string;
  facturation_pro_quote_id?: string | null;
  supplier_quote_ref?: string | null;
  validation_date: string;
  description?: string | null;
  category_id: string;
  amount_ht: number;
  vat_rate: number;
  payment_date?: string | null;
  internal_notes?: string | null;
}

export function useSavePurchaseOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PurchaseOrderInput }) => {
      const payload = {
        ...values,
        amount_ht: Math.round(values.amount_ht * 100) / 100,
        supplier_quote_ref: values.supplier_quote_ref || null,
        description: values.description || null,
        internal_notes: values.internal_notes || null,
        payment_date: values.payment_date || null,
        facturation_pro_quote_id: values.facturation_pro_quote_id || null,
      };

      if (id) {
        const { data, error } = await supabase
          .from("purchase_orders")
          .update(payload)
          .eq("id", id)
          .select(sel(LIST_SELECT))
          .single()
          .returns<PurchaseOrder>();
        if (error) throw error;
        return data;
      }

      const year = new Date(values.validation_date).getFullYear();
      const { data: poNumber, error: numberError } = await supabase.rpc("next_po_number", {
        p_year: year,
      });
      if (numberError) throw numberError;

      const { data, error } = await supabase
        .from("purchase_orders")
        .insert({ ...payload, po_number: poNumber as string, created_by: user?.id ?? null })
        .select(sel(LIST_SELECT))
        .single()
        .returns<PurchaseOrder>();
      if (error) throw error;
      return data;
    },
    onSuccess: (po) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", po.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-events", po.id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders"] });
    },
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
      sentToEmail,
      pdfPath,
    }: {
      id: string;
      status?: PurchaseOrderStatus;
      reason?: string;
      sentToEmail?: string;
      pdfPath?: string;
    }) => {
      const patch: Record<string, unknown> = {};
      if (status) patch.status = status;
      if (pdfPath) patch.pdf_path = pdfPath;
      if (status === "cancelled") {
        patch.cancelled_at = new Date().toISOString();
        patch.cancelled_by = user?.id ?? null;
        patch.cancellation_reason = reason ?? null;
      }
      if (status === "sent") {
        patch.sent_at = new Date().toISOString();
        patch.sent_by = user?.id ?? null;
        if (sentToEmail) patch.sent_to_email = sentToEmail;
      }
      const { error } = await supabase.from("purchase_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-events", vars.id] });
    },
  });
}

/** Enregistre un évènement dans le journal d'audit (génération PDF, envoi…). */
export function useLogPurchaseOrderEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      eventType,
      payload,
    }: {
      purchaseOrderId: string;
      eventType: "pdf_generated" | "sent" | "resent" | "synced" | "updated";
      payload?: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from("purchase_order_events").insert([
        {
          purchase_order_id: purchaseOrderId,
          event_type: eventType,
          payload: (payload ?? {}) as never,
          user_id: user?.id ?? undefined,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order-events", vars.purchaseOrderId] });
    },
  });
}
