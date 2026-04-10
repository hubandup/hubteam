import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Private/reserved IP ranges that must be blocked to prevent SSRF
const BLOCKED_IP_RANGES = [
  /^127\./,                          // Loopback
  /^10\./,                           // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./,     // Private Class B
  /^192\.168\./,                     // Private Class C
  /^169\.254\./,                     // Link-local
  /^0\./,                            // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Shared address space
  /^198\.1[89]\./,                   // Benchmark testing
  /^::1$/,                           // IPv6 loopback
  /^fc00:/i,                         // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
  /^fd/i,                            // IPv6 private
];

const BLOCKED_HOSTNAMES = ['localhost', 'metadata.google.internal', 'metadata.google', '169.254.169.254'];

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

function validateUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
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

  // Block IPs directly in the URL
  if (BLOCKED_IP_RANGES.some(r => r.test(hostname))) {
    throw new Error('Access to private/internal IPs is not allowed');
  }

  return parsed;
}

async function resolveAndValidate(url: URL): Promise<void> {
  // Deno supports Deno.resolveDns – resolve A records and check
  try {
    const ips = await Deno.resolveDns(url.hostname, 'A');
    for (const ip of ips) {
      if (BLOCKED_IP_RANGES.some(r => r.test(ip))) {
        throw new Error(`DNS resolved to blocked IP: ${ip}`);
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('blocked')) throw e;
    // If DNS resolution fails (e.g. not available), we still allow the fetch
    // but the URL hostname validation above already covers direct IP usage
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      throw new Error('URL is required');
    }

    const parsed = validateUrl(url);
    await resolveAndValidate(parsed);

    const domain = parsed.hostname;

    const response = await fetch(parsed.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    const html = await response.text();

    const getMetaContent = (property: string): string | null => {
      const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const match = html.match(regex);
      if (match) return match[1];
      const nameRegex = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const nameMatch = html.match(nameRegex);
      return nameMatch ? nameMatch[1] : null;
    };

    const title = getMetaContent('og:title') || getMetaContent('title') || '';
    const description = getMetaContent('og:description') || getMetaContent('description') || '';
    const image = getMetaContent('og:image') || '';
    const siteName = getMetaContent('og:site_name') || '';

    const hasMetadata = !!(title || description || image);

    if (!hasMetadata) {
      return new Response(
        JSON.stringify({ success: false, url, domain, reason: 'no_og_tags_or_blocked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, url, title, description, image, siteName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[LINK PREVIEW] ERROR:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reason: 'fetch_error',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
