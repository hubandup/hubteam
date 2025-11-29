import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  invitationUrl: string;
  role: string;
}

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    admin: "Administrateur",
    team: "Membre de l'équipe",
    client: "Client",
    agency: "Agence",
  };
  return labels[role] || role;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Send Invitation Email via Brevo ===");
    
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("❌ BREVO_API_KEY not configured");
      throw new Error("BREVO_API_KEY not configured");
    }

    const { email, invitationUrl, role }: InvitationEmailRequest = await req.json();
    console.log(`📧 Sending invitation to: ${email} (${role})`);

    const roleLabel = getRoleLabel(role);
    
    // Utiliser le template Brevo ID 47
    const emailPayload = {
      sender: {
        name: "Hub Team",
        email: "orga@hubandup.com",
      },
      to: [{ email }],
      templateId: 47,
      params: {
        role: roleLabel,
        invitationUrl: invitationUrl,
      },
    };

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error("❌ Brevo error:", brevoResponse.status, errorText);
      throw new Error(`Brevo API error: ${errorText}`);
    }

    const result = await brevoResponse.json();
    console.log("✅ Email sent successfully via Brevo:", result.messageId);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
