import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const orgId = Deno.env.get("LINKEDIN_ORG_ID");

    if (!orgId) {
      return new Response(JSON.stringify({ error: "LINKEDIN_ORG_ID not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the latest OAuth token
    const { data: tokenRows, error: tokenError } = await supabase
      .from("linkedin_tokens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (tokenError || !tokenRows || tokenRows.length === 0) {
      console.error("No LinkedIn token found:", tokenError);
      return new Response(
        JSON.stringify({ error: "No LinkedIn OAuth token. Please authorize first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = tokenRows[0];
    const now = new Date();
    const expiresAt = new Date(token.expires_at);

    if (now > expiresAt) {
      console.error("LinkedIn token expired at:", token.expires_at);
      return new Response(
        JSON.stringify({ error: "LinkedIn token expired. Please re-authorize.", expires_at: token.expires_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Warn if token expires within 7 days
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry < 7) {
      console.warn(`LinkedIn token expires in ${Math.round(daysUntilExpiry)} days!`);
    }

    // Fetch posts from LinkedIn API
    const authorUrn = `urn:li:organization:${orgId}`;
    const apiUrl = `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(authorUrn)}&count=20`;

    const linkedinResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "LinkedIn-Version": "202505",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!linkedinResponse.ok) {
      const errText = await linkedinResponse.text();
      console.error("LinkedIn API error:", linkedinResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "LinkedIn API error", status: linkedinResponse.status, details: errText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    const linkedinData = await linkedinResponse.json();
    const elements = linkedinData.elements || [];

    console.log(`Fetched ${elements.length} posts from LinkedIn`);

    let upsertedCount = 0;

    for (const post of elements) {
      const linkedinId = post.id || post.urn || `unknown-${Date.now()}`;

      // Extract content text
      let content = "";
      if (post.commentary) {
        content = post.commentary;
      } else if (post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text) {
        content = post.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text;
      }

      // Extract image URL
      let imageUrl: string | null = null;
      if (post.content?.multiImage?.images?.[0]?.id) {
        imageUrl = post.content.multiImage.images[0].id;
      } else if (post.content?.media?.id) {
        imageUrl = post.content.media.id;
      }

      // Extract link
      let link: string | null = null;
      if (post.content?.article?.source) {
        link = post.content.article.source;
      }
      // Fallback: construct LinkedIn post URL
      if (!link) {
        const activityId = linkedinId.replace("urn:li:share:", "").replace("urn:li:ugcPost:", "");
        link = `https://www.linkedin.com/feed/update/${linkedinId}`;
      }

      // Extract published date
      const publishedAt = post.createdAt
        ? new Date(post.createdAt).toISOString()
        : post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : new Date().toISOString();

      // Extract title from article if available
      const title = post.content?.article?.title || null;

      const { error: upsertError } = await supabase
        .from("linkedin_posts")
        .upsert(
          {
            linkedin_id: linkedinId,
            title,
            content,
            link,
            image_url: imageUrl,
            published_at: publishedAt,
          },
          { onConflict: "linkedin_id" }
        );

      if (upsertError) {
        console.error(`Failed to upsert post ${linkedinId}:`, upsertError);
      } else {
        upsertedCount++;
      }
    }

    console.log(`Successfully upserted ${upsertedCount}/${elements.length} LinkedIn posts`);

    return new Response(
      JSON.stringify({
        success: true,
        fetched: elements.length,
        upserted: upsertedCount,
        token_expires_in_days: Math.round(daysUntilExpiry),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
