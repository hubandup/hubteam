import { createClient } from "npm:@supabase/supabase-js@2";
import { FpError, createPurchase, readCredentials } from "../_shared/facturation-pro.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Crée l'achat correspondant à un bon de commande dans facturation.pro.
 * ⚠️ Le champ `total` (HT) est en lecture seule côté facturation.pro : on transmet
 * uniquement total_with_vat et vat_amount, jamais le montant HT.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const poId = String(body?.purchase_order_id ?? "").trim();
    if (!poId) return json({ error: "purchase_order_id requis" }, 400);

    const invoiceRef = String(body?.ref ?? "").trim();
    if (!invoiceRef) return json({ error: "Le n° de facture fournisseur est requis" }, 400);
    const invoicedOn = String(body?.invoiced_on ?? "").trim();
    if (!invoicedOn) return json({ error: "La date de facture est requise" }, 400);
    const termOn = String(body?.term_on ?? "").trim() || null;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: po, error } = await admin
      .from("purchase_orders")
      .select(
        "id, po_number, hubup_dossier_ref, description, amount_ttc, amount_vat, status, supplier_id, category_id, facturation_pro_purchase_id",
      )
      .eq("id", poId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!po) return json({ error: "Bon de commande introuvable" }, 404);
    if (po.facturation_pro_purchase_id) {
      return json({ error: "Un achat est déjà rattaché à ce bon de commande" }, 409);
    }

    const { data: supplier } = await admin
      .from("suppliers")
      .select("id, company_name, facturation_pro_id")
      .eq("id", po.supplier_id)
      .maybeSingle();
    if (!supplier?.facturation_pro_id) {
      return json(
        { error: "Le fournisseur n'est pas encore synchronisé avec facturation.pro" },
        409,
      );
    }

    const { data: category } = await admin
      .from("purchase_categories")
      .select("id, name, facturation_pro_category_id")
      .eq("id", po.category_id)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      supplier_id: Number(supplier.facturation_pro_id),
      title: po.description || po.po_number,
      ref: invoiceRef,
      total_with_vat: Number(po.amount_ttc),
      vat_amount: Number(po.amount_vat),
      invoiced_on: invoicedOn,
      api_custom: po.po_number,
      notes: `Commande ${po.po_number} — dossier ${po.hubup_dossier_ref}`,
    };
    if (termOn) payload.term_on = termOn;
    if (category?.facturation_pro_category_id) {
      payload.category_id = Number(category.facturation_pro_category_id);
    }

    const creds = readCredentials();
    const purchase = await createPurchase(creds, payload);

    await admin
      .from("purchase_orders")
      .update({
        facturation_pro_purchase_id: Number(purchase.id),
        purchase_match_method: "manual",
        purchase_match_confidence: "certain",
        purchase_matched_at: new Date().toISOString(),
        purchase_match_confirmed: true,
        status: "invoiced",
      })
      .eq("id", po.id);

    return json({ success: true, purchase_id: Number(purchase.id) });
  } catch (error) {
    console.error("create-purchase-facturation error", error);
    const status = error instanceof FpError ? error.status || 502 : 500;
    return json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" },
      status >= 400 && status < 600 ? status : 502,
    );
  }
});
