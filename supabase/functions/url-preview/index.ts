import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let urlParam: string | undefined;

    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      urlParam = searchParams.get('url') || undefined;
      console.log('[URL PREVIEW][GET] Incoming URL param:', urlParam);
    } else {
      const body = await req.json().catch(() => ({}));
      urlParam = body?.url;
      console.log('[URL PREVIEW][POST] Incoming body:', body);
    }

    console.log('[URL PREVIEW] ===== REQUEST START =====');

    if (!urlParam) {
      console.log('[URL PREVIEW] Missing url parameter');
      return new Response(
        JSON.stringify({ success: false, reason: 'missing_url', error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize and parse domain for logging
    let fetchUrl = urlParam.trim();
    if (!/^https?:\/\//i.test(fetchUrl)) {
      fetchUrl = `https://${fetchUrl}`;
    }
    const domain = new URL(fetchUrl).hostname.replace('www.', '');

    console.log('[URL PREVIEW] Domain:', domain);
    console.log('[URL PREVIEW] Fetching URL:', fetchUrl);

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    console.log('[URL PREVIEW] HTTP Status:', response.status);
    console.log('[URL PREVIEW] Content-Type:', response.headers.get('content-type'));

    const html = await response.text();
    console.log('[URL PREVIEW] HTML length:', html.length);
    console.log('[URL PREVIEW] HTML preview (first 300 chars):', html.substring(0, 300));

    // Extract Open Graph / standard meta
    const getMeta = (htmlText: string, property: string): string | null => {
      const propRegex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const propMatch = htmlText.match(propRegex);
      if (propMatch) return propMatch[1];
      const nameRegex = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const nameMatch = htmlText.match(nameRegex);
      return nameMatch ? nameMatch[1] : null;
    };

    const title = getMeta(html, 'og:title') || getMeta(html, 'title') || '';
    const description = getMeta(html, 'og:description') || getMeta(html, 'description') || '';
    const image = getMeta(html, 'og:image') || '';
    const siteName = getMeta(html, 'og:site_name') || '';

    console.log('[URL PREVIEW] Parsed metadata:', {
      title,
      description_preview: description ? description.substring(0, 100) : '(empty)',
      image,
      siteName,
    });

    const hasMetadata = !!(title || description || image);
    console.log('[URL PREVIEW] Has metadata:', hasMetadata);

    if (!hasMetadata) {
      console.log('[URL PREVIEW] No OG tags found - returning fallback');
      return new Response(
        JSON.stringify({
          success: false,
          url: fetchUrl,
          domain,
          reason: 'no_og_tags_or_blocked',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[URL PREVIEW] Returning success response');
    console.log('[URL PREVIEW] ===== REQUEST END =====');

    return new Response(
      JSON.stringify({
        success: true,
        url: fetchUrl,
        title,
        description,
        image,
        siteName,
        domain,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[URL PREVIEW] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, reason: 'fetch_error', error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
