import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationEmailRequest {
  userId: string;
  title: string;
  message: string;
  link?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, title, message, link } = await req.json() as NotificationEmailRequest;

    console.log('Sending notification email to user:', userId);

    // Get user's email and name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const userName = `${profile.first_name} ${profile.last_name}`.trim() || 'Utilisateur';
    const appUrl = link ? `${supabaseUrl.replace('.supabase.co', '')}${link}` : '';

    // Send email via Brevo using template
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Hub & Up',
          email: 'orga@hubandup.com',
        },
        to: [
          {
            email: profile.email,
            name: userName,
          },
        ],
        templateId: 49,
        params: {
          userName: userName,
          title: title,
          message: message,
          appUrl: appUrl,
          hasLink: !!link,
        },
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Brevo API error:', errorText);
      throw new Error(`Brevo API error: ${brevoResponse.status}`);
    }

    const result = await brevoResponse.json();
    console.log('Email sent successfully:', result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-notification-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

serve(handler);
