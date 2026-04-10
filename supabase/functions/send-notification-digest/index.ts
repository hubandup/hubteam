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
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization') || '';
    const providedSecret = req.headers.get('x-cron-secret') || '';
    const bearerToken = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isAllowed = providedSecret === cronSecret
      || bearerToken === cronSecret
      || bearerToken === serviceKey
      || bearerToken === anonKey;
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }


  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting notification digest job...');

    // Get cutoff time (6 hours ago)
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    const cutoffTime = sixHoursAgo.toISOString();

    console.log('Cutoff time for digest:', cutoffTime);

    // Get all users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name');

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Processing ${profiles.length} users`);

    let emailsSent = 0;
    let usersWithNotifications = 0;

    for (const profile of profiles) {
      // Get unread notifications for this user from the last 6 hours
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('read', false)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false });

      if (notifError) {
        console.error(`Error fetching notifications for user ${profile.id}:`, notifError);
        continue;
      }

      // Skip if no notifications
      if (!notifications || notifications.length === 0) {
        continue;
      }

      usersWithNotifications++;

      // Check user notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      // Build notifications array for template
      const notificationsList = notifications.map(notif => ({
        title: notif.title,
        message: notif.message,
        link: notif.link || '/',
        type: notif.type,
        time: new Date(notif.created_at).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      }));

      console.log(`Sending digest to ${profile.email} with ${notifications.length} notifications`);

      // Send digest email via Brevo
      // Template ID 51 configured in Brevo for notification digest
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
          to: [{
            email: profile.email,
            name: `${profile.first_name} ${profile.last_name}`,
          }],
          templateId: 51,
          params: {
            userName: profile.first_name,
            notificationCount: notifications.length,
            notifications: notificationsList,
            appUrl: 'https://hubandup.org',
          },
        }),
      });

      if (!brevoResponse.ok) {
        const errorText = await brevoResponse.text();
        console.error(`Failed to send digest to ${profile.email}:`, errorText);
        continue;
      }

      emailsSent++;
      console.log(`Digest sent successfully to ${profile.email}`);
    }

    console.log(`Digest job completed: ${emailsSent} emails sent to ${usersWithNotifications} users with notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        usersWithNotifications,
        totalUsers: profiles.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-notification-digest:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
