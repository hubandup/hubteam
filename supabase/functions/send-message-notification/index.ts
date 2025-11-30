import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MessageNotificationRequest {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  roomId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const { recipientEmail, recipientName, senderName, messagePreview, roomId }: MessageNotificationRequest = await req.json();

    console.log("Sending message notification to:", recipientEmail, "from:", senderName);

    const messagesUrl = `${Deno.env.get('VITE_SUPABASE_URL')?.replace('supabase.co', 'lovable.app') || ''}/messages`;

    // Send email via Brevo API using template
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Hub & Up",
          email: "orga@hubandup.com",
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        templateId: 48,
        params: {
          senderName: senderName,
          recipientName: recipientName,
          messagePreview: messagePreview,
          messagesUrl: messagesUrl,
        },
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error("Brevo API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await brevoResponse.json();
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, messageId: result.messageId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending message notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
