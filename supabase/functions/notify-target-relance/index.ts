import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventType =
  | 'status_to_followup' // automatic on status -> to_followup
  | 'manual'             // user clicked "Notify team"
  | 'note_added'
  | 'meeting_scheduled'
  | 'status_change';     // any other status change

interface Payload {
  client_id: string;
  tracking_id?: string;
  company: string;
  contact_name?: string;
  expected_previous_status?: string;
  event_type?: EventType;
  custom_message?: string;
  details?: Record<string, unknown>;
}

const EVENT_LABELS: Record<EventType, string> = {
  status_to_followup: '🎯 Target à relancer',
  manual: '📣 Notification équipe',
  note_added: '📝 Nouvelle note',
  meeting_scheduled: '📅 RDV planifié',
  status_change: '🔄 Statut mis à jour',
};

function buildMessage(eventType: EventType, body: Payload): string {
  const who = `*${body.company}*${body.contact_name ? ` (${body.contact_name})` : ''}`;
  if (body.custom_message) return `${EVENT_LABELS[eventType]} — ${who}\n${body.custom_message}`;
  switch (eventType) {
    case 'status_to_followup':
      return `🎯 *Target à relancer* : ${who}\nLa fiche vient de passer en statut « À relancer ». Pensez à organiser une action de courtoisie cette semaine.`;
    case 'note_added': {
      const preview = String(body.details?.note_preview || '').slice(0, 200);
      return `📝 *Nouvelle note ajoutée* sur ${who}${preview ? `\n> ${preview}${preview.length === 200 ? '…' : ''}` : ''}`;
    }
    case 'meeting_scheduled': {
      const label = body.details?.meeting_label || 'RDV';
      const date = body.details?.meeting_date ? new Date(String(body.details.meeting_date)).toLocaleString('fr-FR') : '';
      return `📅 *${label} planifié* avec ${who}${date ? `\n🕒 ${date}` : ''}`;
    }
    case 'status_change': {
      const newStatus = body.details?.new_status_label || body.details?.new_status || '';
      return `🔄 *Statut mis à jour* sur ${who}${newStatus ? ` → *${newStatus}*` : ''}`;
    }
    case 'manual':
      return `📣 *Notification* sur ${who}\n${body.custom_message || 'Action requise'}`;
  }
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
    const eventType: EventType = body.event_type || 'status_to_followup';

    if (!body.client_id || !body.company) {
      return new Response(JSON.stringify({ error: 'Missing fields (client_id, company required)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side state-change detection ONLY for status_to_followup
    if (eventType === 'status_to_followup') {
      if (!body.tracking_id) {
        return new Response(JSON.stringify({ error: 'tracking_id required for status_to_followup' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: trackingRow } = await admin
        .from('commercial_tracking')
        .select('id, status, updated_at')
        .eq('id', body.tracking_id)
        .maybeSingle();

      if (!trackingRow) {
        return new Response(JSON.stringify({ error: 'Tracking not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (trackingRow.status !== 'to_followup') {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'status not to_followup' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: lastNotif } = await admin
        .from('target_relance_notifications')
        .select('id, created_at, status')
        .eq('tracking_id', body.tracking_id)
        .eq('event_type', 'status_to_followup')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastNotif?.status === 'sent' && new Date(trackingRow.updated_at) <= new Date(lastNotif.created_at)) {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'no status change since last notification' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const message = buildMessage(eventType, body);

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

    // Email — only for status_to_followup and manual events (avoid spamming)
    let emailOk = false;
    let emailError: string | null = null;
    let recipientsCount = 0;
    const shouldEmail = eventType === 'status_to_followup' || eventType === 'manual';
    if (shouldEmail && BREVO_API_KEY) {
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
          const subject = `${EVENT_LABELS[eventType]} : ${body.company}`;
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
              subject,
              htmlContent: `<p>${message.replace(/\n/g, '<br>')}</p>`,
            }),
          });
          emailOk = res.ok;
          if (!res.ok) emailError = `brevo_status_${res.status}`;
        }
      } catch (e) {
        emailError = (e as Error).message;
      }
    } else if (shouldEmail) {
      emailError = 'BREVO_API_KEY not configured';
    }

    const channel = shouldEmail
      ? (slackOk && emailOk ? 'both' : slackOk ? 'slack' : emailOk ? 'email' : 'both')
      : 'slack';
    const status = slackOk || emailOk ? 'sent' : 'failed';
    const errorMessage = [slackError, emailError].filter(Boolean).join(' | ') || null;

    await admin.from('target_relance_notifications').insert({
      client_id: body.client_id,
      tracking_id: body.tracking_id || null,
      channel,
      status,
      event_type: eventType,
      error_message: status === 'failed' ? errorMessage : null,
      triggered_by: callerId,
      recipients_count: recipientsCount,
      metadata: { company: body.company, contact_name: body.contact_name, ...(body.details || {}) },
    });

    return new Response(
      JSON.stringify({ success: status === 'sent', slackOk, emailOk, recipientsCount, eventType }),
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
