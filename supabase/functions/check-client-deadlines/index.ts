import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Checking for overdue client follow-ups...');

    // Get clients with overdue follow-up dates
    const { data: overdueClients, error: fetchError } = await supabaseClient
      .from('clients')
      .select('id, company, first_name, last_name, follow_up_date')
      .not('follow_up_date', 'is', null)
      .lt('follow_up_date', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching overdue clients:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${overdueClients?.length || 0} clients with overdue follow-ups`);

    // Get all admin and team users to notify
    const { data: usersToNotify, error: usersError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'team']);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Create notifications for each overdue client
    const notifications = [];
    for (const client of overdueClients || []) {
      for (const user of usersToNotify || []) {
        // Check if notification already exists (avoid duplicates)
        const { data: existingNotif } = await supabaseClient
          .from('notifications')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('type', 'deadline_overdue')
          .ilike('message', `%${client.company}%`)
          .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingNotif || existingNotif.length === 0) {
          notifications.push({
            user_id: user.user_id,
            type: 'deadline_overdue',
            title: 'Date de rappel dépassée',
            message: `Le rappel pour ${client.company} (${client.first_name} ${client.last_name}) est en retard`,
            link: `/client/${client.id}`,
          });
        }
      }
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error creating notifications:', insertError);
        throw insertError;
      }

      console.log(`Created ${notifications.length} notifications`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        overdueCount: overdueClients?.length || 0,
        notificationsCreated: notifications.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
