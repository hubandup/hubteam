import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const API_URL = "https://www.facturation.pro";
const FLAG_KEY = "po_facturation_pro_sync_enabled";
const TIMEOUT_MS = 12000;

const normalize = (v: string) => v.replace(/[^a-z0-9]/gi, "").toLowerCase();

async function fpFetch(url: string, init: RequestInit) {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/** Retrouve l'id du devis facturation.pro à partir de sa référence. */
async function findQuoteId(firmId: string, headers: HeadersInit, ref: string) {
  const target = normalize(ref);
  for (let page = 1; page <= 10; page++) {
    const url = new URL(`${API_URL}/firms/${firmId}/quotes.json`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");
    const res = await fpFetch(url.toString(), { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const quotes: Array<Record<string, unknown>> = Array.isArray(data)
      ? data
      : (data?.quotes ?? data?.data ?? []);
    if (quotes.length === 0) return null;
    const match =
      quotes.find((q) => typeof q.quote_ref === "string" && normalize(q.quote_ref) === target) ??
      quotes.find(
        (q) => typeof q.quote_ref === "string" && normalize(q.quote_ref).includes(target),
      );
    if (match) return String(match.id);
    if (quotes.length < 100) return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let poId = "";
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    poId = typeof body?.poId === "string" ? body.poId : "";
    if (!/^[0-9a-f-]{36}$/i.test(poId)) return json({ error: "Identifiant de PO invalide" }, 400);

    // Flag d'activation : l'écriture est désactivée par défaut
    const { data: flag } = await admin
      .from("app_config")
      .select("value")
      .eq("key", FLAG_KEY)
      .maybeSingle();
    const enabled = ["true", "1", "on", "yes"].includes(String(flag?.value ?? "").toLowerCase());

    const { data: po, error: poError } = await admin
      .from("purchase_orders")
      .select("id, po_number, hubup_dossier_ref, facturation_pro_quote_id, status")
      .eq("id", poId)
      .maybeSingle();
    if (poError) throw poError;
    if (!po) return json({ error: "Bon de commande introuvable" }, 404);

    if (!enabled) {
      await admin
        .from("purchase_orders")
        .update({ sync_status: "not_applicable", sync_error: null })
        .eq("id", poId);
      return json({ success: true, skipped: true, reason: "Synchronisation désactivée" });
    }

    const apiKey = Deno.env.get("FACTURATION_PRO_API_KEY");
    const apiId = Deno.env.get("FACTURATION_PRO_API_ID");
    const firmId = Deno.env.get("FACTURATION_PRO_FIRM_ID");
    if (!apiKey || !apiId || !firmId) throw new Error("Identifiants facturation.pro manquants");

    const headers = {
      Authorization: `Basic ${btoa(`${apiId}:${apiKey}`)}`,
      "Content-Type": "application/json",
      "User-Agent": "HubTeam (compta@hubandup.com)",
    };

    const quoteId =
      po.facturation_pro_quote_id || (await findQuoteId(firmId, headers, po.hubup_dossier_ref));
    if (!quoteId) throw new Error(`Devis introuvable dans facturation.pro (${po.hubup_dossier_ref})`);

    // Récupère le devis pour ne pas écraser le contenu existant
    const getRes = await fpFetch(`${API_URL}/firms/${firmId}/quotes/${quoteId}.json`, { headers });
    if (!getRes.ok) throw new Error(`Lecture du devis impossible (${getRes.status})`);
    const quote = await getRes.json();

    const mention = `Bon de commande Hub & Up : ${po.po_number}`;
    const attempts: Array<Record<string, string>> = [];
    const existingNotes = typeof quote?.notes === "string" ? quote.notes : "";
    if (!existingNotes.includes(po.po_number)) {
      attempts.push({ notes: existingNotes ? `${existingNotes}\n${mention}` : mention });
    } else {
      attempts.push({ notes: existingNotes });
    }
    const existingTerm = typeof quote?.term === "string" ? quote.term : "";
    attempts.push({ term: existingTerm.includes(po.po_number) ? existingTerm : `${existingTerm}\n${mention}`.trim() });
    attempts.push({ external_ref: po.po_number });

    let lastError = "";
    let written = false;
    for (const payload of attempts) {
      const res = await fpFetch(`${API_URL}/firms/${firmId}/quotes/${quoteId}.json`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        written = true;
        break;
      }
      lastError = `${res.status} ${(await res.text()).slice(0, 200)}`;
    }
    if (!written) throw new Error(`Écriture refusée par facturation.pro : ${lastError}`);

    await admin
      .from("purchase_orders")
      .update({
        sync_status: "synced",
        sync_error: null,
        synced_at: new Date().toISOString(),
        facturation_pro_quote_id: quoteId,
      })
      .eq("id", poId);

    await admin.from("purchase_order_events").insert({
      purchase_order_id: poId,
      event_type: "synced",
      payload: { quote_id: quoteId, mention },
      user_id: user.id,
    });

    return json({ success: true, quoteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("sync-purchase-order-facturation error", message);
    if (poId) {
      await admin
        .from("purchase_orders")
        .update({ sync_status: "failed", sync_error: message.slice(0, 500) })
        .eq("id", poId);
    }
    // Non bloquant : jamais d'erreur HTTP renvoyée au client
    return json({ success: false, error: message });
  }
});
