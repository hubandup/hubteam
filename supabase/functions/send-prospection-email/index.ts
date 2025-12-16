import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

// HTML escape function to prevent injection attacks
function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, message }: ProspectionEmailRequest = await req.json();

    // Validate input
    if (!message || typeof message !== "string" || message.length > 10000) {
      throw new Error("Invalid message: must be a string under 10000 characters");
    }
    if (!subject || typeof subject !== "string" || subject.length > 500) {
      throw new Error("Invalid subject: must be a string under 500 characters");
    }
    if (!Array.isArray(recipients) || recipients.length === 0 || recipients.length > 100) {
      throw new Error("Invalid recipients: must be an array with 1-100 recipients");
    }

    // Get user ID from authorization header
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
    }

    console.log(`Sending prospection emails to ${recipients.length} recipients`);

    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    // Send emails to all recipients using Brevo API
    const emailPromises = recipients.map(async (recipient) => {
      // Sanitize all user inputs before embedding in HTML
      const safeFirstName = escapeHtml(recipient.firstName);
      const safeLastName = escapeHtml(recipient.lastName);
      const safeCompany = escapeHtml(recipient.company);
      const safeMessage = escapeHtml(message);
      
      const personalizedMessage = safeMessage
        .replace(/\{prénom\}/g, safeFirstName)
        .replace(/\{nom\}/g, safeLastName)
        .replace(/\{société\}/g, safeCompany);

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
                Cet email a été envoyé depuis Hub Team
              </p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to send email to ${recipient.email}:`, error);
        
        // Log failed email
        await supabaseAdmin.from('prospection_email_logs').insert({
          user_id: userId,
          recipient_email: recipient.email,
          recipient_name: `${recipient.firstName} ${recipient.lastName}`,
          subject: subject,
          status: 'failed',
        });
        
        throw new Error(`Brevo API error: ${error}`);
      }

      // Log successful email
      await supabaseAdmin.from('prospection_email_logs').insert({
        user_id: userId,
        recipient_email: recipient.email,
        recipient_name: `${recipient.firstName} ${recipient.lastName}`,
        subject: subject,
        status: 'sent',
      });

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