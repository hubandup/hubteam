import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Verify the user making the request is authenticated and an admin
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autorisation manquante" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");

    // Get user from token
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !userData?.user) {
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
      .eq("user_id", userData.user.id)
      .single();

    if (roleError || userRole?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Accès interdit - Admin uniquement" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get all users with auth data
    const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      throw usersError;
    }

    // Get profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, display_name, created_at");

    if (profilesError) throw profilesError;

    // Get roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) throw rolesError;

    // Combine all data
    const usersWithStatus = profiles.map(profile => {
      const authUser = authUsers.users.find(u => u.id === profile.id);
      const userRole = roles.find(r => r.user_id === profile.id);
      
      return {
        ...profile,
        role: userRole?.role || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        // User is confirmed only if they have signed in at least once (meaning they set their password)
        confirmed: !!authUser?.last_sign_in_at,
      };
    });

    return new Response(
      JSON.stringify({ users: usersWithStatus }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in list-users-with-status:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur interne du serveur" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
