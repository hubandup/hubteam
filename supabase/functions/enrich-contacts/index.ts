import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HUNTER_BASE_URL = "https://api.hunter.io/v2";

interface ContactInput {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  job_title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
}

interface EnrichedResult {
  id: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  job_title?: string;
  confidence: "high" | "medium" | "low";
}

// Find company domain via Hunter domain search
async function findCompanyDomain(
  company: string,
  apiKey: string
): Promise<string | null> {
  try {
    const url = `${HUNTER_BASE_URL}/domain-search?company=${encodeURIComponent(company)}&limit=1&api_key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      const text = await resp.text();
      console.warn(`[hunter] domain-search failed for "${company}": ${resp.status} ${text}`);
      return null;
    }
    const data = await resp.json();
    const domain = data?.data?.domain;
    if (domain) {
      console.log(`[hunter] Found domain for "${company}": ${domain}`);
      return domain;
    }
    return null;
  } catch (e) {
    console.warn(`[hunter] domain-search error for "${company}":`, e);
    return null;
  }
}

// Find email via Hunter email-finder
async function findEmail(
  firstName: string,
  lastName: string,
  domain: string,
  apiKey: string
): Promise<{ email: string | null; score: number; linkedin?: string; position?: string }> {
  try {
    const url = `${HUNTER_BASE_URL}/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      const text = await resp.text();
      console.warn(`[hunter] email-finder failed for "${firstName} ${lastName}" @${domain}: ${resp.status} ${text}`);
      return { email: null, score: 0 };
    }
    const data = await resp.json();
    const email = data?.data?.email || null;
    const score = data?.data?.score || 0;
    const sources = data?.data?.sources || [];
    // Try to extract LinkedIn from sources
    const linkedinSource = sources.find((s: { uri?: string }) =>
      s?.uri?.includes("linkedin.com")
    );
    const linkedin = linkedinSource?.uri || null;
    const position = data?.data?.position || null;
    if (email) {
      console.log(`[hunter] Found email for "${firstName} ${lastName}": ${email} (score: ${score})`);
    }
    return { email, score, linkedin, position };
  } catch (e) {
    console.warn(`[hunter] email-finder error for "${firstName} ${lastName}" @${domain}:`, e);
    return { email: null, score: 0 };
  }
}

// Verify an email via Hunter email-verifier
async function verifyEmail(
  email: string,
  apiKey: string
): Promise<{ status: string; score: number }> {
  try {
    const url = `${HUNTER_BASE_URL}/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return { status: "unknown", score: 0 };
    const data = await resp.json();
    return {
      status: data?.data?.status || "unknown",
      score: data?.data?.score || 0,
    };
  } catch {
    return { status: "unknown", score: 0 };
  }
}

// Map Hunter score to our confidence level
function scoreToConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

// Fallback: search all emails from a domain and find the best match for a person
async function searchDomainEmails(
  domain: string,
  firstName: string,
  lastName: string,
  apiKey: string
): Promise<{ email: string | null; score: number; linkedin?: string; position?: string }> {
  try {
    const url = `${HUNTER_BASE_URL}/domain-search?domain=${encodeURIComponent(domain)}&limit=100&api_key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return { email: null, score: 0 };
    const data = await resp.json();
    const emails: Array<{
      value: string;
      confidence: number;
      first_name?: string;
      last_name?: string;
      position?: string;
      linkedin?: string;
    }> = data?.data?.emails || [];

    // Find exact match first
    const exactMatch = emails.find(
      (e) =>
        e.first_name?.toLowerCase() === firstName.toLowerCase() &&
        e.last_name?.toLowerCase() === lastName.toLowerCase()
    );
    if (exactMatch) {
      console.log(`[hunter] domain-search exact match: ${exactMatch.value}`);
      return {
        email: exactMatch.value,
        score: exactMatch.confidence || 50,
        linkedin: exactMatch.linkedin,
        position: exactMatch.position,
      };
    }

    // Partial match (same last name)
    const partialMatch = emails.find(
      (e) =>
        e.last_name?.toLowerCase() === lastName.toLowerCase()
    );
    if (partialMatch) {
      console.log(`[hunter] domain-search partial match: ${partialMatch.value}`);
      return {
        email: partialMatch.value,
        score: Math.min(partialMatch.confidence || 30, 50),
        linkedin: partialMatch.linkedin,
        position: partialMatch.position,
      };
    }

    return { email: null, score: 0 };
  } catch (e) {
    console.warn(`[hunter] domain-search emails error for ${domain}:`, e);
    return { email: null, score: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY");
    if (!HUNTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service Hunter non configuré. Veuillez configurer la clé API Hunter." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { contacts } = (await req.json()) as { contacts: ContactInput[] };
    if (!contacts?.length) {
      return new Response(JSON.stringify({ error: "Aucun contact à enrichir" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[enrich] Starting enrichment for ${contacts.length} contacts via Hunter.io`);

    // === Phase 1: Resolve company domains ===
    const uniqueCompanies = [...new Set(contacts.map((c) => c.company))];
    const companyDomains: Record<string, string | null> = {};

    console.log(`[enrich] Phase 1: Resolving ${uniqueCompanies.length} company domains via Hunter`);

    // Process domain lookups in batches to respect rate limits
    for (let i = 0; i < uniqueCompanies.length; i += 3) {
      const batch = uniqueCompanies.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map((company) => findCompanyDomain(company, HUNTER_API_KEY))
      );
      results.forEach((result, idx) => {
        const company = batch[idx];
        companyDomains[company] =
          result.status === "fulfilled" ? result.value : null;
      });
      // Small delay to be respectful of rate limits
      if (i + 3 < uniqueCompanies.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // === Phase 2: Find emails via Hunter email-finder + domain-search fallback ===
    console.log(`[enrich] Phase 2: Finding emails for ${contacts.length} contacts`);

    const allResults: EnrichedResult[] = [];

    for (let i = 0; i < contacts.length; i += 3) {
      const batch = contacts.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(async (contact) => {
          const enriched: EnrichedResult = {
            id: contact.id,
            confidence: "low",
          };

          const domain = companyDomains[contact.company];

          if (!domain) {
            console.log(`[enrich] No domain found for "${contact.company}", skipping`);
            return enriched;
          }

          // Only search email if not already set
          if (!contact.email) {
            // Try email-finder first
            let found = await findEmail(
              contact.first_name,
              contact.last_name,
              domain,
              HUNTER_API_KEY
            );

            // Fallback: search domain emails and try to match
            if (!found.email) {
              found = await searchDomainEmails(
                domain,
                contact.first_name,
                contact.last_name,
                HUNTER_API_KEY
              );
            }

            if (found.email) {
              enriched.email = found.email;
              enriched.confidence = scoreToConfidence(found.score);

              // Verify if score is borderline (between 40-70)
              if (found.score >= 40 && found.score < 70) {
                const verification = await verifyEmail(found.email, HUNTER_API_KEY);
                if (verification.status === "invalid") {
                  console.log(`[enrich] Email verified as invalid: ${found.email}`);
                  delete enriched.email;
                } else if (verification.status === "valid") {
                  enriched.confidence = "high";
                }
              }

              // LinkedIn from Hunter sources
              if (!contact.linkedin_url && found.linkedin) {
                enriched.linkedin_url = found.linkedin;
              }
              // Job title from Hunter data
              if (!contact.job_title && found.position) {
                enriched.job_title = found.position;
              }
            }
          }

          return enriched;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          allResults.push(result.value);
        }
      }

      // Small delay between batches
      if (i + 3 < contacts.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    console.log(`[enrich] Done. ${allResults.filter(r => r.email).length} emails found out of ${contacts.length} contacts.`);

    return new Response(JSON.stringify({ results: allResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[enrich] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erreur serveur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
