import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro/firms';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── CRON_SECRET guard ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  const providedSecret = req.headers.get('x-cron-secret');
  if (cronSecret && providedSecret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  try {
    const apiId = Deno.env.get('FACTURATION_PRO_API_ID');
    const apiKey = Deno.env.get('FACTURATION_PRO_API_KEY');
    const firmId = Deno.env.get('FACTURATION_PRO_FIRM_ID');

    if (!apiId || !apiKey || !firmId) {
      throw new Error('Missing Facturation.PRO API credentials');
    }

    const credentials = btoa(`${apiId}:${apiKey}`);
    
    // Calculate fiscal year dates (April 1 to March 31)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    
    let fiscalYearStart: Date;
    let fiscalYearEnd: Date;
    
    if (currentMonth >= 3) { // April (3) or later
      fiscalYearStart = new Date(currentYear, 3, 1); // April 1 current year
      fiscalYearEnd = new Date(currentYear + 1, 2, 31); // March 31 next year
    } else { // January to March
      fiscalYearStart = new Date(currentYear - 1, 3, 1); // April 1 previous year
      fiscalYearEnd = new Date(currentYear, 2, 31); // March 31 current year
    }

    console.log(`[ADHESIONS] Fetching for fiscal year: ${fiscalYearStart.toISOString()} to ${fiscalYearEnd.toISOString()}`);
    
    // First, fetch all categories to find "abonnements"
    const categoriesResponse = await fetch(
      `${FACTURATION_PRO_API_URL}/${firmId}/categories.json`,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!categoriesResponse.ok) {
      console.error(`Error fetching categories: ${categoriesResponse.status}`);
      throw new Error(`Failed to fetch categories: ${categoriesResponse.status}`);
    }

    const categories = await categoriesResponse.json();
    console.log(`[ADHESIONS] Found ${categories.length} categories`);
    
    // Find the "abonnements" category (case insensitive)
    const abonnementCategory = categories.find((cat: any) => 
      (cat.title || '').toLowerCase().includes('abonnement')
    );
    
    if (!abonnementCategory) {
      console.log(`[ADHESIONS] No 'abonnements' category found`);
      return new Response(
        JSON.stringify({
          total: 0,
          count: 0,
          invoices: [],
          fiscalYearStart: fiscalYearStart.toISOString(),
          fiscalYearEnd: fiscalYearEnd.toISOString(),
          error: "Catégorie 'abonnements' non trouvée"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    console.log(`[ADHESIONS] Found abonnements category: id=${abonnementCategory.id}, title=${abonnementCategory.title}`);
    
    // Fetch ALL invoices with pagination
    let allInvoices: any[] = [];
    let page = 1;
    const perPage = 50; // Facturation.PRO default limit
    let hasMore = true;
    
    while (hasMore) {
      const invoicesResponse = await fetch(
        `${FACTURATION_PRO_API_URL}/${firmId}/invoices.json?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!invoicesResponse.ok) {
        console.error(`Error fetching invoices page ${page}: ${invoicesResponse.status}`);
        throw new Error(`Failed to fetch invoices: ${invoicesResponse.status}`);
      }

      const pageInvoices = await invoicesResponse.json();
      console.log(`[ADHESIONS] Fetched ${pageInvoices.length} invoices from page ${page}`);
      
      if (pageInvoices.length === 0) {
        hasMore = false;
      } else {
        allInvoices = allInvoices.concat(pageInvoices);
        page++;
        
        // Safety limit to avoid infinite loops
        if (page > 50) {
          console.log(`[ADHESIONS] Reached page limit, stopping pagination`);
          hasMore = false;
        }
      }
    }
    
    console.log(`[ADHESIONS] Total invoices fetched: ${allInvoices.length}`);

    let totalAdhesions = 0;
    const invoicesDetails: any[] = [];

    // Filter invoices by category_id and fiscal year
    for (const invoice of allInvoices) {
      // Check if this invoice belongs to the abonnements category
      if (invoice.category_id !== abonnementCategory.id) continue;
      
      const invoiceDateStr = invoice.invoiced_on || invoice.created_at;
      const invoiceDate = new Date(invoiceDateStr);
      const isInFiscalYear = invoiceDate >= fiscalYearStart && invoiceDate <= fiscalYearEnd;
      
      if (isInFiscalYear) {
        const amount = parseFloat(invoice.total) || 0;
        totalAdhesions += amount;
        
        // customer_identity contains the client name
        const clientName = invoice.customer_identity || 'Client inconnu';
        
        invoicesDetails.push({
          reference: invoice.full_invoice_ref || invoice.invoice_ref || `FAC-${invoice.id}`,
          title: invoice.title || 'Adhésion',
          client: clientName,
          amount: amount,
          date: invoice.invoiced_on,
        });
        
        console.log(`[ADHESIONS] Added: ${invoice.full_invoice_ref}, ${amount}€, ${clientName}`);
      }
    }

    // Sort by date descending
    invoicesDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`[ADHESIONS] Total: ${totalAdhesions}€ from ${invoicesDetails.length} invoices`);

    return new Response(
      JSON.stringify({
        total: totalAdhesions,
        count: invoicesDetails.length,
        invoices: invoicesDetails,
        fiscalYearStart: fiscalYearStart.toISOString(),
        fiscalYearEnd: fiscalYearEnd.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching adhesions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
