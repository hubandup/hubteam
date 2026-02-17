import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Try to find the company's real website domain by fetching common URLs
async function findCompanyDomain(company: string): Promise<string | null> {
  const normalizedName = company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  const candidates = [
    `https://www.${normalizedName}.com`,
    `https://www.${normalizedName}.fr`,
    `https://${normalizedName}.com`,
    `https://${normalizedName}.fr`,
    `https://www.${normalizedName}.io`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(3000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (resp.ok || resp.status === 301 || resp.status === 302) {
        const finalUrl = resp.url || url;
        try {
          return new URL(finalUrl).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      }
    } catch {
      // continue to next candidate
    }
  }
  return null;
}

// Try to verify a LinkedIn profile URL exists
async function verifyLinkedInProfile(
  firstName: string,
  lastName: string
): Promise<string | null> {
  // Construct the most likely LinkedIn slug
  const slug = `${firstName}-${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const url = `https://www.linkedin.com/in/${slug}/`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
      },
    });

    if (resp.ok) {
      const html = await resp.text();
      // Check if it's a real profile page (not a 404/login redirect)
      const nameInPage =
        html.toLowerCase().includes(firstName.toLowerCase()) &&
        html.toLowerCase().includes(lastName.toLowerCase());
      if (nameInPage) {
        return url;
      }
    }
  } catch {
    // LinkedIn blocks most requests, that's expected
  }

  return null;
}

// Scrape a company page on LinkedIn to find employees
async function scrapeLinkedInCompany(
  companyName: string
): Promise<string | null> {
  const slug = companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

  const url = `https://www.linkedin.com/company/${slug}/`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
      },
    });

    if (resp.ok) {
      const html = await resp.text();
      // Extract any useful metadata from the company page
      const websiteMatch = html.match(
        /(?:website|site web)[^"]*"([^"]+\.[a-z]{2,})/i
      );
      if (websiteMatch) {
        try {
          return new URL(
            websiteMatch[1].startsWith("http")
              ? websiteMatch[1]
              : `https://${websiteMatch[1]}`
          ).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      }
    }
  } catch {
    // Expected - LinkedIn blocks most requests
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service IA non configuré" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { contacts } = (await req.json()) as { contacts: ContactInput[] };

    if (!contacts?.length) {
      return new Response(
        JSON.stringify({ error: "Aucun contact à enrichir" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Phase 1: Gather real web data for each unique company
    const uniqueCompanies = [...new Set(contacts.map((c) => c.company))];
    const companyDomains: Record<string, string | null> = {};

    console.log(
      `[enrich] Phase 1: Resolving domains for ${uniqueCompanies.length} companies`
    );

    // Resolve company domains in parallel (batches of 5)
    for (let i = 0; i < uniqueCompanies.length; i += 5) {
      const batch = uniqueCompanies.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (company) => {
          // Try direct website resolution first
          let domain = await findCompanyDomain(company);
          // If that fails, try LinkedIn company page scraping
          if (!domain) {
            domain = await scrapeLinkedInCompany(company);
          }
          return { company, domain };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          companyDomains[result.value.company] = result.value.domain;
          if (result.value.domain) {
            console.log(
              `[enrich] Found domain for "${result.value.company}": ${result.value.domain}`
            );
          }
        }
      }
    }

    // Phase 2: Try to verify LinkedIn profiles for contacts missing linkedin_url
    console.log(`[enrich] Phase 2: Verifying LinkedIn profiles`);
    const linkedinResults: Record<string, string | null> = {};

    const contactsNeedingLinkedin = contacts.filter((c) => !c.linkedin_url);
    for (let i = 0; i < contactsNeedingLinkedin.length; i += 5) {
      const batch = contactsNeedingLinkedin.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (c) => {
          const url = await verifyLinkedInProfile(c.first_name, c.last_name);
          return { id: c.id, url };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.url) {
          linkedinResults[result.value.id] = result.value.url;
          console.log(
            `[enrich] Verified LinkedIn profile: ${result.value.url}`
          );
        }
      }
    }

    // Phase 3: Use AI with the gathered context for remaining enrichment
    console.log(`[enrich] Phase 3: AI enrichment with web context`);
    const BATCH_SIZE = 10;
    const allResults: EnrichedResult[] = [];

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      const contactList = batch
        .map((c, idx) => {
          const domain = companyDomains[c.company];
          const verifiedLinkedin = linkedinResults[c.id];
          let line = `${idx + 1}. "${c.first_name} ${c.last_name}" chez "${c.company}"`;
          if (c.job_title) line += ` (poste: ${c.job_title})`;
          if (domain) line += ` [DOMAINE VÉRIFIÉ: ${domain}]`;
          if (verifiedLinkedin)
            line += ` [LINKEDIN VÉRIFIÉ: ${verifiedLinkedin}]`;
          return line;
        })
        .join("\n");

      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Tu es un expert en recherche de contacts B2B. Pour chaque contact, utilise les informations fournies pour déduire les données manquantes.

RÈGLES CRITIQUES :
- Si un [DOMAINE VÉRIFIÉ] est fourni, utilise-le pour construire l'email (patterns: prenom.nom@domaine, p.nom@domaine, prenom@domaine).
- Si un [LINKEDIN VÉRIFIÉ] est fourni, utilise cette URL exacte.
- Si aucun domaine n'est vérifié, essaie de deviner le domaine de l'entreprise et indique "medium" ou "low" confidence.
- Pour LinkedIn sans URL vérifiée, construis l'URL probable : https://www.linkedin.com/in/prenom-nom/ (en minuscules, sans accents).
- Ne fabrique JAMAIS de numéros de téléphone - indique toujours "unknown" pour le téléphone sauf si tu es absolument certain.
- Indique le niveau de confiance : "high" si basé sur un domaine/LinkedIn vérifié, "medium" si pattern probable, "low" si estimation.`,
              },
              {
                role: "user",
                content: `Trouve les informations professionnelles de ces contacts :\n\n${contactList}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "return_enriched_contacts",
                  description:
                    "Return enriched contact information for each contact.",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: {
                              type: "number",
                              description: "1-based index of the contact",
                            },
                            email: {
                              type: "string",
                              description:
                                'Professional email address or "unknown"',
                            },
                            phone: {
                              type: "string",
                              description:
                                'Phone number in French format or "unknown"',
                            },
                            linkedin_url: {
                              type: "string",
                              description:
                                'Full LinkedIn profile URL or "unknown"',
                            },
                            job_title: {
                              type: "string",
                              description:
                                'Professional job title or "unknown"',
                            },
                            confidence: {
                              type: "string",
                              enum: ["high", "medium", "low"],
                            },
                          },
                          required: ["index", "confidence"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["results"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "return_enriched_contacts" },
            },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({
              error: "Trop de requêtes, réessayez dans quelques instants.",
              partial_results: allResults,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({
              error: "Crédits IA insuffisants.",
              partial_results: allResults,
            }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: "Erreur du service IA" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          const results = parsed.results || [];

          for (const r of results) {
            const contact = batch[r.index - 1];
            if (!contact) continue;

            const enriched: EnrichedResult = {
              id: contact.id,
              confidence: r.confidence || "low",
            };

            if (r.email && r.email !== "unknown") enriched.email = r.email;
            if (r.phone && r.phone !== "unknown") enriched.phone = r.phone;

            // Prefer verified LinkedIn URL over AI-generated one
            const verifiedLi = linkedinResults[contact.id];
            if (verifiedLi) {
              enriched.linkedin_url = verifiedLi;
              // Boost confidence if we verified LinkedIn
              if (enriched.confidence === "low") enriched.confidence = "medium";
            } else if (r.linkedin_url && r.linkedin_url !== "unknown") {
              enriched.linkedin_url = r.linkedin_url;
            }

            if (r.job_title && r.job_title !== "unknown")
              enriched.job_title = r.job_title;

            // Boost confidence if domain was verified and email uses it
            const domain = companyDomains[contact.company];
            if (domain && enriched.email?.endsWith(`@${domain}`)) {
              enriched.confidence = "high";
            }

            allResults.push(enriched);
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response:", parseErr);
        }
      }
    }

    console.log(
      `[enrich] Done. ${allResults.length} contacts enriched. Verified domains: ${Object.values(companyDomains).filter(Boolean).length}, Verified LinkedIn: ${Object.values(linkedinResults).filter(Boolean).length}`
    );

    return new Response(JSON.stringify({ results: allResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("enrich-contacts error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur interne",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
