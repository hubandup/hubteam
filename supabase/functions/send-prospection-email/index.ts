import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
}

interface ProspectionEmailRequest {
  recipients: Recipient[];
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, message }: ProspectionEmailRequest = await req.json();

    console.log(`Sending prospection emails to ${recipients.length} recipients`);

    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    // Send emails to all recipients using Brevo API
    const emailPromises = recipients.map(async (recipient) => {
      const personalizedMessage = message
        .replace(/\{prénom\}/g, recipient.firstName)
        .replace(/\{nom\}/g, recipient.lastName)
        .replace(/\{société\}/g, recipient.company);

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Hub & Up",
            email: "noreply@hubandup.com",
          },
          to: [{
            email: recipient.email,
            name: `${recipient.firstName} ${recipient.lastName}`,
          }],
          subject: subject,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="white-space: pre-wrap;">${personalizedMessage}</div>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
              <p style="color: #666; font-size: 12px;">
                Cet email a été envoyé depuis Hub & Up
              </p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Brevo API error: ${error}`);
      }

      return response.json();
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Emails sent: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: successCount,
        failed: failureCount 
      }), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-prospection-email function:", error);
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