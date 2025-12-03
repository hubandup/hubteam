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

    console.log(`Fetching adhesions for fiscal year: ${fiscalYearStart.toISOString()} to ${fiscalYearEnd.toISOString()}`);
    
    // First, list all recurring invoices
    const listRecurringResponse = await fetch(
      `${FACTURATION_PRO_API_URL}/${firmId}/recurring_invoices.json?per_page=100`,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!listRecurringResponse.ok) {
      console.error(`Error listing recurring invoices: ${listRecurringResponse.status}`);
      throw new Error(`Failed to list recurring invoices: ${listRecurringResponse.status}`);
    }

    const allRecurringInvoices = await listRecurringResponse.json();
    console.log(`Found ${allRecurringInvoices.length} recurring invoices total`);

    // Filter recurring invoices by title containing "Adhésion Hub & Up"
    const adhesionRecurring = allRecurringInvoices.filter((ri: any) => {
      const title = ri.title || '';
      return title.toLowerCase().includes('adhésion hub');
    });

    console.log(`Found ${adhesionRecurring.length} adhesion recurring invoices`);

    let totalAdhesions = 0;
    const invoicesDetails: any[] = [];

    // For each matching recurring invoice, fetch generated invoices
    for (const recurringInvoice of adhesionRecurring) {
      try {
        console.log(`Processing recurring invoice ${recurringInvoice.id}: ${recurringInvoice.title}`);

        // Fetch invoices generated from this recurring invoice
        const invoicesResponse = await fetch(
          `${FACTURATION_PRO_API_URL}/${firmId}/invoices.json?recurring_invoice_id=${recurringInvoice.id}&per_page=100`,
          {
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!invoicesResponse.ok) {
          console.log(`Error fetching invoices for recurring ${recurringInvoice.id}: ${invoicesResponse.status}`);
          continue;
        }

        const invoices = await invoicesResponse.json();
        console.log(`Found ${invoices.length} invoices for recurring ${recurringInvoice.id}`);
        
        // Log first invoice for debugging
        if (invoices.length > 0) {
          const sample = invoices[0];
          console.log(`Sample invoice: date=${sample.invoiced_on}, status=${sample.status}, state=${sample.state}, total=${sample.total}`);
        }
        
        // Filter invoices within fiscal year (status check removed - all returned invoices are valid)
        for (const invoice of invoices) {
          const invoiceDateStr = invoice.invoiced_on || invoice.created_at;
          const invoiceDate = new Date(invoiceDateStr);
          const isInFiscalYear = invoiceDate >= fiscalYearStart && invoiceDate <= fiscalYearEnd;
          
          if (isInFiscalYear) {
            const amount = parseFloat(invoice.total) || 0;
            totalAdhesions += amount;
            
            invoicesDetails.push({
              reference: invoice.information || `FAC-${invoice.id}`,
              title: invoice.title || recurringInvoice.title,
              client: invoice.customer?.short_name || invoice.customer?.name || 'Unknown',
              amount: amount,
              date: invoice.invoiced_on,
              recurringId: recurringInvoice.id,
            });
            
            console.log(`Added invoice: ${invoice.information}, amount: ${amount}€, client: ${invoice.customer?.name}`);
          }
        }
      } catch (error) {
        console.error(`Error processing recurring invoice ${recurringInvoice.id}:`, error);
      }
    }

    // Sort by date descending
    invoicesDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`Total adhesions for fiscal year: ${totalAdhesions}€ from ${invoicesDetails.length} invoices`);

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
