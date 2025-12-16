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

    // Get dates for next 3 months (starting from tomorrow to exclude current month)
    const now = new Date();
    const month1Start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const month1End = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const month2Start = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const month2End = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const month3Start = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    const month3End = new Date(now.getFullYear(), now.getMonth() + 4, 0);

    console.log(`[FORECAST] Month 1: ${month1Start.toISOString()} - ${month1End.toISOString()}`);
    console.log(`[FORECAST] Month 2: ${month2Start.toISOString()} - ${month2End.toISOString()}`);
    console.log(`[FORECAST] Month 3: ${month3Start.toISOString()} - ${month3End.toISOString()}`);

    const monthlyForecasts: MonthlyForecast[] = [
      { month: 1, encaisser: 0, recurrent: 0, total: 0 },
      { month: 2, encaisser: 0, recurrent: 0, total: 0 },
      { month: 3, encaisser: 0, recurrent: 0, total: 0 },
    ];

    // Fetch unpaid invoices (CA HT à encaisser) - only those with due dates in next 3 months
    const perPage = 100;
    const maxPages = 20;

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

      // Process unpaid invoices - ONLY with due dates in next 3 months
      for (const invoice of invoices) {
        const isPaid = invoice.paid === true || invoice.payment_status === 3;
        if (isPaid) continue;
        
        const amount = parseFloat(invoice.total) || 0;
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
        
        if (!dueDate) continue; // Skip invoices without due date
        
        // Only include invoices with due dates in the next 3 months
        if (dueDate >= month1Start && dueDate <= month1End) {
          monthlyForecasts[0].encaisser += amount;
          console.log(`[FORECAST] Month +1 invoice: ${amount}€ (due: ${invoice.due_date})`);
        } else if (dueDate >= month2Start && dueDate <= month2End) {
          monthlyForecasts[1].encaisser += amount;
          console.log(`[FORECAST] Month +2 invoice: ${amount}€ (due: ${invoice.due_date})`);
        } else if (dueDate >= month3Start && dueDate <= month3End) {
          monthlyForecasts[2].encaisser += amount;
          console.log(`[FORECAST] Month +3 invoice: ${amount}€ (due: ${invoice.due_date})`);
        }
        // Skip past due and future (>3 months) invoices
      }

      if (invoices.length < perPage) break;
    }

    // Fetch recurring revenue (CA HT récurrent)
    try {
      const recurringUrl = new URL(`${FACTURATION_PRO_API_URL}/firms/${firmId}/recurring_invoices.json`);
      recurringUrl.searchParams.set('per_page', '100');
      
      const recurringResponse = await fetch(recurringUrl.toString(), { headers });
      
      if (recurringResponse.ok) {
        const recurringData = await recurringResponse.json();
        const recurringInvoices = Array.isArray(recurringData) ? recurringData : (recurringData?.recurring_invoices || recurringData?.data || []);
        
        console.log(`[FORECAST] Found ${recurringInvoices.length} recurring invoices`);
        console.log(`[FORECAST] Recurring data sample:`, JSON.stringify(recurringInvoices.slice(0, 3)));
        
        for (const recInvoice of recurringInvoices) {
          // Check if recurring invoice is active
          if (recInvoice.active === false || recInvoice.status === 'inactive') continue;
          
          const amount = parseFloat(recInvoice.total || recInvoice.amount || '0') || 0;
          const frequency = recInvoice.frequency || recInvoice.period || 'monthly';
          
          console.log(`[FORECAST] Recurring invoice: ${amount}€, frequency: ${frequency}, active: ${recInvoice.active}`);
          
          // Distribute recurring amount based on frequency
          if (frequency === 'monthly' || frequency === 'mensuel') {
            monthlyForecasts[0].recurrent += amount;
            monthlyForecasts[1].recurrent += amount;
            monthlyForecasts[2].recurrent += amount;
          } else if (frequency === 'quarterly' || frequency === 'trimestriel') {
            // Add to first month only for quarterly
            monthlyForecasts[0].recurrent += amount;
          } else if (frequency === 'yearly' || frequency === 'annuel') {
            // Check if due in next 3 months
            const nextDate = recInvoice.next_date || recInvoice.next_invoice_date;
            if (nextDate) {
              const nextInvoiceDate = new Date(nextDate);
              if (nextInvoiceDate >= month1Start && nextInvoiceDate <= month1End) {
                monthlyForecasts[0].recurrent += amount;
              } else if (nextInvoiceDate >= month2Start && nextInvoiceDate <= month2End) {
                monthlyForecasts[1].recurrent += amount;
              } else if (nextInvoiceDate >= month3Start && nextInvoiceDate <= month3End) {
                monthlyForecasts[2].recurrent += amount;
              }
            }
          } else {
            // Default: add to each month
            monthlyForecasts[0].recurrent += amount;
            monthlyForecasts[1].recurrent += amount;
            monthlyForecasts[2].recurrent += amount;
          }
        }
      } else {
        console.log('[FORECAST] Recurring invoices endpoint returned:', recurringResponse.status);
      }
    } catch (recurringError) {
      console.log('[FORECAST] Could not fetch recurring invoices:', recurringError);
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
