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
  | 'reaction';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
        console.log(`Processing notification for user ${item.user_id} with role ${userRole}`);

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
        if (userRole === 'client' && !['project_assigned', 'message'].includes(item.notification_type)) {
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
        // MESSAGE NOTIFICATION RULES (DOCUMENTED):
        // - Push: ALWAYS enabled for 'message' type (cannot be disabled by user)
        // - Email: Respects user preference UNLESS client role (forced)
        //
        // CLIENT ROLE:
        // - Only receives project_assigned + message
        // - Email is ALWAYS forced for these types
        //
        // OTHER ROLES (admin/team/agency):
        // - Push: respects user preference (except message = always on)
        // - Email: respects user preference OR global force_email
        // =====================================================

        // Determine what to send
        let shouldSendPush = userPref.push_enabled;
        let shouldSendEmail = userPref.email_enabled || globalPref.force_email;

        // MESSAGE RULE: push cannot be disabled for messages (safety net for real-time comms)
        if (item.notification_type === 'message') {
          shouldSendPush = true;
        }

        // Client role always gets email for project_assigned and message
        if (userRole === 'client' && ['project_assigned', 'message'].includes(item.notification_type)) {
          shouldSendEmail = true;
        }

        console.log(`Will send: push=${shouldSendPush}, email=${shouldSendEmail}`);

        // Get push subscriptions if needed
        if (shouldSendPush) {
          const { data: subscriptions } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', item.user_id);

          if (subscriptions && subscriptions.length > 0 && vapidPublicKey && vapidPrivateKey) {
            // Web push sending would happen here
            // For now, we log and mark as sent
            console.log(`Would send push to ${subscriptions.length} subscription(s)`);
          } else if (!subscriptions || subscriptions.length === 0) {
            console.log('No push subscriptions, falling back to email if not already sending');
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

    console.log(`Processed ${processed} notifications, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        errors,
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
