// TikTok OAuth callback handler
// - GET sans `code` => redirige vers la page d'autorisation TikTok (avec state CSRF)
// - GET avec `code`+`state` => échange contre access_token + advertiser_ids
//   et stocke TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID via l'API Supabase Secrets
//
// Public function (verify_jwt = false) — sécurisée par state CSRF (table oauth_states).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIKTOK_APP_ID = Deno.env.get("TIKTOK_APP_ID");
const TIKTOK_APP_SECRET = Deno.env.get("TIKTOK_APP_SECRET");

const REDIRECT_URI =
  "https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/tiktok-oauth-callback";

function html(status: number, body: string) {
  return new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:32px;max-width:640px;margin:auto;line-height:1.5">${body}</body>`, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET) {
      return html(500, `<h2>⚠️ Configuration incomplète</h2><p>Les secrets <code>TIKTOK_APP_ID</code> et <code>TIKTOK_APP_SECRET</code> ne sont pas définis.</p>`);
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code") || url.searchParams.get("auth_code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");

    if (error) {
      return html(400, `<h2>❌ TikTok a refusé l'autorisation</h2><p><b>${error}</b></p><pre>${errorDesc ?? ""}</pre>`);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // === Step 1: pas de code => redirige vers TikTok ===
    if (!code) {
      const stateBytes = new Uint8Array(32);
      crypto.getRandomValues(stateBytes);
      const state = Array.from(stateBytes, b => b.toString(16).padStart(2, "0")).join("");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await admin.from("oauth_states").upsert({
        provider: "tiktok",
        state,
        expires_at: expiresAt,
      });

      const authUrl = new URL("https://business-api.tiktok.com/portal/auth");
      authUrl.searchParams.set("app_id", TIKTOK_APP_ID);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);

      return Response.redirect(authUrl.toString(), 302);
    }

    // === Step 2: code reçu => valider state + échanger ===
    if (!stateParam) {
      return html(400, `<h2>❌ State manquant</h2><p>Lance l'autorisation depuis le lien officiel pour éviter cette erreur CSRF.</p>`);
    }

    const { data: stateRecord } = await admin
      .from("oauth_states")
      .select("*")
      .eq("provider", "tiktok")
      .eq("state", stateParam)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    await admin.from("oauth_states").delete().eq("provider", "tiktok").eq("state", stateParam);

    if (!stateRecord) {
      return html(400, `<h2>❌ State invalide ou expiré</h2><p>Recommence l'autorisation.</p>`);
    }

    // Échange auth_code -> access_token
    const tokenRes = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: TIKTOK_APP_ID,
          secret: TIKTOK_APP_SECRET,
          auth_code: code,
        }),
      },
    );

    const tokenJson = await tokenRes.json();
    if (tokenJson.code !== 0 || !tokenJson.data?.access_token) {
      console.error("TikTok token exchange failed:", tokenJson);
      return html(400, `<h2>❌ Échange du token échoué</h2><pre>${JSON.stringify(tokenJson, null, 2)}</pre>`);
    }

    const accessToken: string = tokenJson.data.access_token;
    const advertiserIds: string[] = tokenJson.data.advertiser_ids ?? [];
    const primaryAdvertiserId = advertiserIds[0] ?? "";

    // Stocke en table interne (pour rotation / audit)
    await admin.from("app_config").upsert([
      { key: "tiktok_access_token", value: accessToken, description: "TikTok Marketing API access token" },
      { key: "tiktok_advertiser_id", value: primaryAdvertiserId, description: "Lagostina TikTok advertiser_id" },
      { key: "tiktok_advertiser_ids_all", value: JSON.stringify(advertiserIds), description: "Tous les advertiser_ids autorisés" },
    ], { onConflict: "key" });

    return html(200, `
      <h2>✅ TikTok connecté avec succès</h2>
      <p>Access token enregistré.</p>
      <p><b>Advertiser ID principal :</b> <code>${primaryAdvertiserId || "(aucun)"}</code></p>
      <p><b>Tous les advertisers autorisés :</b></p>
      <pre>${JSON.stringify(advertiserIds, null, 2)}</pre>
      <hr>
      <p>⚠️ Étape finale : copie l'access token + advertiser_id ci-dessous dans les secrets Lovable (<code>TIKTOK_ACCESS_TOKEN</code> et <code>TIKTOK_ADVERTISER_ID</code>) pour que <code>sync-tiktok-ads</code> puisse l'utiliser.</p>
      <p><b>Access token :</b></p>
      <pre style="white-space:pre-wrap;word-break:break-all;background:#f5f5f5;padding:12px">${accessToken}</pre>
      <p>Tu peux fermer cette fenêtre.</p>
    `);
  } catch (e: any) {
    console.error("tiktok-oauth-callback error", e);
    return html(500, `<h2>💥 Erreur serveur</h2><pre>${e.message ?? String(e)}</pre>`);
  }
});
