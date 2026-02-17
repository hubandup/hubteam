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

    // Process in batches of 10
    const BATCH_SIZE = 10;
    const allResults: EnrichedResult[] = [];

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      const contactList = batch
        .map(
          (c, idx) =>
            `${idx + 1}. "${c.first_name} ${c.last_name}" chez "${c.company}"${c.job_title ? ` (poste: ${c.job_title})` : ""}`
        )
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
                content: `Tu es un expert en recherche de contacts B2B. Pour chaque contact donné (nom + entreprise), tu dois trouver les informations professionnelles les plus probables.

RÈGLES IMPORTANTES :
- Ne fabrique JAMAIS d'informations. Si tu ne trouves pas avec une bonne confiance, indique "unknown".
- Pour les emails, utilise les patterns courants (prenom.nom@domaine.com, prenom@domaine.com, etc.) basés sur le domaine réel de l'entreprise.
- Pour LinkedIn, fournis l'URL complète si tu la connais, sinon "unknown".
- Pour le téléphone, fournis le numéro au format français si possible, sinon "unknown".
- Pour le poste, fournis le titre professionnel si tu le connais, sinon "unknown".
- Indique le niveau de confiance : "high" si tu es sûr (entreprise connue, pattern email vérifié), "medium" si c'est probable, "low" si c'est une estimation.`,
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
            JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Crédits IA insuffisants." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: "Erreur du service IA" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
            if (r.linkedin_url && r.linkedin_url !== "unknown")
              enriched.linkedin_url = r.linkedin_url;
            if (r.job_title && r.job_title !== "unknown")
              enriched.job_title = r.job_title;

            allResults.push(enriched);
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response:", parseErr);
        }
      }
    }

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
