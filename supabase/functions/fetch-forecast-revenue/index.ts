const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro';

interface FacturationProQuote {
  id: number;
  total: string;
  quote_status: number;
  quote_date: string;
}

interface FacturationProInvoice {
  id: number;
  total: string;
  paid: boolean;
  payment_status: number;
  invoice_date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[FORECAST] Fetching forecast revenue from Facturation.PRO...');

    const apiKey = Deno.env.get('FACTURATION_PRO_API_KEY');
    const apiId = Deno.env.get('FACTURATION_PRO_API_ID');
    const firmId = Deno.env.get('FACTURATION_PRO_FIRM_ID');

    if (!apiKey || !apiId || !firmId) {
      throw new Error('Missing Facturation.PRO API credentials');
    }

    const headers = {
      Authorization: `Basic ${btoa(`${apiId}:${apiKey}`)}`,
      'Content-Type': 'application/json',
    };

    // Fetch unpaid invoices (CA HT à encaisser)
    let totalForecast = 0;
    const perPage = 100;
    const maxPages = 20;

    // Fetch invoices to find unpaid ones
    for (let page = 1; page <= maxPages; page++) {
      const url = new URL(`${FACTURATION_PRO_API_URL}/firms/${firmId}/invoices.json`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', String(perPage));

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FORECAST] API error:', errorText);
        throw new Error(`Facturation.PRO API error: ${response.status}`);
      }

      const data = await response.json();
      const invoices: FacturationProInvoice[] = Array.isArray(data) ? data : (data?.invoices || data?.data || []);

      console.log(`[FORECAST] Page ${page}: ${invoices.length} invoices`);

      if (invoices.length === 0) break;

      // Sum unpaid invoices (payment_status !== 3 means not fully paid, or paid === false)
      for (const invoice of invoices) {
        const isPaid = invoice.paid === true || invoice.payment_status === 3;
        if (!isPaid) {
          const amount = parseFloat(invoice.total) || 0;
          totalForecast += amount;
          console.log(`[FORECAST] Unpaid invoice: ${amount}€`);
        }
      }

      if (invoices.length < perPage) break;
    }

    console.log(`[FORECAST] Total CA HT à encaisser: ${totalForecast}€`);

    return new Response(
      JSON.stringify({
        success: true,
        forecastRevenue: totalForecast,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[FORECAST] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
