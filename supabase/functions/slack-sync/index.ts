import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SLACK_CHANNEL_ID = Deno.env.get("SLACK_CHANNEL_ID");

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PostToSlackRequest {
  action: "post_to_slack";
  content: string;
  author_name: string;
  post_id: string;
}

interface SlackEventRequest {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    text: string;
    user: string;
    channel: string;
    ts: string;
    bot_id?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Slack sync request received:", JSON.stringify(body));

    // Handle Slack URL verification challenge
    if (body.type === "url_verification") {
      console.log("Slack URL verification challenge");
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Handle incoming Slack events (messages from Slack to Feed)
    if (body.event) {
      return await handleSlackEvent(body as SlackEventRequest);
    }

    // Handle outgoing posts (Feed to Slack)
    if (body.action === "post_to_slack") {
      return await postToSlack(body as PostToSlackRequest);
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Slack sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function postToSlack(request: PostToSlackRequest): Promise<Response> {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) {
    console.error("Missing Slack configuration");
    throw new Error("Slack configuration not complete");
  }

  console.log(`Posting to Slack channel ${SLACK_CHANNEL_ID}: ${request.content.substring(0, 50)}...`);

  const slackMessage = {
    channel: SLACK_CHANNEL_ID,
    text: `*${request.author_name}* a publié sur le Feed Hub & Up:\n\n${request.content}`,
    unfurl_links: true,
  };

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(slackMessage),
  });

  const result = await response.json();
  
  if (!result.ok) {
    console.error("Slack API error:", result.error);
    throw new Error(`Slack API error: ${result.error}`);
  }

  console.log("Message posted to Slack successfully:", result.ts);

  return new Response(
    JSON.stringify({ success: true, slack_ts: result.ts }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

async function handleSlackEvent(request: SlackEventRequest): Promise<Response> {
  const event = request.event;
  
  if (!event || event.type !== "message") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Ignore bot messages to prevent loops
  if (event.bot_id) {
    console.log("Ignoring bot message");
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Ignore messages not from our target channel
  if (event.channel !== SLACK_CHANNEL_ID) {
    console.log("Message from different channel, ignoring");
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  console.log(`New Slack message from user ${event.user}: ${event.text}`);

  // Get Slack user info
  const userInfo = await getSlackUserInfo(event.user);
  const displayName = userInfo?.real_name || userInfo?.name || "Utilisateur Slack";

  // Create post in Feed
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find a system user or the first admin to attribute the post
  const { data: adminUser } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .single();

  if (!adminUser) {
    console.error("No admin user found for Slack post attribution");
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const postContent = `💬 *Message Slack de ${displayName}*\n\n${event.text}`;

  const { data: post, error } = await supabase
    .from("user_posts")
    .insert({
      content: postContent,
      user_id: adminUser.user_id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating post from Slack:", error);
    throw error;
  }

  console.log("Created Feed post from Slack message:", post.id);

  return new Response(
    JSON.stringify({ ok: true, post_id: post.id }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

async function getSlackUserInfo(userId: string): Promise<any> {
  if (!SLACK_BOT_TOKEN) return null;

  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
      },
    });
    
    const result = await response.json();
    return result.ok ? result.user : null;
  } catch (error) {
    console.error("Error fetching Slack user info:", error);
    return null;
  }
}

serve(handler);
