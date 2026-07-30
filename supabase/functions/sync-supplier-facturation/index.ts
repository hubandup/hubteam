import { createClient } from "npm:@supabase/supabase-js@2";
import {
  FpError,
  createSupplier,
  patchSupplier,
  readCredentials,
  toFpSupplierPayload,
  type HubSupplier,
} from "../_shared/facturation-pro.ts";

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
 * Synchronise UN fournisseur HubTeam vers facturation.pro.
 * Creation -> POST /suppliers.json (id stocke dans facturation_pro_id)
 * Modification -> PATCH /suppliers/{id}.json
 * Un echec ne bloque jamais l'usage du fournisseur : sync_status = 'failed'.
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
    const supplierId = String(body?.supplier_id ?? "").trim();
    if (!supplierId) return json({ error: "supplier_id requis" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: supplier, error } = await admin
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!supplier) return json({ error: "Fournisseur introuvable" }, 404);

    const creds = readCredentials();
    const payload = toFpSupplierPayload(supplier as HubSupplier);

    try {
      let fpId = supplier.facturation_pro_id as number | null;
      if (fpId) {
        await patchSupplier(creds, fpId, payload);
      } else {
        const created = await createSupplier(creds, payload);
        fpId = created?.id ?? null;
        if (!fpId) throw new FpError("Identifiant fournisseur non retourne", 502);
      }

      await admin
        .from("suppliers")
        .update({
          facturation_pro_id: fpId,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq("id", supplierId);

      return json({ success: true, facturation_pro_id: fpId });
    } catch (err) {
      const message = err instanceof FpError
        ? `${err.message}${err.body ? ` — ${err.body}` : ""}`
        : err instanceof Error
        ? err.message
        : "Erreur inconnue";
      await admin
        .from("suppliers")
        .update({ sync_status: "failed", sync_error: message.slice(0, 500) })
        .eq("id", supplierId);
      // Non bloquant : reponse 200 avec success=false.
      return json({ success: false, error: message });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return json({ error: message }, 500);
  }
});
