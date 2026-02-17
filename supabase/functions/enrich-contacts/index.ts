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

// Search DuckDuckGo HTML for links matching a pattern
async function searchDuckDuckGo(query: string): Promise<string[]> {
  try {
    const encoded = encodeURIComponent(query);
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    // Extract URLs from DuckDuckGo result links
    const urls: string[] = [];
    const linkRegex = /href="https?:\/\/[^"]+"/gi;
    const matches = html.match(linkRegex) || [];
    for (const m of matches) {
      const url = m.slice(6, -1); // remove href=" and trailing "
      // Skip DuckDuckGo internal links
      if (!url.includes("duckduckgo.com") && !url.includes("duck.co")) {
        urls.push(url);
      }
    }
    return urls.slice(0, 15);
  } catch {
    return [];
  }
}

// Find company domain via DuckDuckGo search + direct probing
async function findCompanyDomain(company: string): Promise<string | null> {
  // Phase 1: Try DuckDuckGo search
  const searchResults = await searchDuckDuckGo(`${company} site officiel`);
  
  // Look for the company's own website in results (exclude social media, directories)
  const excludeDomains = ["linkedin.com", "facebook.com", "twitter.com", "wikipedia.org", "societe.com", "pappers.fr", "infogreffe.fr", "youtube.com", "instagram.com"];
  
  for (const url of searchResults) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, "");
      if (excludeDomains.some(d => hostname.includes(d))) continue;
      
      // Check if company name appears in the domain
      const normalizedCompany = company.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normalizedHost = hostname.toLowerCase().replace(/[^a-z0-9.]/g, "");
      
      if (normalizedHost.includes(normalizedCompany.slice(0, Math.min(normalizedCompany.length, 6)))) {
        // Verify domain is reachable
        try {
          const check = await fetch(`https://${hostname}`, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(3000),
          });
          if (check.ok || check.status === 301 || check.status === 302) {
            console.log(`[enrich] DDG found domain for "${company}": ${hostname}`);
            return hostname;
          }
        } catch { /* continue */ }
      }
    } catch { /* continue */ }
  }

  // Phase 2: Direct probing with extended TLDs
  const normalizedName = company.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const tlds = [".com", ".fr", ".io", ".eu", ".co", ".net", ".org", ".tech", ".agency", ".digital", ".co.fr"];
  
  for (const tld of tlds) {
    for (const prefix of ["www.", ""]) {
      const url = `https://${prefix}${normalizedName}${tld}`;
      try {
        const resp = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (resp.ok || resp.status === 301 || resp.status === 302) {
          const finalUrl = resp.url || url;
          try {
            const domain = new URL(finalUrl).hostname.replace(/^www\./, "");
            console.log(`[enrich] Probe found domain for "${company}": ${domain}`);
            return domain;
          } catch { /* continue */ }
        }
      } catch { /* continue */ }
    }
  }
  
  return null;
}

// Search for LinkedIn profile via DuckDuckGo
async function findLinkedInProfile(firstName: string, lastName: string, company: string): Promise<string | null> {
  const query = `site:linkedin.com/in/ "${firstName} ${lastName}" "${company}"`;
  const results = await searchDuckDuckGo(query);
  
  // Find LinkedIn profile URLs
  for (const url of results) {
    if (url.includes("linkedin.com/in/")) {
      // Clean up the URL
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;
        if (path.startsWith("/in/") && path.length > 5) {
          const cleanUrl = `https://www.linkedin.com${path.endsWith("/") ? path : path + "/"}`;
          console.log(`[enrich] DDG found LinkedIn for "${firstName} ${lastName}": ${cleanUrl}`);
          return cleanUrl;
        }
      } catch { /* continue */ }
    }
  }

  // Fallback: construct and verify the most likely slug
  const slug = `${firstName}-${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const profileUrl = `https://www.linkedin.com/in/${slug}/`;
  try {
    const resp = await fetch(profileUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
      },
    });
    if (resp.ok) {
      const html = await resp.text();
      if (html.toLowerCase().includes(firstName.toLowerCase()) && html.toLowerCase().includes(lastName.toLowerCase())) {
        console.log(`[enrich] Verified LinkedIn slug: ${profileUrl}`);
        return profileUrl;
      }
    }
  } catch { /* LinkedIn blocks most requests */ }

  return null;
}

// Verify a domain has MX records (valid email domain) via DNS-over-HTTPS
async function verifyEmailDomain(domain: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.Answer && data.Answer.length > 0;
  } catch {
    return false;
  }
}

// Try to find company website from LinkedIn company page
async function scrapeLinkedInCompany(companyName: string): Promise<string | null> {
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (resp.ok) {
      const html = await resp.text();
      const websiteMatch = html.match(/(?:website|site web)[^"]*"([^"]+\.[a-z]{2,})/i);
      if (websiteMatch) {
        try {
          return new URL(websiteMatch[1].startsWith("http") ? websiteMatch[1] : `https://${websiteMatch[1]}`).hostname.replace(/^www\./, "");
        } catch { return null; }
      }
    }
  } catch { /* Expected */ }
  return null;
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Service IA non configuré" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contacts } = (await req.json()) as { contacts: ContactInput[] };
    if (!contacts?.length) {
      return new Response(JSON.stringify({ error: "Aucun contact à enrichir" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Phase 1: Resolve company domains ===
    const uniqueCompanies = [...new Set(contacts.map((c) => c.company))];
    const companyDomains: Record<string, string | null> = {};
    const verifiedEmailDomains: Record<string, boolean> = {};

    console.log(`[enrich] Phase 1: Resolving domains for ${uniqueCompanies.length} companies`);

    for (let i = 0; i < uniqueCompanies.length; i += 3) {
      const batch = uniqueCompanies.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(async (company) => {
          let domain = await findCompanyDomain(company);
          if (!domain) {
            domain = await scrapeLinkedInCompany(company);
          }
          // Verify MX records if domain found
          let mxValid = false;
          if (domain) {
            mxValid = await verifyEmailDomain(domain);
          }
          return { company, domain, mxValid };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          companyDomains[result.value.company] = result.value.domain;
          if (result.value.domain) {
            verifiedEmailDomains[result.value.domain] = result.value.mxValid;
            console.log(`[enrich] Domain "${result.value.company}": ${result.value.domain} (MX: ${result.value.mxValid})`);
          }
        }
      }
    }

    // === Phase 2: Find LinkedIn profiles via search ===
    console.log(`[enrich] Phase 2: Searching LinkedIn profiles`);
    const linkedinResults: Record<string, string | null> = {};

    const contactsNeedingLinkedin = contacts.filter((c) => !c.linkedin_url);
    for (let i = 0; i < contactsNeedingLinkedin.length; i += 3) {
      const batch = contactsNeedingLinkedin.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(async (c) => {
          const url = await findLinkedInProfile(c.first_name, c.last_name, c.company);
          return { id: c.id, url };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.url) {
          linkedinResults[result.value.id] = result.value.url;
        }
      }
    }

    // === Phase 3: AI enrichment with verified context ===
    console.log(`[enrich] Phase 3: AI enrichment with web context`);
    const BATCH_SIZE = 10;
    const allResults: EnrichedResult[] = [];

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      const contactList = batch
        .map((c, idx) => {
          const domain = companyDomains[c.company];
          const mxValid = domain ? verifiedEmailDomains[domain] : false;
          const verifiedLinkedin = linkedinResults[c.id];
          let line = `${idx + 1}. "${c.first_name} ${c.last_name}" chez "${c.company}"`;
          if (c.job_title) line += ` (poste: ${c.job_title})`;
          if (domain) line += ` [DOMAINE VÉRIFIÉ: ${domain}${mxValid ? " ✓MX" : " ✗MX"}]`;
          if (verifiedLinkedin) line += ` [LINKEDIN TROUVÉ: ${verifiedLinkedin}]`;
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
                content: `Tu es un expert en recherche de contacts B2B. Pour chaque contact, utilise les informations vérifiées fournies pour déduire les données manquantes.

RÈGLES CRITIQUES :
- Si un [DOMAINE VÉRIFIÉ] avec ✓MX est fourni, le domaine accepte des emails. Utilise-le pour construire l'email avec ces patterns par ordre de priorité : prenom.nom@domaine, p.nom@domaine, prenom@domaine, nom@domaine.
- Si un [DOMAINE VÉRIFIÉ] avec ✗MX est fourni, le domaine ne semble pas accepter d'emails. Essaie quand même le pattern prenom.nom@domaine mais indique "low" confidence.
- Si un [LINKEDIN TROUVÉ] est fourni, utilise cette URL exacte - elle a été trouvée par recherche web.
- Si aucun domaine n'est vérifié, essaie de deviner le domaine et indique "low" confidence.
- Pour LinkedIn sans URL trouvée, construis l'URL probable : https://www.linkedin.com/in/prenom-nom/
- Ne fabrique JAMAIS de numéros de téléphone - indique toujours "unknown".
- Niveaux de confiance : "high" = domaine vérifié avec MX + LinkedIn trouvé, "medium" = un des deux vérifié, "low" = estimation pure.`,
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
                  description: "Return enriched contact information for each contact.",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "number", description: "1-based index of the contact" },
                            email: { type: "string", description: 'Professional email address or "unknown"' },
                            phone: { type: "string", description: 'Always "unknown"' },
                            linkedin_url: { type: "string", description: 'Full LinkedIn profile URL or "unknown"' },
                            job_title: { type: "string", description: 'Professional job title or "unknown"' },
                            confidence: { type: "string", enum: ["high", "medium", "low"] },
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
            tool_choice: { type: "function", function: { name: "return_enriched_contacts" } },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants.", partial_results: allResults }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Crédits IA insuffisants.", partial_results: allResults }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

            // Prefer search-found LinkedIn URL over AI-generated one
            const verifiedLi = linkedinResults[contact.id];
            if (verifiedLi) {
              enriched.linkedin_url = verifiedLi;
              if (enriched.confidence === "low") enriched.confidence = "medium";
            } else if (r.linkedin_url && r.linkedin_url !== "unknown") {
              enriched.linkedin_url = r.linkedin_url;
            }

            if (r.job_title && r.job_title !== "unknown") enriched.job_title = r.job_title;

            // Boost confidence if domain was verified with MX and email uses it
            const domain = companyDomains[contact.company];
            if (domain && enriched.email?.endsWith(`@${domain}`)) {
              if (verifiedEmailDomains[domain]) {
                enriched.confidence = "high";
              }
            }

            allResults.push(enriched);
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response:", parseErr);
        }
      }
    }

    const stats = {
      total: allResults.length,
      verifiedDomains: Object.values(companyDomains).filter(Boolean).length,
      mxVerified: Object.values(verifiedEmailDomains).filter(Boolean).length,
      linkedinFound: Object.values(linkedinResults).filter(Boolean).length,
    };
    console.log(`[enrich] Done.`, JSON.stringify(stats));

    return new Response(JSON.stringify({ results: allResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("enrich-contacts error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
