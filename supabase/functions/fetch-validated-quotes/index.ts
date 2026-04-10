const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro';

interface FacturationProQuote {
  id: number;
  customer_id: number;
  customer_short_name: string;
  customer_identity: string;
  quote_ref: string;
  title: string;
  quote_status: number;
  total: string;
  internal_note: string;
  quote_date: string;
  accepted_date?: string;
}

const extractQuotesFromApiResponse = (quotesData: any): FacturationProQuote[] => {
  if (Array.isArray(quotesData)) return quotesData as FacturationProQuote[];
  if (Array.isArray(quotesData?.quotes)) return quotesData.quotes as FacturationProQuote[];
  if (Array.isArray(quotesData?.data)) return quotesData.data as FacturationProQuote[];
  return [];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── CRON_SECRET guard ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization') || '';
    const providedSecret = req.headers.get('x-cron-secret') || '';
    const bearerToken = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isAllowed = providedSecret === cronSecret
      || bearerToken === cronSecret
      || bearerToken === serviceKey
      || bearerToken === anonKey;
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }


  try {
    console.log('Fetching validated quotes from Facturation.PRO...');

    const apiKey = Deno.env.get('FACTURATION_PRO_API_KEY');
    const apiId = Deno.env.get('FACTURATION_PRO_API_ID');
    const firmId = Deno.env.get('FACTURATION_PRO_FIRM_ID');

    console.log('API credentials check:', {
      hasApiKey: !!apiKey,
      hasApiId: !!apiId,
      hasFirmId: !!firmId,
    });

    if (!apiKey || !apiId || !firmId) {
      throw new Error('Missing Facturation.PRO API credentials');
    }

    const headers = {
      Authorization: `Basic ${btoa(`${apiId}:${apiKey}`)}`,
      'Content-Type': 'application/json',
    };

    // Facturation.PRO seems to paginate results; fetch multiple pages.
    const allQuotes: FacturationProQuote[] = [];
    const perPage = 100;
    const maxPages = 50;
    let expectedPageSize: number | null = null;
    let lastFirstId: number | null = null;

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL(`${FACTURATION_PRO_API_URL}/firms/${firmId}/quotes.json`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('limit', String(perPage));

      const quotesResponse = await fetch(url.toString(), { headers });

      console.log(`Facturation.PRO API response status (page ${page}):`, quotesResponse.status);

      if (!quotesResponse.ok) {
        const errorText = await quotesResponse.text();
        console.error('Facturation.PRO API error response:', errorText);
        throw new Error(
          `Facturation.PRO API error: ${quotesResponse.status} ${quotesResponse.statusText}`,
        );
      }

      const quotesData = await quotesResponse.json();
      const pageQuotes = extractQuotesFromApiResponse(quotesData);

      console.log(`Page ${page}: ${pageQuotes.length} quotes`);

      if (expectedPageSize === null) expectedPageSize = pageQuotes.length;

      // Stop if pagination is not supported and we keep getting the same page.
      if (page > 1 && pageQuotes.length > 0 && lastFirstId !== null && pageQuotes[0]?.id === lastFirstId) {
        console.warn('Pagination appears to repeat the same page; stopping to avoid infinite loop.');
        break;
      }
      if (pageQuotes.length > 0) lastFirstId = pageQuotes[0].id;

      allQuotes.push(...pageQuotes);

      if (pageQuotes.length === 0) break;
      if (expectedPageSize && pageQuotes.length < expectedPageSize) break;

      // Optimization: if we already have plenty of accepted quotes, we can stop early.
      const acceptedSoFar = allQuotes.reduce((acc, q) => acc + (q.quote_status === 1 ? 1 : 0), 0);
      if (acceptedSoFar >= 80) break;
    }

    console.log(`Found ${allQuotes.length} total quotes (across pages)`);

    // Filter validated quotes (status 1) and sort by validation date
    const validatedQuotes = allQuotes
      .filter((quote: FacturationProQuote) => quote.quote_status === 1)
      .sort((a: FacturationProQuote, b: FacturationProQuote) => {
        const dateA = a.accepted_date ? new Date(a.accepted_date).getTime() : 0;
        const dateB = b.accepted_date ? new Date(b.accepted_date).getTime() : 0;
        return dateB - dateA; // Most recent first
      })
      .slice(0, 50)
      .map((quote: FacturationProQuote) => {
        const montantHT = parseFloat(quote.total) || 0;
        const montantHA = parseFloat(quote.internal_note || '0') || 0;
        const margeEuro = montantHT - montantHA;
        const margePercent = montantHT > 0 ? (margeEuro / montantHT) * 100 : 0;

        console.log('Quote mapping:', {
          customer_identity: quote.customer_identity,
          customer_short_name: quote.customer_short_name,
          quote_ref: quote.quote_ref,
          title: quote.title,
          montantHT,
          montantHA,
          margeEuro,
        });

        return {
          client: quote.customer_identity || quote.customer_short_name || 'Client inconnu',
          quoteRef: quote.quote_ref || '-',
          title: quote.title || 'Sans titre',
          montantHT,
          montantHA,
          margeEuro,
          margePercent,
        };
      });

    console.log(`Found ${validatedQuotes.length} validated quotes`);

    return new Response(
      JSON.stringify({
        success: true,
        quotes: validatedQuotes,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error fetching validated quotes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
