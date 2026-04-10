import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOCKED_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd/i,
];

const BLOCKED_HOSTNAMES = ['localhost', 'metadata.google.internal', 'metadata.google', '169.254.169.254'];
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

function validateUrl(rawUrl: string): URL {
  let normalized = rawUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error('Blocked hostname');
  }

  if (BLOCKED_IP_RANGES.some(r => r.test(hostname))) {
    throw new Error('Access to private/internal IPs is not allowed');
  }

  return parsed;
}

async function resolveAndValidate(url: URL): Promise<void> {
  try {
    const ips = await Deno.resolveDns(url.hostname, 'A');
    for (const ip of ips) {
      if (BLOCKED_IP_RANGES.some(r => r.test(ip))) {
        throw new Error(`DNS resolved to blocked IP: ${ip}`);
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('blocked')) throw e;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let urlParam: string | undefined;

    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      urlParam = searchParams.get('url') || undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      urlParam = body?.url;
    }

    if (!urlParam || typeof urlParam !== 'string') {
      return new Response(
        JSON.stringify({ success: false, reason: 'missing_url', error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = validateUrl(urlParam);
    await resolveAndValidate(parsed);

    const fetchUrl = parsed.href;
    const domain = parsed.hostname.replace('www.', '');

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    const html = await response.text();

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

    const hasMetadata = !!(title || description || image);

    if (!hasMetadata) {
      return new Response(
        JSON.stringify({ success: false, url: fetchUrl, domain, reason: 'no_og_tags_or_blocked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, url: fetchUrl, title, description, image, siteName, domain }),
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
