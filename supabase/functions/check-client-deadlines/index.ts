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

    console.log('Checking for client follow-ups...');

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get clients with follow-up dates that are overdue or approaching (within 24h)
    const { data: clientsToCheck, error: fetchError } = await supabaseClient
      .from('clients')
      .select('id, company, first_name, last_name, follow_up_date')
      .not('follow_up_date', 'is', null)
      .lt('follow_up_date', tomorrow.toISOString());

    if (fetchError) {
      console.error('Error fetching clients:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${clientsToCheck?.length || 0} clients with follow-ups to check`);

    // Separate overdue and approaching clients
    const overdueClients = clientsToCheck?.filter(c => new Date(c.follow_up_date!) < now) || [];
    const approachingClients = clientsToCheck?.filter(c => {
      const followUpDate = new Date(c.follow_up_date!);
      return followUpDate >= now && followUpDate <= tomorrow;
    }) || [];

    console.log(`- ${overdueClients.length} overdue`);
    console.log(`- ${approachingClients.length} approaching (within 24h)`);

    // Get all admin and team users to notify
    const { data: usersToNotify, error: usersError } = await supabaseClient
      .from('user_roles')
      .select('user_id, profiles!inner(id, first_name, last_name)')
      .in('role', ['admin', 'team']);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Create notifications for overdue and approaching clients
    const notifications = [];
    
    // Process overdue clients
    for (const client of overdueClients) {
      for (const user of usersToNotify || []) {
        // Check user preferences
        const { data: prefs } = await supabaseClient
          .from('notification_preferences')
          .select('deadline_approaching')
          .eq('user_id', user.user_id)
          .single();

        if (prefs?.deadline_approaching === false) continue;

        // Check if notification already exists (avoid duplicates within 12h)
        const { data: existingNotif } = await supabaseClient
          .from('notifications')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('type', 'deadline_overdue')
          .ilike('message', `%${client.company}%`)
          .gt('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingNotif || existingNotif.length === 0) {
          notifications.push({
            user_id: user.user_id,
            type: 'deadline_overdue',
            title: 'Prochaine échéance dépassée',
            message: `L'échéance pour ${client.company} (${client.first_name} ${client.last_name}) est dépassée`,
            link: `/client/${client.id}`,
          });
        }
      }
    }

    // Process approaching clients (within 24h)
    for (const client of approachingClients) {
      for (const user of usersToNotify || []) {
        // Check user preferences
        const { data: prefs } = await supabaseClient
          .from('notification_preferences')
          .select('deadline_approaching')
          .eq('user_id', user.user_id)
          .single();

        if (prefs?.deadline_approaching === false) continue;

        // Check if notification already exists (avoid duplicates within 12h)
        const { data: existingNotif } = await supabaseClient
          .from('notifications')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('type', 'deadline_approaching')
          .ilike('message', `%${client.company}%`)
          .gt('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingNotif || existingNotif.length === 0) {
          notifications.push({
            user_id: user.user_id,
            type: 'deadline_approaching',
            title: 'Prochaine échéance approchante',
            message: `L'échéance pour ${client.company} (${client.first_name} ${client.last_name}) est prévue dans moins de 24h`,
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
        overdueCount: overdueClients.length,
        approachingCount: approachingClients.length,
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
