import { createClient } from "npm:@supabase/supabase-js@2";
import { listCategories, readCredentials, type FpCategory } from "../_shared/facturation-pro.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Liste des categories comptables facturation.pro (GET /categories.json, paginee). */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const creds = readCredentials();
    const all: FpCategory[] = [];
    let page = 1;
    while (page <= 20) {
      const res = await listCategories(creds, page);
      all.push(...res.data);
      const totalPages = res.pagination?.totalPages ?? 1;
      if (!res.data.length || page >= totalPages) break;
      page++;
    }

    const categories = all.map((c) => ({
      id: c.id,
      label: c.title || c.name || c.label || `Categorie ${c.id}`,
    }));

    return json({ success: true, categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return json({ error: message }, 500);
  }
});
