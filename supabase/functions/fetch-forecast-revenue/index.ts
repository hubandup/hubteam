const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro';

interface FacturationProInvoice {
  id: number;
  total: string;
  paid?: boolean;
  paid_on?: string | null;
  payment_status?: number;
  invoiced_on?: string;
  invoice_date?: string;
  term_on?: string | null;
  due_date?: string;
  due_on?: string;
  pay_before?: string | number | null;
  created_at?: string;
}

interface FacturationProQuote {
  id: number;
  total: string;
  quote_status: number;
  term_on?: string | null;
  due_date?: string;
  quote_date?: string;
  accepted_date?: string;
  title?: string;
  customer_identity?: string;
}

interface RecurringInvoice {
  id: number;
  total?: string;
  amount?: string;
  frequency?: string | number;
  period?: string;
  next_run_on?: string;
  last_run_on?: string;
  next_date?: string;
  next_invoice_date?: string;
  active?: boolean;
  status?: string;
  end_date?: string;
  term_on?: string | null;
  occurrences?: number;
  occurrences_count?: number;
}

interface MonthlyForecast {
  month: number;
  encaisser: number;
  recurrent: number;
  devisAFacturer: number;
  total: number;
}

function getInvoiceDueDate(invoice: any): Date | null {
  const dueStr = invoice?.due_date || invoice?.term_on || invoice?.due_on;
  if (dueStr) {
    const d = new Date(dueStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const invoicedOn = invoice?.invoiced_on || invoice?.invoice_date || invoice?.created_at;
  const payBeforeRaw = invoice?.pay_before;
  if (!invoicedOn || payBeforeRaw === undefined || payBeforeRaw === null) return null;

  const base = new Date(invoicedOn);
  if (Number.isNaN(base.getTime())) return null;

  const days = parseInt(String(payBeforeRaw), 10);
  if (Number.isNaN(days)) return null;

  base.setDate(base.getDate() + days);
  return base;
}

function parseFrequencyNumber(frequency: unknown): number | null {
  if (typeof frequency === 'number' && Number.isFinite(frequency)) return frequency;
  if (typeof frequency === 'string' && frequency.trim() && /^[0-9]+$/.test(frequency.trim())) {
    return parseInt(frequency.trim(), 10);
  }
  return null;
}

function advanceRecurringDate(currentDate: Date, frequency: unknown) {
  const n = parseFrequencyNumber(frequency);
  if (n !== null) {
    switch (n) {
      case 7:
        currentDate.setDate(currentDate.getDate() + 7);
        return;
      case 14:
        currentDate.setDate(currentDate.getDate() + 14);
        return;
      case 30:
        currentDate.setMonth(currentDate.getMonth() + 1);
        return;
      case 60:
        currentDate.setMonth(currentDate.getMonth() + 2);
        return;
      case 90:
        currentDate.setMonth(currentDate.getMonth() + 3);
        return;
      case 180:
        currentDate.setMonth(currentDate.getMonth() + 6);
        return;
      case 365:
      case 360:
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        return;
      default:
        currentDate.setDate(currentDate.getDate() + n);
        return;
    }
  }

  const f = typeof frequency === 'string' ? frequency.toLowerCase() : '';
  switch (f) {
    case 'monthly':
    case 'mensuel':
    case 'mensuelle':
      currentDate.setMonth(currentDate.getMonth() + 1);
      return;
    case 'bimonthly':
    case 'bimestriel':
    case 'bimestrielle':
      currentDate.setMonth(currentDate.getMonth() + 2);
      return;
    case 'quarterly':
    case 'trimestriel':
    case 'trimestrielle':
      currentDate.setMonth(currentDate.getMonth() + 3);
      return;
    case 'semiannual':
    case 'semestriel':
    case 'semestrielle':
      currentDate.setMonth(currentDate.getMonth() + 6);
      return;
    case 'yearly':
    case 'annuel':
    case 'annuelle':
      currentDate.setFullYear(currentDate.getFullYear() + 1);
      return;
    default:
      currentDate.setMonth(currentDate.getMonth() + 1);
  }
}

function getOccurrencesInPeriod(
  nextDate: Date,
  frequency: unknown,
  endDate: Date | null,
  periodStart: Date,
  periodEnd: Date
): Date[] {
  const occurrences: Date[] = [];
  let currentDate = new Date(nextDate);

  const maxIterations = 24;
  let iterations = 0;

  while (currentDate <= periodEnd && iterations < maxIterations) {
    if (currentDate >= periodStart && (!endDate || currentDate <= endDate)) {
      occurrences.push(new Date(currentDate));
    }

    advanceRecurringDate(currentDate, frequency);
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

    // Initialize forecasts for 3 months
    const monthlyForecasts: MonthlyForecast[] = [
      { month: 1, encaisser: 0, recurrent: 0, devisAFacturer: 0, total: 0 },
      { month: 2, encaisser: 0, recurrent: 0, devisAFacturer: 0, total: 0 },
      { month: 3, encaisser: 0, recurrent: 0, devisAFacturer: 0, total: 0 },
    ];

    let totalDevisAFacturer = 0;

    // =========================================
    // 1. Fetch unpaid invoices (CA HT à encaisser) for all 3 months
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
        const anyInv = invoice as any;

        const isPaid =
          Boolean(anyInv.paid_on) || anyInv.paid === true || anyInv.payment_status === 3;
        if (isPaid) continue;

        const amount = parseFloat(String(anyInv.total ?? '0')) || 0;
        const dueDate = getInvoiceDueDate(anyInv);

        if (!dueDate || amount === 0) continue;

        const bucket = getMonthBucket(dueDate, month1Start, month1End, month2Start, month2End, month3Start, month3End);
        if (bucket !== null) {
          monthlyForecasts[bucket].encaisser += amount;
          console.log(`[FORECAST] Invoice ${anyInv.id}: ${amount}€ → month +${bucket + 1} (due: ${dueDate.toISOString().split('T')[0]})`);
        }
      }

      if (invoices.length < perPage) break;
    }

    console.log(`[FORECAST] CA à encaisser: M+1=${monthlyForecasts[0].encaisser}€, M+2=${monthlyForecasts[1].encaisser}€, M+3=${monthlyForecasts[2].encaisser}€`);

    // =========================================
    // 2. Fetch recurring invoices (CA HT récurrent) for all 3 months
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
        
        for (const recInvoice of recurringInvoices) {
          if (recInvoice.active === false || recInvoice.status === 'inactive' || recInvoice.status === 'suspended') {
            continue;
          }
          
          const amount = parseFloat(String(recInvoice.total || recInvoice.amount || '0')) || 0;
          if (amount === 0) continue;

          const frequency = (recInvoice as any).frequency ?? (recInvoice as any).period ?? 'monthly';
          const nextDateStr =
            (recInvoice as any).next_run_on ||
            (recInvoice as any).next_date ||
            (recInvoice as any).next_invoice_date;
          const endDateStr = (recInvoice as any).term_on || (recInvoice as any).end_date;

          if (!nextDateStr) continue;
          
          const nextDate = new Date(nextDateStr);
          const endDate = endDateStr ? new Date(endDateStr) : null;
          
          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
          
          if (nextDate < sixtyDaysAgo) continue;
          if (endDate && endDate < now) continue;
          
          // Calculate occurrences for all 3 months
          const occurrences = getOccurrencesInPeriod(nextDate, frequency, endDate, month1Start, month3End);
          
          for (const occDate of occurrences) {
            const bucket = getMonthBucket(occDate, month1Start, month1End, month2Start, month2End, month3Start, month3End);
            if (bucket !== null) {
              monthlyForecasts[bucket].recurrent += amount;
              console.log(`[FORECAST] Recurring ${recInvoice.id}: +${amount}€ → month +${bucket + 1} (occurrence: ${occDate.toISOString().split('T')[0]})`);
            }
          }
        }
      }
    } catch (recurringError) {
      console.log('[FORECAST] Could not fetch recurring invoices:', recurringError);
    }

    console.log(`[FORECAST] CA récurrent: M+1=${monthlyForecasts[0].recurrent}€, M+2=${monthlyForecasts[1].recurrent}€, M+3=${monthlyForecasts[2].recurrent}€`);

    // =========================================
    // 3. Fetch quotes with status "À facturer" (quote_status = 1)
    // These are added to the TOTAL forecast (not per month)
    // =========================================
    try {
      const quotesUrl = new URL(`${FACTURATION_PRO_API_URL}/firms/${firmId}/quotes.json`);
      quotesUrl.searchParams.set('per_page', '100');
      
      const quotesResponse = await fetch(quotesUrl.toString(), { headers });
      
      if (quotesResponse.ok) {
        const quotesData = await quotesResponse.json();
        const quotes: FacturationProQuote[] = Array.isArray(quotesData) 
          ? quotesData 
          : (quotesData?.quotes || quotesData?.data || []);
        
        console.log(`[FORECAST] Found ${quotes.length} quotes`);
        
        // Filter quotes with status "À facturer" (status 1 = Validated/Accepted, ready to invoice)
        const quotesToInvoice = quotes.filter((q: any) => q.quote_status === 1);
        console.log(`[FORECAST] Quotes "À facturer" (status=1): ${quotesToInvoice.length}`);
        
        for (const quote of quotesToInvoice) {
          const amount = parseFloat(String(quote.total ?? '0')) || 0;
          if (amount === 0) continue;
          
          totalDevisAFacturer += amount;
          console.log(`[FORECAST] Quote ${quote.id} "${quote.title || 'N/A'}": ${amount}€ (À facturer)`);
        }
      }
    } catch (quotesError) {
      console.log('[FORECAST] Could not fetch quotes:', quotesError);
    }

    console.log(`[FORECAST] Total Devis "À facturer": ${totalDevisAFacturer}€`);

    // Calculate totals for each month
    monthlyForecasts.forEach(mf => {
      mf.total = mf.encaisser + mf.recurrent;
    });

    // Add devis to month+1 for display purposes (the quotes are cumulated with M+1 to M+3)
    monthlyForecasts[0].devisAFacturer = totalDevisAFacturer;

    // Total forecast = sum of 3 months + devis à facturer
    const totalEncaisser = monthlyForecasts.reduce((sum, mf) => sum + mf.encaisser, 0);
    const totalRecurrent = monthlyForecasts.reduce((sum, mf) => sum + mf.recurrent, 0);
    const totalForecast = totalEncaisser + totalRecurrent + totalDevisAFacturer;

    console.log('[FORECAST] === FINAL RESULTS ===');
    console.log(`[FORECAST] Month +1: encaisser=${monthlyForecasts[0].encaisser}€ + recurrent=${monthlyForecasts[0].recurrent}€ = ${monthlyForecasts[0].total}€`);
    console.log(`[FORECAST] Month +2: encaisser=${monthlyForecasts[1].encaisser}€ + recurrent=${monthlyForecasts[1].recurrent}€ = ${monthlyForecasts[1].total}€`);
    console.log(`[FORECAST] Month +3: encaisser=${monthlyForecasts[2].encaisser}€ + recurrent=${monthlyForecasts[2].recurrent}€ = ${monthlyForecasts[2].total}€`);
    console.log(`[FORECAST] Devis "À facturer": ${totalDevisAFacturer}€`);
    console.log(`[FORECAST] TOTAL CA Prévisionnel: ${totalForecast}€`);

    return new Response(
      JSON.stringify({
        success: true,
        forecastRevenue: totalForecast,
        monthlyForecasts,
        breakdown: {
          encaisser: totalEncaisser,
          recurrent: totalRecurrent,
          devisAFacturer: totalDevisAFacturer,
        },
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
