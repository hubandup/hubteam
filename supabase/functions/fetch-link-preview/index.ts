import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    console.log('[LINK PREVIEW] ===== REQUEST START =====');
    console.log('[LINK PREVIEW] Incoming URL:', url);
    
    if (!url) {
      throw new Error('URL is required');
    }

    // Parse domain for logging
    const domain = new URL(url).hostname;
    console.log('[LINK PREVIEW] Domain:', domain);
    console.log('[LINK PREVIEW] Fetching URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    console.log('[LINK PREVIEW] HTTP Status:', response.status);
    console.log('[LINK PREVIEW] Content-Type:', response.headers.get('content-type'));

    const html = await response.text();
    console.log('[LINK PREVIEW] HTML length:', html.length);
    console.log('[LINK PREVIEW] HTML preview (first 300 chars):', html.substring(0, 300));
    
    // Extract Open Graph metadata
    const getMetaContent = (property: string): string | null => {
      const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const match = html.match(regex);
      if (match) return match[1];
      
      // Try name attribute as fallback
      const nameRegex = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const nameMatch = html.match(nameRegex);
      return nameMatch ? nameMatch[1] : null;
    };

    const title = getMetaContent('og:title') || getMetaContent('title') || '';
    const description = getMetaContent('og:description') || getMetaContent('description') || '';
    const image = getMetaContent('og:image') || '';
    const siteName = getMetaContent('og:site_name') || '';

    console.log('[LINK PREVIEW] Parsed metadata:');
    console.log('  - title:', title);
    console.log('  - description:', description ? description.substring(0, 100) : '(empty)');
    console.log('  - image:', image);
    console.log('  - siteName:', siteName);

    // Check if we have any meaningful metadata
    const hasMetadata = !!(title || description || image);
    console.log('[LINK PREVIEW] Has metadata:', hasMetadata);

    if (!hasMetadata) {
      console.log('[LINK PREVIEW] No OG tags found - returning fallback response');
      return new Response(
        JSON.stringify({
          success: false,
          url,
          domain,
          reason: 'no_og_tags_or_blocked',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[LINK PREVIEW] Returning success response');
    console.log('[LINK PREVIEW] ===== REQUEST END =====');

    return new Response(
      JSON.stringify({
        success: true,
        url,
        title,
        description,
        image,
        siteName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[LINK PREVIEW] ERROR:', error);
    console.error('[LINK PREVIEW] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reason: 'fetch_error'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
