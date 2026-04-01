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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Checking for pending agency notifications to send to clients...');

    // Get unsent agency notifications
    const { data: pendingAgencies, error: fetchError } = await supabase
      .from('pending_agency_notifications')
      .select('*')
      .eq('sent', false);

    if (fetchError) throw fetchError;

    if (!pendingAgencies || pendingAgencies.length === 0) {
      console.log('No pending agency notifications');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${pendingAgencies.length} pending agency notification(s)`);

    // Get all client users
    const { data: clientUsers, error: clientError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'client');

    if (clientError) throw clientError;

    if (!clientUsers || clientUsers.length === 0) {
      console.log('No client users to notify');
      // Mark as sent anyway
      for (const agency of pendingAgencies) {
        await supabase
          .from('pending_agency_notifications')
          .update({ sent: true })
          .eq('id', agency.id);
      }
      return new Response(
        JSON.stringify({ success: true, processed: 0, reason: 'no_clients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let notificationsSent = 0;

    for (const agency of pendingAgencies) {
      // Send notification to each client user
      for (const client of clientUsers) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: client.user_id,
            type: 'new_agency',
            title: 'Une nouvelle agence vient de rejoindre le collectif !',
            message: `Une nouvelle agence vient de rejoindre le collectif : découvrez leurs expertises en cliquant ici.`,
            link: `/agency/${agency.agency_id}`,
          });

        if (insertError) {
          console.error(`Failed to notify user ${client.user_id} about agency ${agency.agency_id}:`, insertError);
        } else {
          notificationsSent++;
        }
      }

      // Mark as sent
      await supabase
        .from('pending_agency_notifications')
        .update({ sent: true })
        .eq('id', agency.id);
    }

    console.log(`Sent ${notificationsSent} notifications for ${pendingAgencies.length} agencies`);

    return new Response(
      JSON.stringify({ success: true, agencies: pendingAgencies.length, notificationsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in notify-clients-new-agencies:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
