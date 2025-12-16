const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro';

interface FacturationProInvoice {
  id: number;
  total: string;
  paid: boolean;
  payment_status: number;
  invoice_date: string;
  due_date: string;
}

interface MonthlyForecast {
  month: number; // 1, 2, or 3 (months from now)
  encaisser: number; // CA HT à encaisser
  recurrent: number; // CA HT récurrent
  total: number;
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

    // Get dates for next 3 months
    const now = new Date();
    const month1Start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const month1End = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const month2Start = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const month2End = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const month3Start = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    const month3End = new Date(now.getFullYear(), now.getMonth() + 4, 0);

    const monthlyForecasts: MonthlyForecast[] = [
      { month: 1, encaisser: 0, recurrent: 0, total: 0 },
      { month: 2, encaisser: 0, recurrent: 0, total: 0 },
      { month: 3, encaisser: 0, recurrent: 0, total: 0 },
    ];

    // Fetch unpaid invoices (CA HT à encaisser) with due dates
    const perPage = 100;
    const maxPages = 20;
    let totalEncaisser = 0;

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

      // Process unpaid invoices
      for (const invoice of invoices) {
        const isPaid = invoice.paid === true || invoice.payment_status === 3;
        if (!isPaid) {
          const amount = parseFloat(invoice.total) || 0;
          totalEncaisser += amount;
          
          // Categorize by due date into months
          const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
          
          if (dueDate) {
            if (dueDate >= month1Start && dueDate <= month1End) {
              monthlyForecasts[0].encaisser += amount;
            } else if (dueDate >= month2Start && dueDate <= month2End) {
              monthlyForecasts[1].encaisser += amount;
            } else if (dueDate >= month3Start && dueDate <= month3End) {
              monthlyForecasts[2].encaisser += amount;
            } else if (dueDate < month1Start) {
              // Past due invoices count towards month 1
              monthlyForecasts[0].encaisser += amount;
            }
          } else {
            // No due date - distribute to month 1
            monthlyForecasts[0].encaisser += amount;
          }
        }
      }

      if (invoices.length < perPage) break;
    }

    // Try to fetch recurring revenue if available
    try {
      const recurringUrl = new URL(`${FACTURATION_PRO_API_URL}/firms/${firmId}/recurring_invoices.json`);
      recurringUrl.searchParams.set('per_page', '100');
      
      const recurringResponse = await fetch(recurringUrl.toString(), { headers });
      
      if (recurringResponse.ok) {
        const recurringData = await recurringResponse.json();
        const recurringInvoices = Array.isArray(recurringData) ? recurringData : (recurringData?.recurring_invoices || recurringData?.data || []);
        
        console.log(`[FORECAST] Found ${recurringInvoices.length} recurring invoices`);
        
        for (const recInvoice of recurringInvoices) {
          if (recInvoice.active !== false) {
            const amount = parseFloat(recInvoice.total || recInvoice.amount || '0') || 0;
            // Add recurring amount to each of the 3 months
            monthlyForecasts[0].recurrent += amount;
            monthlyForecasts[1].recurrent += amount;
            monthlyForecasts[2].recurrent += amount;
          }
        }
      }
    } catch (recurringError) {
      console.log('[FORECAST] Could not fetch recurring invoices (may not be available):', recurringError);
    }

    // Calculate totals for each month
    monthlyForecasts.forEach(mf => {
      mf.total = mf.encaisser + mf.recurrent;
    });

    const totalForecast = monthlyForecasts.reduce((sum, mf) => sum + mf.total, 0);

    console.log('[FORECAST] Monthly forecasts:', JSON.stringify(monthlyForecasts));
    console.log(`[FORECAST] Total forecast: ${totalForecast}€`);

    return new Response(
      JSON.stringify({
        success: true,
        forecastRevenue: totalForecast,
        monthlyForecasts,
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
