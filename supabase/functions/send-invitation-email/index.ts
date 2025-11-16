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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Send Invitation Email Request Started ===");
    
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("❌ BREVO_API_KEY is not configured");
      throw new Error("BREVO_API_KEY is not configured");
    }
    console.log("✓ Brevo API key found");

    const { email, invitationUrl, role }: InvitationEmailRequest = await req.json();

    console.log("📧 Email parameters:", {
      recipient: email,
      role: role,
      invitationUrl: invitationUrl,
      urlLength: invitationUrl?.length || 0
    });

    // Brevo template ID - configure this in your Brevo dashboard
    // Create a template with variables: {{role}}, {{invitationUrl}}
    const envTemplateId = Deno.env.get("BREVO_TEMPLATE_ID");
    const BREVO_TEMPLATE_ID = Number(envTemplateId) || 47; // Brevo template ID for invitation emails
    console.log(`📋 Using Brevo template ID: ${BREVO_TEMPLATE_ID} (source: ${envTemplateId ? 'env' : 'default'})`);

    const emailPayload = {
      sender: {
        name: "Hub & Up",
        email: "orga@hubandup.com",
      },
      to: [
        {
          email: email,
        },
      ],
      templateId: BREVO_TEMPLATE_ID,
      params: {
        role: role,
        invitationUrl: invitationUrl,
      },
    };

    console.log("📤 Sending request to Brevo API with payload:", JSON.stringify(emailPayload, null, 2));

    // Send email via Brevo API using template
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    console.log("📥 Brevo API response status:", brevoResponse.status, brevoResponse.statusText);

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error("❌ Brevo API error response:", {
        status: brevoResponse.status,
        statusText: brevoResponse.statusText,
        body: errorText
      });
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await brevoResponse.json();
    console.log("✓ Email sent successfully:", {
      messageId: result.messageId,
      fullResponse: JSON.stringify(result, null, 2)
    });

    console.log("=== Send Invitation Email Request Completed ===");

    return new Response(JSON.stringify({ success: true, messageId: result.messageId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error in send-invitation-email function:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
