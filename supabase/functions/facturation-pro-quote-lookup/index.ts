import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  FpError,
  findQuoteByRef,
  readCredentials,
  type FpQuote,
} from "../_shared/facturation-pro.ts";

/** Cache court en mémoire (par instance) pour limiter les appels à facturation.pro */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; body: string }>();

const normalize = (v: string) => v.replace(/[^a-z0-9]/gi, "").toLowerCase();

interface LookupPayload {
  found: boolean;
  quote?: {
    id: string;
    ref: string;
    title: string;
    customer: string;
    total: number;
    date: string | null;
  };
}

const buildPayload = (match: FpQuote | null, ref: string): LookupPayload =>
  match
    ? {
        found: true,
        quote: {
          id: String(match.id),
          ref: match.full_quote_ref || match.quote_ref || ref,
          title: match.title ?? "",
          customer: match.customer_identity || match.customer_short_name || "",
          total: Number(match.total ?? 0) || 0,
          date: match.accepted_date || match.quote_date || null,
        },
      }
    : { found: false };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Utilisateur connecté uniquement
  const authHeader = req.headers.get("Authorization") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token || token === anonKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { dossierRef?: unknown };
    const ref = typeof body?.dossierRef === "string" ? body.dossierRef.trim() : "";
    if (!ref || ref.length > 60) {
      return new Response(JSON.stringify({ error: "Référence de dossier invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = normalize(ref);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return new Response(cached.body, {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }

    const creds = readCredentials();
    // Recherche exacte documentée : ?full_quote_ref={numéro}&with_details=1
    const match = await findQuoteByRef(creds, ref);

    const responseBody = JSON.stringify(buildPayload(match, ref));
    cache.set(cacheKey, { at: Date.now(), body: responseBody });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);

    return new Response(responseBody, {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
    const isQuota = error instanceof FpError && error.status === 429;
    console.error("facturation-pro-quote-lookup error", error);
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? "facturation.pro n'a pas répondu dans le délai imparti"
          : error instanceof Error
            ? error.message
            : "Erreur inconnue",
      }),
      {
        status: isTimeout ? 504 : isQuota ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
