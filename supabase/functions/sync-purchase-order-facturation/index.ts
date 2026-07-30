import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  FpError,
  findQuoteByRef,
  getQuote,
  patchQuote,
  readCredentials,
  type FpQuote,
} from "../_shared/facturation-pro.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const FLAG_KEY = "po_facturation_pro_sync_enabled";

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

    const body = (await req.json().catch(() => ({}))) as { poId?: unknown };
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

    const creds = readCredentials();

    let quote: FpQuote | null = null;
    if (po.facturation_pro_quote_id) {
      quote = await getQuote(creds, po.facturation_pro_quote_id);
    } else {
      // Recherche exacte documentée : ?full_quote_ref={numéro}&with_details=1
      quote = await findQuoteByRef(creds, po.hubup_dossier_ref);
    }
    if (!quote?.id) {
      throw new Error(`Devis introuvable dans facturation.pro (${po.hubup_dossier_ref})`);
    }
    const quoteId = String(quote.id);

    const mention = `Bon de commande Hub & Up : ${po.po_number}`;
    // PATCH : seuls les champs transmis sont modifiés, on n'écrase donc rien d'autre.
    const attempts: Array<Partial<Pick<FpQuote, "notes" | "term" | "external_ref">>> = [];
    const existingNotes = typeof quote.notes === "string" ? quote.notes : "";
    if (!existingNotes.includes(po.po_number)) {
      attempts.push({ notes: existingNotes ? `${existingNotes}\n${mention}` : mention });
    } else {
      attempts.push({ notes: existingNotes });
    }
    const existingTerm = typeof quote.term === "string" ? quote.term : "";
    attempts.push({
      term: existingTerm.includes(po.po_number) ? existingTerm : `${existingTerm}\n${mention}`.trim(),
    });
    attempts.push({ external_ref: po.po_number });

    let lastError = "";
    let written = false;
    for (const payload of attempts) {
      try {
        await patchQuote(creds, quoteId, payload);
        written = true;
        break;
      } catch (err) {
        if (err instanceof FpError && err.status === 429) throw err;
        lastError = err instanceof Error ? err.message : String(err);
      }
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
