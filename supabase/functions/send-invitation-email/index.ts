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
    
    // Email HTML avec styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="color: #333333; font-size: 24px; margin: 0 0 20px 0;">Invitation à rejoindre Hub Team</h1>
                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                        Vous avez été invité à rejoindre Hub Team en tant que <strong>${roleLabel}</strong>.
                      </p>
                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                        Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte :
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${invitationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 25px; font-size: 16px; font-weight: bold;">
                              Accepter l'invitation
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="color: #999999; font-size: 14px; line-height: 20px; margin: 30px 0 0 0;">
                        Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                        <a href="${invitationUrl}" style="color: #007bff; word-break: break-all;">${invitationUrl}</a>
                      </p>
                      <p style="color: #999999; font-size: 14px; line-height: 20px; margin: 20px 0 0 0;">
                        Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
                      <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
                        © 2025 Hub & Up. Tous droits réservés.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const emailPayload = {
      sender: {
        name: "Hub & Up",
        email: "orga@hubandup.com",
      },
      to: [{ email }],
      subject: "Invitation à rejoindre Hub Team",
      htmlContent,
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
