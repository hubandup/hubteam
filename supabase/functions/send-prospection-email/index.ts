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

// Find or create a prospect by email
async function findOrCreateProspect(
  email: string,
  firstName: string,
  lastName: string,
  company: string,
  userId: string | null
): Promise<string | null> {
  try {
    // First, try to find existing prospect by email
    const { data: existingProspect, error: findError } = await supabaseAdmin
      .from('prospects')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (findError) {
      console.error(`Error finding prospect for ${email}:`, findError);
      return null;
    }

    if (existingProspect) {
      console.log(`Found existing prospect for ${email}: ${existingProspect.id}`);
      return existingProspect.id;
    }

    // Create new prospect
    const { data: newProspect, error: createError } = await supabaseAdmin
      .from('prospects')
      .insert({
        email: email,
        contact_name: `${firstName} ${lastName}`.trim() || 'N/A',
        company_name: company || 'N/A',
        channel: 'Email',
        status: 'Contacté',
        priority: 'B',
        owner_id: userId,
        last_contact_at: new Date().toISOString().split('T')[0],
        last_action: 'Email de prospection',
      })
      .select('id')
      .single();

    if (createError) {
      console.error(`Error creating prospect for ${email}:`, createError);
      return null;
    }

    console.log(`Created new prospect for ${email}: ${newProspect.id}`);
    return newProspect.id;
  } catch (error) {
    console.error(`Exception in findOrCreateProspect for ${email}:`, error);
    return null;
  }
}

// Create a CRM interaction for the email
async function createEmailInteraction(
  prospectId: string,
  subject: string,
  userId: string | null
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('interactions')
      .insert({
        prospect_id: prospectId,
        action_type: 'Email',
        channel: 'Email',
        subject: subject,
        content: `Email de prospection envoyé`,
        outcome: 'Email envoyé avec succès',
        happened_at: new Date().toISOString(),
        created_by: userId,
      });

    if (error) {
      console.error(`Error creating interaction for prospect ${prospectId}:`, error);
    } else {
      console.log(`Created email interaction for prospect ${prospectId}`);
    }
  } catch (error) {
    console.error(`Exception in createEmailInteraction for ${prospectId}:`, error);
  }
}

// Update prospect's last contact info
async function updateProspectLastContact(
  prospectId: string,
  subject: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('prospects')
      .update({
        last_contact_at: new Date().toISOString().split('T')[0],
        last_action: `Email: ${subject.substring(0, 100)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospectId);

    if (error) {
      console.error(`Error updating prospect ${prospectId}:`, error);
    } else {
      console.log(`Updated last contact for prospect ${prospectId}`);
    }
  } catch (error) {
    console.error(`Exception in updateProspectLastContact for ${prospectId}:`, error);
  }
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
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id || null;
    }

    console.log(`Sending prospection emails to ${recipients.length} recipients (user: ${userId})`);

    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    // Send emails to all recipients using Brevo API
    const emailPromises = recipients.map(async (recipient) => {
      // Sanitize name inputs but NOT the message (to preserve HTML for images)
      const safeFirstName = escapeHtml(recipient.firstName);
      const safeLastName = escapeHtml(recipient.lastName);
      const safeCompany = escapeHtml(recipient.company);
      
      // Process message - convert image placeholders to HTML img tags
      let processedMessage = message
        .replace(/\{prénom\}/g, safeFirstName)
        .replace(/\{nom\}/g, safeLastName)
        .replace(/\{société\}/g, safeCompany);
      
      // Convert [Image: URL] format to actual img tags
      processedMessage = processedMessage.replace(
        /\[Image:\s*(https?:\/\/[^\]]+)\]/g,
        '<img src="$1" alt="Image" style="max-width: 100%; height: auto; margin: 10px 0; display: block;" />'
      );
      
      // Convert newlines to <br> for HTML display
      processedMessage = processedMessage.replace(/\n/g, '<br />');

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
            name: `${recipient.firstName} ${recipient.lastName}`.trim() || recipient.company || recipient.email,
          }],
          subject: subject,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div>${processedMessage}</div>
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

      // Log successful email to prospection_email_logs (existing behavior)
      await supabaseAdmin.from('prospection_email_logs').insert({
        user_id: userId,
        recipient_email: recipient.email,
        recipient_name: `${recipient.firstName} ${recipient.lastName}`,
        subject: subject,
        status: 'sent',
      });

      // NEW: CRM Integration - Find or create prospect and log interaction
      const prospectId = await findOrCreateProspect(
        recipient.email,
        recipient.firstName,
        recipient.lastName,
        recipient.company,
        userId
      );

      if (prospectId) {
        // Create email interaction in CRM
        await createEmailInteraction(prospectId, subject, userId);
        // Update prospect's last contact info
        await updateProspectLastContact(prospectId, subject);
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
