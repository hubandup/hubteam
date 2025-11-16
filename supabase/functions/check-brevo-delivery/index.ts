import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckByMessageIdRequest {
  messageId?: string;
  recipient?: string;
  limit?: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Check Brevo Delivery Request Started ===");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("❌ BREVO_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "BREVO_API_KEY is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log("✓ Brevo API key found");

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { messageId, recipient, limit = 20 }: CheckByMessageIdRequest = await req.json();
    console.log("🔎 Query params:", { messageId, recipient, limit });

    if (!messageId && !recipient) {
      return new Response(JSON.stringify({ error: "Provide either messageId or recipient" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let brevoUrl = "";
    if (messageId) {
      // Fetch a specific email by messageId
      brevoUrl = `https://api.brevo.com/v3/smtp/emails/${encodeURIComponent(messageId)}`;
      console.log("🌐 Calling Brevo GET", brevoUrl);
    } else {
      // List events for a recipient
      const params = new URLSearchParams({ recipient: recipient!, limit: String(limit), sort: "desc" });
      brevoUrl = `https://api.brevo.com/v3/smtp/events?${params.toString()}`;
      console.log("🌐 Calling Brevo GET", brevoUrl);
    }

    const brevoRes = await fetch(brevoUrl, {
      method: "GET",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
    });

    console.log("📥 Brevo status:", brevoRes.status, brevoRes.statusText);

    const text = await brevoRes.text();
    let json: any = undefined;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      console.warn("⚠️ Could not parse Brevo JSON, returning raw text");
    }

    if (!brevoRes.ok) {
      console.error("❌ Brevo error payload:", text);
      return new Response(JSON.stringify({ error: "Brevo API error", status: brevoRes.status, body: json ?? text }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("✓ Brevo response retrieved");

    return new Response(JSON.stringify({ success: true, data: json ?? text }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error in check-brevo-delivery function:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
