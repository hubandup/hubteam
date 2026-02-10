import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

    if (error) {
      console.error("LinkedIn OAuth error:", error);
      return new Response(
        `<html><body><h2>Erreur LinkedIn OAuth</h2><p>${error}</p></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    if (!code) {
      // Step 1: Redirect to LinkedIn authorization
      const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
      if (!clientId) {
        return new Response(JSON.stringify({ error: "LINKEDIN_CLIENT_ID not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      const redirectUri = `${url.origin}${url.pathname}`;
      const scopes = "r_organization_social rw_organization_admin";
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=linkedin_oauth`;

      return Response.redirect(authUrl, 302);
    }

    // Step 2: Exchange code for access token
    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
    const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
    const redirectUri = `${url.origin}${url.pathname}`;

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
    const expiresIn = tokenData.expires_in; // seconds
    const refreshToken = tokenData.refresh_token || null;

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Store token in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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
