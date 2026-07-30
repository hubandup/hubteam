import { createClient } from "npm:@supabase/supabase-js@2";
import {
  listPurchases,
  readCredentials,
  type FpPurchase,
} from "../_shared/facturation-pro.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface PoRow {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_quote_ref: string | null;
  amount_ttc: number;
  status: string;
  facturation_pro_purchase_id: number | null;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const normRef = (v: unknown): string =>
  String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Rapprochement engagé / facturé.
 * Parcourt les achats facturation.pro (GET /purchases.json paginé) et les
 * rapproche des bons de commande HubTeam selon 3 règles, par priorité :
 *   1. api_custom de l'achat contenant le n° de PO  -> certain
 *   2. fournisseur identique + montant TTC identique -> probable
 *   3. ref de l'achat = supplier_quote_ref du PO     -> probable
 * Un rapprochement renseigne facturation_pro_purchase_id et passe le PO en "invoiced".
 * Les rapprochements "probable" demandent une confirmation manuelle sur la fiche PO.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");

  // Auth : soit le cron (x-cron-secret), soit un utilisateur connecté (déclenchement manuel)
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!isCron) {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const creds = readCredentials();

    // 1. Bons de commande candidats : non annulés et non encore rapprochés
    const { data: poData, error: poError } = await admin
      .from("purchase_orders")
      .select(
        "id, po_number, supplier_id, supplier_quote_ref, amount_ttc, status, facturation_pro_purchase_id",
      )
      .neq("status", "cancelled")
      .is("facturation_pro_purchase_id", null)
      .limit(2000);
    if (poError) return json({ error: poError.message }, 500);
    const pos = (poData ?? []) as PoRow[];
    if (pos.length === 0) return json({ success: true, scanned: 0, matched: 0, matches: [] });

    // Correspondance fournisseur HubTeam <-> facturation.pro
    const { data: suppliers } = await admin
      .from("suppliers")
      .select("id, facturation_pro_id")
      .not("facturation_pro_id", "is", null);
    const fpBySupplier = new Map<string, number>();
    for (const s of suppliers ?? []) {
      if (s.facturation_pro_id != null) fpBySupplier.set(s.id, Number(s.facturation_pro_id));
    }

    // 2. Achats récents (pagination bornée)
    const maxPages = 10;
    const purchases: FpPurchase[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await listPurchases(creds, page);
      purchases.push(...res.data);
      const totalPages = res.pagination?.totalPages ?? 1;
      if (page >= totalPages) break;
    }

    // Achats déjà rattachés à un PO : à ignorer
    const { data: linked } = await admin
      .from("purchase_orders")
      .select("facturation_pro_purchase_id")
      .not("facturation_pro_purchase_id", "is", null);
    const usedPurchaseIds = new Set(
      (linked ?? []).map((r) => Number(r.facturation_pro_purchase_id)),
    );

    const available = new Set(pos.map((p) => p.id));
    const matches: Array<{
      po_id: string;
      po_number: string;
      purchase_id: number;
      method: string;
      confidence: "certain" | "probable";
    }> = [];

    const assign = (
      po: PoRow,
      purchase: FpPurchase,
      method: string,
      confidence: "certain" | "probable",
    ) => {
      available.delete(po.id);
      usedPurchaseIds.add(Number(purchase.id));
      matches.push({
        po_id: po.id,
        po_number: po.po_number,
        purchase_id: Number(purchase.id),
        method,
        confidence,
      });
    };

    for (const purchase of purchases) {
      if (usedPurchaseIds.has(Number(purchase.id))) continue;
      const candidates = pos.filter((p) => available.has(p.id));
      if (candidates.length === 0) break;

      // Règle 1 — api_custom contient le n° de PO (certain)
      const apiCustom = String(purchase.api_custom ?? "");
      let hit = apiCustom
        ? candidates.find((p) => apiCustom.toUpperCase().includes(p.po_number.toUpperCase()))
        : undefined;
      if (hit) {
        assign(hit, purchase, "api_custom", "certain");
        continue;
      }

      // Règle 2 — fournisseur identique + montant TTC identique (probable)
      const fpSupplierId = purchase.supplier_id != null ? Number(purchase.supplier_id) : null;
      const ttc = num(purchase.total_with_vat);
      if (fpSupplierId != null && Number.isFinite(ttc)) {
        hit = candidates.find(
          (p) =>
            fpBySupplier.get(p.supplier_id) === fpSupplierId &&
            Math.abs(Number(p.amount_ttc) - ttc) < 0.01,
        );
        if (hit) {
          assign(hit, purchase, "supplier_amount", "probable");
          continue;
        }
      }

      // Règle 3 — ref de l'achat = n° de facture fournisseur du PO (probable)
      const ref = normRef(purchase.ref ?? purchase.invoice_ref);
      if (ref) {
        hit = candidates.find(
          (p) => p.supplier_quote_ref && normRef(p.supplier_quote_ref) === ref,
        );
        if (hit) {
          assign(hit, purchase, "supplier_ref", "probable");
        }
      }
    }

    // 3. Écriture des rapprochements
    for (const m of matches) {
      await admin
        .from("purchase_orders")
        .update({
          facturation_pro_purchase_id: m.purchase_id,
          purchase_match_method: m.method,
          purchase_match_confidence: m.confidence,
          purchase_matched_at: new Date().toISOString(),
          purchase_match_confirmed: m.confidence === "certain",
          status: "invoiced",
        })
        .eq("id", m.po_id);
    }

    return json({
      success: true,
      scanned: purchases.length,
      candidates: pos.length,
      matched: matches.length,
      matches,
    });
  } catch (error) {
    console.error("reconcile-purchases-facturation error", error);
    return json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" },
      500,
    );
  }
});
