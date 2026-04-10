import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://hubandup.org",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const stateParam = url.searchParams.get("state");

    if (error) {
      console.error("LinkedIn OAuth error:", error);
      return new Response(
        `<html><body><h2>Erreur LinkedIn OAuth</h2><p>${error}</p></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!code) {
      // Step 1: Generate random state and store it, then redirect to LinkedIn
      const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
      if (!clientId) {
        return new Response(JSON.stringify({ error: "LINKEDIN_CLIENT_ID not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      // Generate cryptographically random state
      const stateBytes = new Uint8Array(32);
      crypto.getRandomValues(stateBytes);
      const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");

      // Store state in DB with expiry (10 minutes)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from("oauth_states").upsert({
        provider: "linkedin",
        state,
        expires_at: expiresAt,
      });

      const redirectUri = "https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/linkedin-oauth-callback";
      const scopes = "w_organization_social";
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;

      return Response.redirect(authUrl, 302);
    }

    // Step 2: Verify state parameter
    if (!stateParam) {
      return new Response(
        `<html><body><h2>Erreur CSRF</h2><p>Paramètre state manquant.</p></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    const { data: stateRecord } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("provider", "linkedin")
      .eq("state", stateParam)
      .gt("expires_at", new Date().toISOString())
      .single();

    // Clean up used state immediately
    await supabase.from("oauth_states").delete().eq("provider", "linkedin").eq("state", stateParam);

    if (!stateRecord) {
      return new Response(
        `<html><body><h2>Erreur CSRF</h2><p>State invalide ou expiré. Veuillez réessayer.</p></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    // Step 3: Exchange code for access token
    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
    const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
    const redirectUri = "https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/linkedin-oauth-callback";

    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Token exchange failed:", errText);
      return new Response(
        `<html><body><h2>Erreur échange token</h2><pre>${errText}</pre></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;
    const refreshToken = tokenData.refresh_token || null;

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Delete old tokens and insert new one
    await supabase.from("linkedin_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: insertError } = await supabase.from("linkedin_tokens").insert({
      access_token: accessToken,
      expires_at: expiresAt,
      refresh_token: refreshToken,
    });

    if (insertError) {
      console.error("Failed to store token:", insertError);
      return new Response(
        `<html><body><h2>Erreur stockage token</h2><pre>${JSON.stringify(insertError)}</pre></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 500 }
      );
    }

    console.log("LinkedIn OAuth token stored successfully, expires at:", expiresAt);

    return new Response(
      `<html><body><h2>✅ LinkedIn connecté avec succès !</h2><p>Token valide jusqu'au ${new Date(expiresAt).toLocaleDateString("fr-FR")}.</p><p>Vous pouvez fermer cette fenêtre.</p></body></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
