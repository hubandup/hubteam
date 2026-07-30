import { createClient } from "npm:@supabase/supabase-js@2";
import {
  FP_QUOTE_API_CUSTOM_MAX,
  FpError,
  findQuoteByRef,
  getQuote,
  patchQuote,
  readCredentials,
  uploadQuoteAttachment,
  type FpQuote,
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

const FLAG_KEY = "po_facturation_pro_sync_enabled";
const MAX_ATTEMPTS = 3;
const PO_BUCKET = "purchase-orders";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const formatDateFR = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

const formatAmount = (value: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/** Ligne ajoutee a internal_note (texte libre, non imprime sur le devis). */
function buildNoteLine(po: {
  po_number: string;
  amount_ht: number | string | null;
  sent_at: string | null;
  validation_date: string | null;
  created_at: string | null;
}, supplierName: string) {
  const amount = formatAmount(Number(po.amount_ht ?? 0));
  const date = formatDateFR(po.sent_at ?? po.validation_date ?? po.created_at);
  return `${po.po_number} | ${supplierName} | ${amount} € HT | émis le ${date}`;
}

/** Liste des n° de PO du dossier, separes par « ; », tronquee aux plus recents. */
function buildApiCustom(existing: string | null | undefined, poNumbers: string[]) {
  const fromExisting = String(existing ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
  // Les plus recents en tete de liste de reference, ordre chronologique en sortie.
  const merged: string[] = [];
  for (const n of [...fromExisting, ...poNumbers]) if (!merged.includes(n)) merged.push(n);

  let kept = merged;
  let truncated = 0;
  while (kept.length > 1 && kept.join(";").length > FP_QUOTE_API_CUSTOM_MAX) {
    kept = kept.slice(1); // on retire le plus ancien
    truncated++;
  }
  let value = kept.join(";");
  if (value.length > FP_QUOTE_API_CUSTOM_MAX) value = value.slice(0, FP_QUOTE_API_CUSTOM_MAX);
  return { value, truncated };
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
      .select(
        "id, po_number, hubup_dossier_ref, facturation_pro_quote_id, status, amount_ht, sent_at, validation_date, created_at, pdf_path, sent_pdf_path, suppliers(company_name)",
      )
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

    // Résolution du devis : id mémorisé, sinon recherche exacte par référence dossier.
    let quote: FpQuote | null = null;
    if (po.facturation_pro_quote_id) {
      quote = await getQuote(creds, po.facturation_pro_quote_id);
    } else if (po.hubup_dossier_ref) {
      quote = await findQuoteByRef(creds, String(po.hubup_dossier_ref));
    }
    if (!quote?.id) {
      // Aucun devis rattaché : rien à reporter, ce n'est pas une erreur.
      await admin
        .from("purchase_orders")
        .update({ sync_status: "not_applicable", sync_error: null })
        .eq("id", poId);
      return json({ success: true, skipped: true, reason: "Aucun devis facturation.pro rattaché" });
    }
    const quoteId = String(quote.id);

    const supplierName =
      (po as { suppliers?: { company_name?: string | null } | null }).suppliers?.company_name ??
      "Fournisseur";
    const noteLine = buildNoteLine(po as never, supplierName);

    // Tentatives avec backoff exponentiel (3 au maximum)
    let lastError = "";
    let truncatedCount = 0;
    let attachmentError: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // Toujours relire le devis pour ne jamais écraser le contenu antérieur
        const fresh = attempt === 1 ? quote : await getQuote(creds, quoteId);

        const existingNote = typeof fresh.internal_note === "string" ? fresh.internal_note : "";
        const payload: { internal_note?: string; api_custom?: string } = {};

        if (!existingNote.includes(po.po_number)) {
          payload.internal_note = existingNote ? `${existingNote}\n${noteLine}` : noteLine;
        }

        const { value, truncated } = buildApiCustom(fresh.api_custom, [po.po_number]);
        truncatedCount = truncated;
        if (value !== (fresh.api_custom ?? "")) payload.api_custom = value;
        if (truncated > 0) {
          console.warn(
            `api_custom tronqué pour le devis ${quoteId} : ${truncated} référence(s) ancienne(s) retirée(s)`,
          );
        }

        if (Object.keys(payload).length > 0) {
          await patchQuote(creds, quoteId, payload);
        }

        // Pièce jointe : PDF du PO, nommé {po_number}.pdf, non visible par le client
        const pdfPath = po.sent_pdf_path || po.pdf_path;
        if (pdfPath) {
          try {
            const { data: file, error: dlError } = await admin.storage
              .from(PO_BUCKET)
              .download(pdfPath);
            if (dlError || !file) throw dlError ?? new Error("PDF introuvable dans le stockage");
            const bytes = new Uint8Array(await file.arrayBuffer());
            await uploadQuoteAttachment(creds, quoteId, bytes, `${po.po_number}.pdf`);
          } catch (err) {
            // La pièce jointe ne doit pas invalider l'écriture des champs texte
            attachmentError = err instanceof Error ? err.message : String(err);
            console.error("Pièce jointe non transmise", attachmentError);
          }
        }

        await admin
          .from("purchase_orders")
          .update({
            sync_status: "synced",
            sync_error: attachmentError ? `Pièce jointe non transmise : ${attachmentError}`.slice(0, 500) : null,
            synced_at: new Date().toISOString(),
            facturation_pro_quote_id: quoteId,
          })
          .eq("id", poId);

        await admin.from("purchase_order_events").insert({
          purchase_order_id: poId,
          event_type: "synced",
          payload: {
            quote_id: quoteId,
            internal_note_line: noteLine,
            api_custom_truncated: truncatedCount,
            attachment_error: attachmentError,
            attempts: attempt,
          },
          user_id: user.id,
        });

        return json({ success: true, quoteId, attachmentError, truncated: truncatedCount });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`Tentative ${attempt}/${MAX_ATTEMPTS} échouée`, lastError);
        if (err instanceof FpError && err.status >= 400 && err.status < 500 && err.status !== 429) {
          break; // erreur définitive, inutile de réessayer
        }
        if (attempt < MAX_ATTEMPTS) await sleep(Math.min(2 ** attempt * 1000, 8000));
      }
    }

    throw new Error(lastError || "Écriture refusée par facturation.pro");
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
