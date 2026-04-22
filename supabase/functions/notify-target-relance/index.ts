import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  client_id: string;
  tracking_id?: string;
  company: string;
  contact_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
    const SLACK_CHANNEL = '#hubteam_sales';
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller (admin or team only)
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const callerId = userData.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .maybeSingle();
    if (!roleRow || !['admin', 'team'].includes(roleRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const body = (await req.json()) as Payload;
    if (!body.client_id || !body.company) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }

    const message = `🎯 *Target à relancer* : *${body.company}*${body.contact_name ? ` (${body.contact_name})` : ''}\nLa fiche vient de passer en statut « À relancer ». Pensez à organiser une action de courtoisie cette semaine.`;

    let slackOk = false;
    let slackError: string | null = null;
    if (SLACK_BOT_TOKEN) {
      try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({ channel: SLACK_CHANNEL, text: message }),
        });
        const json = await res.json();
        slackOk = !!json.ok;
        if (!json.ok) slackError = json.error || 'slack_failed';
      } catch (e) {
        slackError = (e as Error).message;
      }
    } else {
      slackError = 'SLACK_BOT_TOKEN not configured';
    }

    // Email team (admin + team users) via Brevo
    let emailOk = false;
    let emailError: string | null = null;
    let recipientsCount = 0;
    if (BREVO_API_KEY) {
      try {
        const { data: teamUsers } = await admin
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'team']);
        const userIds = (teamUsers || []).map((u: any) => u.user_id);
        const { data: profiles } = await admin
          .from('profiles')
          .select('email, first_name')
          .in('id', userIds);
        const recipients = (profiles || []).filter((p: any) => p.email);
        recipientsCount = recipients.length;

        if (recipients.length > 0) {
          const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              sender: { name: 'Hub Team', email: 'noreply@hubandup.org' },
              to: recipients.map((r: any) => ({ email: r.email, name: r.first_name || '' })),
              subject: `🎯 Target à relancer : ${body.company}`,
              htmlContent: `<p>Bonjour,</p><p>La fiche <strong>${body.company}</strong>${body.contact_name ? ` (${body.contact_name})` : ''} vient de passer en statut « À relancer ».</p><p>Pensez à organiser une action de courtoisie cette semaine.</p>`,
            }),
          });
          emailOk = res.ok;
          if (!res.ok) emailError = `brevo_status_${res.status}`;
        }
      } catch (e) {
        emailError = (e as Error).message;
      }
    } else {
      emailError = 'BREVO_API_KEY not configured';
    }

    const channel = slackOk && emailOk ? 'both' : slackOk ? 'slack' : emailOk ? 'email' : 'both';
    const status = slackOk || emailOk ? 'sent' : 'failed';
    const errorMessage = [slackError, emailError].filter(Boolean).join(' | ') || null;

    await admin.from('target_relance_notifications').insert({
      client_id: body.client_id,
      tracking_id: body.tracking_id || null,
      channel,
      status,
      error_message: status === 'failed' ? errorMessage : null,
      triggered_by: callerId,
      recipients_count: recipientsCount,
      metadata: { company: body.company, contact_name: body.contact_name },
    });

    return new Response(
      JSON.stringify({ success: status === 'sent', slackOk, emailOk, recipientsCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('notify-target-relance error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
