import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UnsubscribeRequest {
  email: string;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, reason }: UnsubscribeRequest = await req.json();

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Email invalide" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Processing unsubscribe request for: ${normalizedEmail}`);

    // Get request metadata
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

    // Find prospect by email
    const { data: prospect, error: findError } = await supabaseAdmin
      .from("prospects")
      .select("id, unsubscribed")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (findError) {
      console.error("Error finding prospect:", findError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la recherche" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already unsubscribed
    if (prospect?.unsubscribed) {
      console.log(`Email ${normalizedEmail} already unsubscribed`);
      return new Response(
        JSON.stringify({ success: true, alreadyUnsubscribed: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update prospect if found
    if (prospect) {
      const { error: updateError } = await supabaseAdmin
        .from("prospects")
        .update({
          unsubscribed: true,
          unsubscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", prospect.id);

      if (updateError) {
        console.error("Error updating prospect:", updateError);
        return new Response(
          JSON.stringify({ error: "Erreur lors de la mise à jour" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Successfully unsubscribed prospect ${prospect.id}`);
    } else {
      console.log(`No prospect found for email ${normalizedEmail}, logging unsubscribe anyway`);
    }

    // Log the unsubscribe event
    const { error: logError } = await supabaseAdmin
      .from("email_unsubscribes")
      .insert({
        email: normalizedEmail,
        prospect_id: prospect?.id || null,
        reason: reason || null,
        ip_address: ipAddress,
        user_agent: userAgent.substring(0, 500), // Truncate if too long
      });

    if (logError) {
      console.error("Error logging unsubscribe:", logError);
      // Don't fail the request, just log the error
    } else {
      console.log(`Logged unsubscribe event for ${normalizedEmail}`);
    }

    return new Response(
      JSON.stringify({ success: true, alreadyUnsubscribed: false }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in handle-unsubscribe function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
