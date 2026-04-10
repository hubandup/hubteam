import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── CRON_SECRET guard (strict: x-cron-secret header only) ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  const xCronHeader = req.headers.get('x-cron-secret');
  console.log('[GUARD] env first10:', cronSecret?.substring(0,10));
  console.log('[GUARD] hdr first10:', xCronHeader?.substring(0,10));
  console.log('[GUARD] match:', xCronHeader === cronSecret);
  if (!cronSecret || xCronHeader !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    console.log('Checking for upcoming deadlines...');

    // Call the notify_upcoming_deadlines function
    const { error } = await supabaseClient.rpc('notify_upcoming_deadlines');

    if (error) {
      console.error('Error checking deadlines:', error);
      throw error;
    }

    console.log('Successfully checked deadlines');

    return new Response(
      JSON.stringify({ success: true, message: 'Deadlines checked successfully' }),
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