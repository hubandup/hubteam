import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  type: string;
  record: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
  };
}

interface DirectNotificationPayload {
  userId: string;
  title: string;
  body: string;
  url?: string;
  badgeCount?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json() as NotificationPayload | DirectNotificationPayload;
    
    // Check if it's a database trigger payload or a direct API call
    let userId: string;
    let title: string;
    let message: string;
    let link: string | null;
    let badgeCount = 0;
    
    if ('type' in payload && 'record' in payload) {
      // Database trigger format
      const notification = payload.record;
      userId = notification.user_id;
      title = notification.title;
      message = notification.message;
      link = notification.link;
      
      // Get unread count for database trigger calls
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);
      
      badgeCount = count || 0;
    } else {
      // Direct API call format
      userId = payload.userId;
      title = payload.title;
      message = payload.body;
      link = payload.url || null;
      badgeCount = payload.badgeCount || 0;
    }

    console.log('Processing notification for push:', { userId, title, message, link, badgeCount });

    // Check if user has push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: subError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', userId, '- sending email instead');
      
      // Fallback to email notification
      try {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-notification-email',
          {
            body: {
              userId: userId,
              title: title,
              message: message,
              link: link || '/',
            },
          }
        );

        if (emailError) {
          console.error('Error sending email notification:', emailError);
          return new Response(
            JSON.stringify({ success: false, message: 'Failed to send email notification', error: emailError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log('Email notification sent successfully:', emailResult);
        return new Response(
          JSON.stringify({ success: true, message: 'Email notification sent', method: 'email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error: any) {
        console.error('Failed to send email notification:', error);
        return new Response(
          JSON.stringify({ success: false, message: 'No subscriptions and email failed', error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Call the send-push-notification function
    const { data: pushResult, error: pushError } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          userId: userId,
          title: title,
          body: message,
          url: link || '/',
          badgeCount: badgeCount,
        },
      }
    );

    if (pushError) {
      console.error('Error sending push notification:', pushError);
      return new Response(
        JSON.stringify({ error: pushError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Push notification sent successfully:', pushResult);

    return new Response(
      JSON.stringify({ success: true, result: pushResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-notification-push:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
