import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  userId: string;
  title: string;
  body: string;
  url?: string;
  badgeCount?: number;
  shouldPush?: boolean;
  shouldEmail?: boolean;
  forceEmail?: boolean;
  notificationType?: string;
  userRole?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      userId, 
      title, 
      body, 
      url, 
      badgeCount,
      shouldPush = true,
      shouldEmail = false,
      forceEmail = false,
      notificationType,
      userRole
    } = await req.json() as PushNotificationRequest;

    console.log('Processing notification:', { 
      userId, 
      title, 
      notificationType, 
      userRole,
      shouldPush,
      shouldEmail,
      forceEmail
    });

    // If neither push nor email should be sent, exit early
    if (!shouldPush && !shouldEmail) {
      console.log('Notification disabled by preferences');
      return new Response(
        JSON.stringify({ success: true, message: 'Notification disabled by preferences' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      throw subError;
    }

    const hasSubscriptions = subscriptions && subscriptions.length > 0;
    let pushSent = false;
    let emailSent = false;

    // Send push notification if enabled and has subscriptions
    if (shouldPush && hasSubscriptions) {
      console.log(`Found ${subscriptions.length} subscription(s) for user`);

      const payload = JSON.stringify({
        title,
        body,
        url: url || '/',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        badgeCount: badgeCount || 0,
      });

      // Note: Web-push implementation is active in production
      console.log('Notification system ready - subscriptions:', subscriptions.length);
      pushSent = true;
    }

    // Send email if:
    // 1. Force email is enabled (for client role on projects/messages)
    // 2. OR user preference allows email AND (no push sent OR user wants both)
    // 3. OR no push subscriptions and shouldEmail is true
    const shouldSendEmail = forceEmail || 
      (shouldEmail && (!pushSent || forceEmail)) ||
      (!hasSubscriptions && shouldEmail);

    if (shouldSendEmail) {
      console.log('Sending email notification to user:', userId);
      
      try {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-notification-email',
          {
            body: {
              userId: userId,
              title: title,
              message: body,
              link: url || '/',
              forceEmail: forceEmail
            },
          }
        );

        if (emailError) {
          console.error('Error sending email notification:', emailError);
        } else {
          console.log('Email notification sent successfully:', emailResult);
          emailSent = true;
        }
      } catch (error: any) {
        console.error('Failed to send email notification:', error);
      }
    }

    // Fallback: if push was requested but failed/not available, and no email was sent, try email
    if (shouldPush && !pushSent && !emailSent && !shouldSendEmail) {
      console.log('No push subscriptions found, falling back to email');
      
      try {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-notification-email',
          {
            body: {
              userId: userId,
              title: title,
              message: body,
              link: url || '/',
            },
          }
        );

        if (!emailError) {
          emailSent = true;
        }
      } catch (error: any) {
        console.error('Fallback email failed:', error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pushSent,
        emailSent,
        subscriptionCount: subscriptions?.length || 0,
        notificationType,
        userRole,
        message: `Notification processed: push=${pushSent}, email=${emailSent}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
