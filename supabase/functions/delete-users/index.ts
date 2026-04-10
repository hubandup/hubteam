import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Inline rate limiting to avoid cross-function bundling overhead
async function checkRateLimit(
  supabaseAdmin: any,
  key: string,
  options: { max: number; windowSeconds: number }
): Promise<{ exceeded: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - options.windowSeconds * 1000);
  const expiresAt = new Date(now.getTime() + options.windowSeconds * 1000);
  if (Math.random() < 0.01) {
    await supabaseAdmin.from("rate_limits").delete().lt("expires_at", now.toISOString());
  }
  const { data: existing } = await supabaseAdmin
    .from("rate_limits").select("count, window_start, expires_at").eq("key", key).single();
  if (existing) {
    const ws = new Date(existing.window_start);
    if (ws < windowStart) {
      await supabaseAdmin.from("rate_limits").update({ count: 1, window_start: now.toISOString(), expires_at: expiresAt.toISOString() }).eq("key", key);
      return { exceeded: false, remaining: options.max - 1, retryAfterSeconds: 0 };
    }
    if (existing.count >= options.max) {
      const retry = Math.max(Math.ceil((ws.getTime() + options.windowSeconds * 1000 - now.getTime()) / 1000), 1);
      return { exceeded: true, remaining: 0, retryAfterSeconds: retry };
    }
    await supabaseAdmin.from("rate_limits").update({ count: existing.count + 1 }).eq("key", key);
    return { exceeded: false, remaining: options.max - existing.count - 1, retryAfterSeconds: 0 };
  }
  await supabaseAdmin.from("rate_limits").insert({ key, count: 1, window_start: now.toISOString(), expires_at: expiresAt.toISOString() });
  return { exceeded: false, remaining: options.max - 1, retryAfterSeconds: 0 };
}

function rateLimitResponse(retryAfterSeconds: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Trop de requêtes. Veuillez réessayer plus tard.", retry_after: retryAfterSeconds }), {
    status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSeconds), ...corsHeaders },
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://hubandup.org",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUsersRequest {
  userIds: string[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the user making the request is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autorisation manquante" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || userRole?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Accès interdit - Seuls les administrateurs peuvent supprimer des utilisateurs" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Rate limiting: 20 deletions per hour per admin
    const rateLimit = await checkRateLimit(supabaseAdmin, `delete-users:${user.id}`, {
      max: 20,
      windowSeconds: 3600, // 1 hour
    });

    if (rateLimit.exceeded) {
      return rateLimitResponse(rateLimit.retryAfterSeconds, corsHeaders);
    }

    // Parse request body
    const { userIds }: DeleteUsersRequest = await req.json();

    // Validate input
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Liste d'utilisateurs requise" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Delete users
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const userId of userIds) {
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          results.failed.push({ id: userId, error: deleteError.message });
        } else {
          results.success.push(userId);
        }
      } catch (error: any) {
        results.failed.push({ id: userId, error: error.message || "Erreur inconnue" });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${results.success.length} utilisateur(s) supprimé(s)`,
        results 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-users function:", error?.message);
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
