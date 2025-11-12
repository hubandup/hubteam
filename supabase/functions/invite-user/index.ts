import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // Generate invite link - redirects to set-password page
    // Use the request origin to build the correct frontend URL
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';
    const redirectUrl = `${origin}/auth/set-password`;
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
    console.error("=== CRITICAL ERROR in invite-user function ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    return new Response(
      JSON.stringify({ 
        error: "Erreur interne du serveur",
        details: error.message || "Une erreur inattendue s'est produite",
        type: error?.constructor?.name || "Unknown"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
