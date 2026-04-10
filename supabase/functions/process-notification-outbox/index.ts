import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notification types must match public.notification_type enum
type NotificationType = 
  | 'project_assigned'
  | 'task_assigned'
  | 'task_comment'
  | 'mention'
  | 'message'
  | 'deadline_approaching'
  | 'reaction'
  | 'account_created'
  | 'project_updated'
  | 'new_agency';

interface OutboxItem {
  id: string;
  notification_id: string;
  user_id: string;
  notification_type: NotificationType;
  payload: {
    title: string;
    message: string;
    link: string;
    entity_type?: string;
    entity_id?: string;
  };
  status: string;
  attempts: number;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface UserRole {
  role: 'admin' | 'team' | 'agency' | 'client';
}

interface GlobalPref {
  enabled: boolean;
  force_email: boolean;
}

interface UserPref {
  push_enabled: boolean;
  email_enabled: boolean;
}

// Helper function to send push notification using Web Push Protocol
async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    // For now, use the send-push-notification function which has web-push configured
    // This is a temporary solution until we can get web-push working in edge functions
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── CRON_SECRET guard (strict: x-cron-secret header only) ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Processing notification outbox...');

    // Fetch pending notifications (limit batch size for performance)
    const { data: pendingItems, error: fetchError } = await supabase
      .from('notification_outbox')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!pendingItems || pendingItems.length === 0) {
      console.log('No pending notifications to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${pendingItems.length} pending notifications`);

    let processed = 0;
    let errors = 0;
    let pushSent = 0;
    let emailSent = 0;

    for (const item of pendingItems as OutboxItem[]) {
      try {
        // Mark as processing
        await supabase
          .from('notification_outbox')
          .update({ status: 'processing', attempts: item.attempts + 1 })
          .eq('id', item.id);

        // Get user role
        const { data: userRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', item.user_id)
          .single();

        const userRole = (userRoleData as UserRole)?.role || 'team';
        console.log(`Processing notification ${item.id} for user ${item.user_id} with role ${userRole}`);

        // Get global preferences for this role and type
        const { data: globalPrefData } = await supabase
          .from('notification_preferences_global')
          .select('enabled, force_email')
          .eq('role', userRole)
          .eq('notification_type', item.notification_type)
          .single();

        const globalPref: GlobalPref = {
          enabled: globalPrefData?.enabled ?? true,
          force_email: globalPrefData?.force_email ?? false,
        };

        // Check if globally disabled
        if (!globalPref.enabled) {
          console.log(`Notification type ${item.notification_type} disabled for role ${userRole}`);
          await supabase
            .from('notification_outbox')
            .update({ status: 'sent', processed_at: new Date().toISOString() })
            .eq('id', item.id);
          processed++;
          continue;
        }

        // Client role restrictions
        if (userRole === 'client' && !['project_assigned', 'message', 'account_created', 'project_updated', 'new_agency'].includes(item.notification_type)) {
          console.log(`Client role cannot receive ${item.notification_type} notifications`);
          await supabase
            .from('notification_outbox')
            .update({ status: 'sent', processed_at: new Date().toISOString() })
            .eq('id', item.id);
          processed++;
          continue;
        }

        // Get user preferences
        const { data: userPrefData } = await supabase
          .from('notification_user_preferences')
          .select('push_enabled, email_enabled')
          .eq('user_id', item.user_id)
          .eq('notification_type', item.notification_type)
          .single();

        const userPref: UserPref = {
          push_enabled: userPrefData?.push_enabled ?? true,
          email_enabled: userPrefData?.email_enabled ?? false,
        };

        // =====================================================
        // NOTIFICATION RULES:
        // - Push: ALWAYS enabled for 'message' type (cannot be disabled)
        // - Email: Respects user preference UNLESS client role (forced)
        //
        // CLIENT ROLE:
        // - Only receives project_assigned + message
        // - Email is ALWAYS forced for these types
        // =====================================================

        let shouldSendPush = userPref.push_enabled;
        let shouldSendEmail = userPref.email_enabled || globalPref.force_email;

        // MESSAGE RULE: push cannot be disabled for messages
        if (item.notification_type === 'message') {
          shouldSendPush = true;
        }

        // Client role always gets email for project_assigned and message
        if (userRole === 'client' && ['project_assigned', 'message', 'account_created', 'project_updated', 'new_agency'].includes(item.notification_type)) {
          shouldSendEmail = true;
        }

        console.log(`Will send: push=${shouldSendPush}, email=${shouldSendEmail}`);

        // Send push notifications via dedicated function
        if (shouldSendPush) {
          const { data: subscriptions } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', item.user_id);

          if (subscriptions && subscriptions.length > 0 && vapidPublicKey && vapidPrivateKey) {
            console.log(`Found ${subscriptions.length} push subscription(s) for user`);
            
            // Call the dedicated push function
            try {
              const { error: pushError } = await supabase.functions.invoke(
                'send-push-notification',
                {
                  body: {
                    userId: item.user_id,
                    title: item.payload.title,
                    body: item.payload.message,
                    url: item.payload.link || '/',
                  },
                }
              );
              
              if (pushError) {
                console.error('Push function error:', pushError);
              } else {
                console.log('Push notification sent via dedicated function');
                pushSent++;
              }
            } catch (pushErr) {
              console.error('Failed to invoke push function:', pushErr);
            }
          } else if (!subscriptions || subscriptions.length === 0) {
            console.log('No push subscriptions found, will fallback to email if not already sending');
            if (!shouldSendEmail && !globalPref.force_email) {
              shouldSendEmail = true;
            }
          }
        }

        // Send email if needed
        if (shouldSendEmail) {
          try {
            const { error: emailError } = await supabase.functions.invoke(
              'send-notification-email',
              {
                body: {
                  userId: item.user_id,
                  title: item.payload.title,
                  message: item.payload.message,
                  link: item.payload.link || '/',
                  forceEmail: globalPref.force_email || userRole === 'client',
                },
              }
            );

            if (emailError) {
              console.error('Email sending error:', emailError);
            } else {
              console.log('Email sent successfully');
              emailSent++;
            }
          } catch (emailErr) {
            console.error('Failed to invoke email function:', emailErr);
          }
        }

        // Mark as sent
        await supabase
          .from('notification_outbox')
          .update({ status: 'sent', processed_at: new Date().toISOString() })
          .eq('id', item.id);

        processed++;
      } catch (itemError: any) {
        console.error(`Error processing item ${item.id}:`, itemError);
        
        // Mark as failed after 3 attempts
        const newStatus = item.attempts >= 2 ? 'failed' : 'pending';
        await supabase
          .from('notification_outbox')
          .update({ 
            status: newStatus, 
            error: itemError.message,
            processed_at: newStatus === 'failed' ? new Date().toISOString() : null
          })
          .eq('id', item.id);
        
        errors++;
      }
    }

    console.log(`Processed ${processed} notifications, ${errors} errors, ${pushSent} push sent, ${emailSent} email sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        errors,
        pushSent,
        emailSent,
        total: pendingItems.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in process-notification-outbox:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
