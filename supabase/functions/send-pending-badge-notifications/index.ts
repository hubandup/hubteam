import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── CRON_SECRET guard ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  const providedSecret = req.headers.get('x-cron-secret');
  if (cronSecret && providedSecret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting badge notification sync...');

    // Get all users with push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .order('user_id');

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(subscriptions.map(s => s.user_id))];
    console.log(`Found ${userIds.length} users with subscriptions`);

    let sentCount = 0;
    let errorCount = 0;

    // Process each user
    for (const userId of userIds) {
      try {
        // Get unread notification count
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false);

        const badgeCount = count || 0;

        // Only send if there are unread notifications
        if (badgeCount > 0) {
          console.log(`Sending badge update to user ${userId}: ${badgeCount} unread`);

          // Get user profile for personalization
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', userId)
            .single();

          const firstName = profile?.first_name || 'Utilisateur';

          // Send push notification
          const { error: pushError } = await supabase.functions.invoke(
            'send-push-notification',
            {
              body: {
                userId: userId,
                title: `${firstName}, vous avez ${badgeCount} notification(s)`,
                body: 'Consultez vos notifications pour rester à jour',
                url: '/feed',
                badgeCount: badgeCount,
              },
            }
          );

          if (pushError) {
            console.error(`Error sending to user ${userId}:`, pushError);
            errorCount++;
          } else {
            sentCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        errorCount++;
      }
    }

    console.log(`Badge notifications sync complete: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount,
        errors: errorCount,
        total: userIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-pending-badge-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
