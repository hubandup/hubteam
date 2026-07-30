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
  pdf_generated_at: string | null;
  sent_pdf_path: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  sync_status: "pending" | "synced" | "failed" | "not_applicable";
  sync_error: string | null;
  synced_at: string | null;
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
  "id, po_number, supplier_id, hubup_dossier_ref, facturation_pro_quote_id, supplier_quote_ref, validation_date, description, category_id, amount_ht, vat_rate, amount_vat, amount_ttc, currency, payment_date, status, internal_notes, pdf_path, sent_at, sent_to_email, sent_pdf_path, sync_status, sync_error, synced_at, cancelled_at, cancellation_reason, created_by, created_at, updated_at, suppliers(id, company_name, email), purchase_categories(id, name)";

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

export interface PoSummaryOverdue {
  id: string;
  po_number: string;
  supplier_name: string | null;
  payment_date: string;
  amount_ht: number;
  days_late: number;
}

export interface PoSummary {
  totalHt: number;
  totalTtc: number;
  count: number;
  byStatus: Record<PurchaseOrderStatus, { count: number; ht: number }>;
  byCategory: Array<{ name: string; ht: number; count: number; share: number }>;
  topSuppliers: Array<{ name: string; ht: number; count: number; share: number }>;
  overdue: PoSummaryOverdue[];
  overdueHt: number;
}

/** Synthèse (total engagé, répartition, top fournisseurs, retards) sur la période filtrée. */
export function usePurchaseOrdersSummary(filters: PurchaseOrderFilters) {
  return useQuery({
    queryKey: ["purchase-orders-summary", filters],
    queryFn: async (): Promise<PoSummary> => {
      const supplierIds = await matchingSupplierIds(filters.search);
      let query = supabase
        .from("purchase_orders")
        .select(
          sel(
            "id, po_number, status, amount_ht, amount_ttc, payment_date, suppliers(company_name), purchase_categories(name)",
          ),
        );
      query = applyFilters(query, filters, supplierIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await query.limit(5000).returns<any[]>();
      if (error) throw error;
      const rows = data ?? [];

      const byStatus = {
        draft: { count: 0, ht: 0 },
        sent: { count: 0, ht: 0 },
        invoiced: { count: 0, ht: 0 },
        cancelled: { count: 0, ht: 0 },
      } as Record<PurchaseOrderStatus, { count: number; ht: number }>;
      const catMap = new Map<string, { ht: number; count: number }>();
      const supMap = new Map<string, { ht: number; count: number }>();
      const overdue: PoSummaryOverdue[] = [];
      let totalHt = 0;
      let totalTtc = 0;
      let count = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const r of rows) {
        const ht = Number(r.amount_ht ?? 0);
        const status = r.status as PurchaseOrderStatus;
        byStatus[status].count += 1;
        byStatus[status].ht += ht;
        if (status === "cancelled") continue;

        count += 1;
        totalHt += ht;
        totalTtc += Number(r.amount_ttc ?? 0);

        const cat = r.purchase_categories?.name ?? "Sans catégorie";
        const c = catMap.get(cat) ?? { ht: 0, count: 0 };
        catMap.set(cat, { ht: c.ht + ht, count: c.count + 1 });

        const sup = r.suppliers?.company_name ?? "Fournisseur inconnu";
        const s = supMap.get(sup) ?? { ht: 0, count: 0 };
        supMap.set(sup, { ht: s.ht + ht, count: s.count + 1 });

        if (status === "sent" && r.payment_date) {
          const due = new Date(`${r.payment_date}T00:00:00`);
          if (due < today) {
            overdue.push({
              id: r.id,
              po_number: r.po_number,
              supplier_name: r.suppliers?.company_name ?? null,
              payment_date: r.payment_date,
              amount_ht: ht,
              days_late: Math.round((today.getTime() - due.getTime()) / 86_400_000),
            });
          }
        }
      }

      const share = (v: number) => (totalHt > 0 ? (v / totalHt) * 100 : 0);
      const toList = (m: Map<string, { ht: number; count: number }>) =>
        Array.from(m.entries())
          .map(([name, v]) => ({ name, ht: v.ht, count: v.count, share: share(v.ht) }))
          .sort((a, b) => b.ht - a.ht);

      overdue.sort((a, b) => b.days_late - a.days_late);

      return {
        totalHt,
        totalTtc,
        count,
        byStatus,
        byCategory: toList(catMap),
        topSuppliers: toList(supMap).slice(0, 5),
        overdue,
        overdueHt: overdue.reduce((acc, o) => acc + o.amount_ht, 0),
      };
    },
    placeholderData: (prev) => prev,
  });
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

export interface PurchaseOrderExportRow {
  po_number: string;
  status: PurchaseOrderStatus;
  validation_date: string | null;
  supplier_name: string | null;
  supplier_vat_number: string | null;
  hubup_dossier_ref: string | null;
  supplier_quote_ref: string | null;
  description: string | null;
  category_name: string | null;
  amount_ht: number;
  vat_rate: number;
  amount_vat: number;
  amount_ttc: number;
  payment_date: string | null;
  sent_at: string | null;
  created_by_name: string | null;
  cancellation_reason: string | null;
}

/** Récupère toutes les lignes filtrées/triées (sans pagination) pour l'export XLSX. */
export async function fetchPurchaseOrdersForExport(
  filters: PurchaseOrderFilters,
  sortKey: PoSortKey,
  sortAsc: boolean,
): Promise<PurchaseOrderExportRow[]> {
  const supplierIds = await matchingSupplierIds(filters.search);
  let query = supabase
    .from("purchase_orders")
    .select(
      sel(
        "po_number, status, validation_date, hubup_dossier_ref, supplier_quote_ref, description, amount_ht, vat_rate, amount_vat, amount_ttc, payment_date, sent_at, cancellation_reason, created_by, suppliers(company_name, vat_number), purchase_categories(name)",
      ),
    );
  query = applyFilters(query, filters, supplierIds);
  const { data, error } = await query
    .order(sortKey, { ascending: sortAsc, nullsFirst: false })
    .limit(5000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .returns<any[]>();
  if (error) throw error;
  const rows = data ?? [];

  const creatorIds = Array.from(
    new Set(rows.map((r) => r.created_by).filter((v: string | null): v is string => !!v)),
  );
  const names = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name, email")
      .in("id", creatorIds);
    (profiles ?? []).forEach((p) => {
      const name =
        p.display_name?.trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
        p.email ||
        "";
      names.set(p.id, name);
    });
  }

  return rows.map((r) => ({
    po_number: r.po_number,
    status: r.status,
    validation_date: r.validation_date,
    supplier_name: r.suppliers?.company_name ?? null,
    supplier_vat_number: r.suppliers?.vat_number ?? null,
    hubup_dossier_ref: r.hubup_dossier_ref,
    supplier_quote_ref: r.supplier_quote_ref,
    description: r.description,
    category_name: r.purchase_categories?.name ?? null,
    amount_ht: Number(r.amount_ht ?? 0),
    vat_rate: Number(r.vat_rate ?? 0),
    amount_vat: Number(r.amount_vat ?? 0),
    amount_ttc: Number(r.amount_ttc ?? 0),
    payment_date: r.payment_date,
    sent_at: r.sent_at,
    created_by_name: r.created_by ? (names.get(r.created_by) ?? null) : null,
    cancellation_reason: r.cancellation_reason,
  }));
}

/** Pousse le n° de PO sur le devis facturation.pro (non bloquant, derrière un flag). */
export function useSyncPurchaseOrderToFacturation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (poId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-purchase-order-facturation", {
        body: { poId },
      });
      if (error) throw error;
      return data as { success: boolean; skipped?: boolean; error?: string };
    },
    onSettled: (_d, _e, poId) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-events", poId] });
    },
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
