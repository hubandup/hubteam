const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro';

interface FacturationProQuote {
  id: number;
  customer_id: number;
  customer_short_name: string;
  quote_ref: string;
  title: string;
  quote_status: number;
  total: string;
  internal_note: string;
  quote_date: string;
  accepted_date?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Fetching validated quotes from Facturation.PRO...');

    const apiKey = Deno.env.get('FACTURATION_PRO_API_KEY');
    const apiId = Deno.env.get('FACTURATION_PRO_API_ID');
    const firmId = Deno.env.get('FACTURATION_PRO_FIRM_ID');

    console.log('API credentials check:', { 
      hasApiKey: !!apiKey, 
      hasApiId: !!apiId, 
      hasFirmId: !!firmId 
    });

    if (!apiKey || !apiId || !firmId) {
      throw new Error('Missing Facturation.PRO API credentials');
    }

    // Fetch validated quotes (status 1 = accepted)
    const quotesResponse = await fetch(
      `${FACTURATION_PRO_API_URL}/firms/${firmId}/quotes.json`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${apiId}:${apiKey}`)}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Facturation.PRO API response status:', quotesResponse.status);

    if (!quotesResponse.ok) {
      const errorText = await quotesResponse.text();
      console.error('Facturation.PRO API error response:', errorText);
      throw new Error(`Facturation.PRO API error: ${quotesResponse.status} ${quotesResponse.statusText}`);
    }

    const quotesData = await quotesResponse.json();
    const allQuotes = Array.isArray(quotesData) ? quotesData : quotesData.quotes || [];

    console.log(`Found ${allQuotes.length} total quotes`);

    // Filter validated quotes (status 1) and sort by validation date
    const validatedQuotes = allQuotes
      .filter((quote: FacturationProQuote) => quote.quote_status === 1)
      .sort((a: FacturationProQuote, b: FacturationProQuote) => {
        const dateA = a.accepted_date ? new Date(a.accepted_date).getTime() : 0;
        const dateB = b.accepted_date ? new Date(b.accepted_date).getTime() : 0;
        return dateB - dateA; // Most recent first
      })
      .slice(0, 30) // Get only the last 30
      .map((quote: FacturationProQuote) => {
        const montantHT = parseFloat(quote.total) || 0;
        const montantHA = parseFloat(quote.internal_note || '0') || 0;
        const margeEuro = montantHA - montantHT;
        const margePercent = montantHT > 0 ? (margeEuro / montantHT) * 100 : 0;

        return {
          client: quote.customer_short_name || 'Client inconnu',
          quoteRef: quote.quote_ref || '-',
          title: quote.title || 'Sans titre',
          validationDate: quote.accepted_date || null,
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
      }
    );
  } catch (error) {
    console.error('Error fetching validated quotes:', error);
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
