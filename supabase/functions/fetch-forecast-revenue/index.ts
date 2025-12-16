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

interface RecurringInvoice {
  id: number;
  total?: string;
  amount?: string;
  frequency?: string;
  period?: string;
  next_date?: string;
  next_invoice_date?: string;
  active?: boolean;
  status?: string;
  end_date?: string;
  occurrences?: number;
  occurrences_count?: number;
}

interface MonthlyForecast {
  month: number;
  encaisser: number;
  recurrent: number;
  total: number;
}

// Helper to get all occurrences of a recurring invoice in the next 3 months
function getOccurrencesInPeriod(
  nextDate: Date,
  frequency: string,
  endDate: Date | null,
  month1Start: Date,
  month3End: Date
): Date[] {
  const occurrences: Date[] = [];
  let currentDate = new Date(nextDate);
  
  // Safety limit to prevent infinite loops
  const maxIterations = 12;
  let iterations = 0;
  
  while (currentDate <= month3End && iterations < maxIterations) {
    // Check if occurrence is within our period and before end date
    if (currentDate >= month1Start && (!endDate || currentDate <= endDate)) {
      occurrences.push(new Date(currentDate));
    }
    
    // Move to next occurrence based on frequency
    switch (frequency.toLowerCase()) {
      case 'monthly':
      case 'mensuel':
      case 'mensuelle':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'bimonthly':
      case 'bimestriel':
      case 'bimestrielle':
        currentDate.setMonth(currentDate.getMonth() + 2);
        break;
      case 'quarterly':
      case 'trimestriel':
      case 'trimestrielle':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case 'semiannual':
      case 'semestriel':
      case 'semestrielle':
        currentDate.setMonth(currentDate.getMonth() + 6);
        break;
      case 'yearly':
      case 'annuel':
      case 'annuelle':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        // Default to monthly
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    iterations++;
  }
  
  return occurrences;
}

// Helper to determine which month bucket a date falls into
function getMonthBucket(
  date: Date,
  month1Start: Date,
  month1End: Date,
  month2Start: Date,
  month2End: Date,
  month3Start: Date,
  month3End: Date
): number | null {
  if (date >= month1Start && date <= month1End) return 0;
  if (date >= month2Start && date <= month2End) return 1;
  if (date >= month3Start && date <= month3End) return 2;
  return null;
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
    const month1End = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
    const month2Start = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const month2End = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);
    const month3Start = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    const month3End = new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59);

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    console.log(`[FORECAST] Month +1: ${monthNames[month1Start.getMonth()]} ${month1Start.getFullYear()}`);
    console.log(`[FORECAST] Month +2: ${monthNames[month2Start.getMonth()]} ${month2Start.getFullYear()}`);
    console.log(`[FORECAST] Month +3: ${monthNames[month3Start.getMonth()]} ${month3Start.getFullYear()}`);

    const monthlyForecasts: MonthlyForecast[] = [
      { month: 1, encaisser: 0, recurrent: 0, total: 0 },
      { month: 2, encaisser: 0, recurrent: 0, total: 0 },
      { month: 3, encaisser: 0, recurrent: 0, total: 0 },
    ];

    // =========================================
    // 1. Fetch unpaid invoices (CA HT à encaisser)
    // =========================================
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

      console.log(`[FORECAST] Invoices page ${page}: ${invoices.length} items`);

      if (invoices.length === 0) break;

      for (const invoice of invoices) {
        const isPaid = invoice.paid === true || invoice.payment_status === 3;
        if (isPaid) continue;
        
        const amount = parseFloat(invoice.total) || 0;
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
        
        if (!dueDate || amount === 0) continue;
        
        const bucket = getMonthBucket(dueDate, month1Start, month1End, month2Start, month2End, month3Start, month3End);
        if (bucket !== null) {
          monthlyForecasts[bucket].encaisser += amount;
          console.log(`[FORECAST] Invoice ${invoice.id}: ${amount}€ → month +${bucket + 1} (due: ${invoice.due_date})`);
        }
      }

      if (invoices.length < perPage) break;
    }

    console.log(`[FORECAST] CA à encaisser: M+1=${monthlyForecasts[0].encaisser}€, M+2=${monthlyForecasts[1].encaisser}€, M+3=${monthlyForecasts[2].encaisser}€`);

    // =========================================
    // 2. Fetch recurring invoices (CA HT récurrent)
    // =========================================
    try {
      const recurringUrl = new URL(`${FACTURATION_PRO_API_URL}/firms/${firmId}/recurring_invoices.json`);
      recurringUrl.searchParams.set('per_page', '100');
      
      const recurringResponse = await fetch(recurringUrl.toString(), { headers });
      
      if (recurringResponse.ok) {
        const recurringData = await recurringResponse.json();
        const recurringInvoices: RecurringInvoice[] = Array.isArray(recurringData) 
          ? recurringData 
          : (recurringData?.recurring_invoices || recurringData?.data || []);
        
        console.log(`[FORECAST] Found ${recurringInvoices.length} recurring invoices`);
        
        // Log full structure of first item for debugging
        if (recurringInvoices.length > 0) {
          console.log(`[FORECAST] Sample recurring invoice structure:`, JSON.stringify(recurringInvoices[0], null, 2));
        }
        
        for (const recInvoice of recurringInvoices) {
          // Skip inactive recurring invoices
          if (recInvoice.active === false || recInvoice.status === 'inactive' || recInvoice.status === 'suspended') {
            console.log(`[FORECAST] Skipping inactive recurring invoice ${recInvoice.id}`);
            continue;
          }
          
          const amount = parseFloat(recInvoice.total || recInvoice.amount || '0') || 0;
          if (amount === 0) continue;
          
          const frequency = recInvoice.frequency || recInvoice.period || 'monthly';
          const nextDateStr = recInvoice.next_date || recInvoice.next_invoice_date;
          const endDateStr = recInvoice.end_date;
          
          if (!nextDateStr) {
            console.log(`[FORECAST] Recurring invoice ${recInvoice.id} has no next_date, skipping`);
            continue;
          }
          
          const nextDate = new Date(nextDateStr);
          const endDate = endDateStr ? new Date(endDateStr) : null;
          
          console.log(`[FORECAST] Recurring ${recInvoice.id}: ${amount}€, freq=${frequency}, next=${nextDateStr}, end=${endDateStr || 'none'}`);
          
          // Calculate all occurrences in the next 3 months
          const occurrences = getOccurrencesInPeriod(nextDate, frequency, endDate, month1Start, month3End);
          
          for (const occDate of occurrences) {
            const bucket = getMonthBucket(occDate, month1Start, month1End, month2Start, month2End, month3Start, month3End);
            if (bucket !== null) {
              monthlyForecasts[bucket].recurrent += amount;
              console.log(`[FORECAST] Recurring ${recInvoice.id}: +${amount}€ → month +${bucket + 1} (occurrence: ${occDate.toISOString().split('T')[0]})`);
            }
          }
        }
      } else {
        console.log('[FORECAST] Recurring invoices endpoint returned:', recurringResponse.status);
        const errorText = await recurringResponse.text();
        console.log('[FORECAST] Recurring error:', errorText);
      }
    } catch (recurringError) {
      console.log('[FORECAST] Could not fetch recurring invoices:', recurringError);
    }

    console.log(`[FORECAST] CA récurrent: M+1=${monthlyForecasts[0].recurrent}€, M+2=${monthlyForecasts[1].recurrent}€, M+3=${monthlyForecasts[2].recurrent}€`);

    // Calculate totals for each month
    monthlyForecasts.forEach(mf => {
      mf.total = mf.encaisser + mf.recurrent;
    });

    const totalForecast = monthlyForecasts.reduce((sum, mf) => sum + mf.total, 0);

    console.log('[FORECAST] === FINAL RESULTS ===');
    console.log(`[FORECAST] Month +1: encaisser=${monthlyForecasts[0].encaisser}€ + recurrent=${monthlyForecasts[0].recurrent}€ = ${monthlyForecasts[0].total}€`);
    console.log(`[FORECAST] Month +2: encaisser=${monthlyForecasts[1].encaisser}€ + recurrent=${monthlyForecasts[1].recurrent}€ = ${monthlyForecasts[1].total}€`);
    console.log(`[FORECAST] Month +3: encaisser=${monthlyForecasts[2].encaisser}€ + recurrent=${monthlyForecasts[2].recurrent}€ = ${monthlyForecasts[2].total}€`);
    console.log(`[FORECAST] TOTAL: ${totalForecast}€`);

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
