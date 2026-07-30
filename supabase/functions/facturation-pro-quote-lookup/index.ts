const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://www.facturation.pro";

interface FpQuote {
  id: number;
  quote_ref?: string;
  title?: string;
  total?: string;
  quote_date?: string;
  accepted_date?: string;
  customer_identity?: string;
  customer_short_name?: string;
}

const extract = (data: unknown): FpQuote[] => {
  if (Array.isArray(data)) return data as FpQuote[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj?.quotes)) return obj.quotes as FpQuote[];
  if (Array.isArray(obj?.data)) return obj.data as FpQuote[];
  return [];
};

const normalize = (v: string) => v.replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Cache court en mémoire (par instance) pour limiter les appels à facturation.pro */
const CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 12000;
const cache = new Map<string, { at: number; body: string }>();



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
    const body = await req.json().catch(() => ({}));
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

    const apiKey = Deno.env.get("FACTURATION_PRO_API_KEY");
    const apiId = Deno.env.get("FACTURATION_PRO_API_ID");
    const firmId = Deno.env.get("FACTURATION_PRO_FIRM_ID");
    if (!apiKey || !apiId || !firmId) throw new Error("Identifiants facturation.pro manquants");

    const headers = {
      Authorization: `Basic ${btoa(`${apiId}:${apiKey}`)}`,
      "Content-Type": "application/json",
    };

    const target = cacheKey;
    let match: FpQuote | null = null;

    for (let page = 1; page <= 10 && !match; page++) {
      const url = new URL(`${API_URL}/firms/${firmId}/quotes.json`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", "100");
      const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) break;
      const quotes = extract(await res.json());
      if (quotes.length === 0) break;
      match =
        quotes.find((q) => q.quote_ref && normalize(q.quote_ref) === target) ??
        quotes.find((q) => q.quote_ref && normalize(q.quote_ref).includes(target)) ??
        null;
      if (quotes.length < 100) break;
    }

    const payload = match
      ? {
          found: true,
          quote: {
            id: String(match.id),
            ref: match.quote_ref ?? ref,
            title: match.title ?? "",
            customer: match.customer_identity || match.customer_short_name || "",
            total: Number(match.total ?? 0) || 0,
            date: match.accepted_date || match.quote_date || null,
          },
        }
      : { found: false };

    const responseBody = JSON.stringify(payload);
    cache.set(cacheKey, { at: Date.now(), body: responseBody });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);

    return new Response(responseBody, {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
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
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

