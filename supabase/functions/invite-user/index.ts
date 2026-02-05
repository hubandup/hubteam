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
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  role: 'admin' | 'team' | 'client' | 'agency';
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== Invite User Request Started ===");
  console.log("Method:", req.method);
  console.log("Origin:", req.headers.get("origin"));
  
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
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("ERROR: No authorization header found");
      return new Response(
        JSON.stringify({ 
          error: "Autorisation manquante",
          details: "Aucun header d'autorisation trouvé dans la requête"
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    console.log("Token extracted, length:", token.length);

    // Try to resolve the user using the Admin API, and fallback to decoding the verified JWT
    let userId: string | null = null;
    try {
      console.log("Attempting auth.getUser...");
      const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (userData?.user?.id) {
        userId = userData.user.id;
        console.log("User authenticated via auth.getUser:", userId);
      }
      if (authError) {
        console.log("auth.getUser failed, fallback to JWT decode:", authError.message);
      }
    } catch (e: any) {
      console.log("auth.getUser exception, fallback to JWT decode:", e?.message || e);
    }

    if (!userId) {
      try {
        console.log("Attempting JWT payload decode...");
        const payload = JSON.parse(atob(token.split(".")[1]));
        userId = payload?.sub || null;
        if (userId) {
          console.log("User extracted from JWT:", userId);
        }
      } catch (e) {
        console.error("JWT decode failed:", e);
      }
    }

    if (!userId) {
      console.error("ERROR: Could not extract user ID from token");
      return new Response(
        JSON.stringify({ 
          error: "Non autorisé",
          details: "Impossible d'extraire l'identifiant utilisateur du token d'authentification"
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user is admin
    console.log("Checking admin role for user:", userId);
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    console.log("User role query result:", { userRole, roleError });

    if (roleError) {
      console.error("ERROR: Role query failed:", roleError);
      return new Response(
        JSON.stringify({ 
          error: "Erreur de vérification des permissions",
          details: "Impossible de vérifier le rôle utilisateur: " + roleError.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (userRole?.role !== "admin") {
      console.error("ERROR: User is not admin. Role:", userRole?.role);
      return new Response(
        JSON.stringify({ 
          error: "Accès interdit",
          details: "Seuls les administrateurs peuvent inviter des utilisateurs. Votre rôle: " + (userRole?.role || "aucun")
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("✓ User is admin, proceeding with invitation");

    // Rate limiting: 10 invitations per hour per admin
    const rateLimit = await checkRateLimit(supabaseAdmin, `invite-user:${userId}`, {
      max: 10,
      windowSeconds: 3600, // 1 hour
    });

    if (rateLimit.exceeded) {
      console.log("Rate limit exceeded for user:", userId);
      return rateLimitResponse(rateLimit.retryAfterSeconds, corsHeaders);
    }

    // Parse request body
    const { email, role }: InviteUserRequest = await req.json();
    console.log("Invitation request for:", email, "with role:", role);

    // Validate input
    if (!email || !role) {
      console.error("ERROR: Missing email or role");
      return new Response(
        JSON.stringify({ 
          error: "Email et rôle requis",
          details: "Les champs email et rôle sont obligatoires"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const validRoles = ['admin', 'team', 'client', 'agency'];
    if (!validRoles.includes(role)) {
      console.error("ERROR: Invalid role:", role);
      return new Response(
        JSON.stringify({ 
          error: "Rôle invalide",
          details: "Le rôle doit être l'un des suivants: " + validRoles.join(", ")
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user already exists
    console.log("Checking if user already exists with email:", email);
    const { data: existingUsers, error: userCheckError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userCheckError) {
      console.error("ERROR: Failed to check existing users:", userCheckError);
      return new Response(
        JSON.stringify({ 
          error: "Erreur lors de la vérification de l'utilisateur",
          details: userCheckError.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const existingUser = existingUsers.users.find(u => u.email === email);
    
    // If user exists and has confirmed their email, they cannot be re-invited
    if (existingUser && existingUser.email_confirmed_at) {
      console.error("ERROR: User with this email already exists and is confirmed:", email);
      return new Response(
        JSON.stringify({ 
          error: "Utilisateur déjà actif",
          details: `Un utilisateur avec l'email ${email} a déjà activé son compte. Vous ne pouvez pas renvoyer d'invitation. Si vous souhaitez modifier son rôle, veuillez le faire depuis la gestion des utilisateurs.`
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // If user exists but hasn't confirmed their email, we'll delete and recreate
    if (existingUser && !existingUser.email_confirmed_at) {
      console.log("User exists but hasn't confirmed email, deleting old user:", email);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      
      if (deleteError) {
        console.error("ERROR: Failed to delete unconfirmed user:", deleteError);
        return new Response(
          JSON.stringify({ 
            error: "Erreur lors de la suppression de l'ancien utilisateur",
            details: deleteError.message
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      console.log("✓ Old unconfirmed user deleted, proceeding with new invitation");
    } else {
      console.log("✓ Email is available, proceeding with invitation");
    }

    // Generate invite link - redirects to set-password page
    // Use production URL for invitations to ensure consistency
    const productionUrl = 'https://hubandup.org';
    const redirectUrl = `${productionUrl}/auth/set-password`;
    console.log("Redirect URL:", redirectUrl);
    
    console.log("Generating invitation link...");
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: redirectUrl,
        data: {
          role: role,
        },
      },
    });

    if (inviteError) {
      console.error("ERROR: Failed to generate invite link:", inviteError);
      return new Response(
        JSON.stringify({ 
          error: "Échec de la génération du lien d'invitation",
          details: inviteError.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log('✓ Invite link generated successfully for:', inviteData.user?.email);

    // Send custom invitation email via Brevo
    console.log("Sending invitation email to:", email);
    const emailResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-invitation-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || '',
        },
        body: JSON.stringify({
          email: email,
          invitationUrl: inviteData.properties.action_link,
          role: role,
        }),
      }
    );

    if (!emailResponse.ok) {
      const emailError = await emailResponse.text();
      console.error('ERROR: Failed to send invitation email:', emailError);
      return new Response(
        JSON.stringify({ 
          error: 'Utilisateur créé mais échec de l\'envoi de l\'email d\'invitation',
          details: "L'invitation a été générée mais l'email n'a pas pu être envoyé. Vérifiez la configuration Brevo.",
          technicalDetails: emailError 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('✓ Invitation email sent successfully');

    // Note: Role is now automatically assigned by the handle_new_user() trigger
    // which reads the role from raw_user_meta_data

    console.log("=== Invitation completed successfully ===");
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation envoyée avec succès",
        user: inviteData.user 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in invite-user function:", error?.message);
    return new Response(
      JSON.stringify({ 
        error: "Erreur interne du serveur",
        details: "Une erreur inattendue s'est produite"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
