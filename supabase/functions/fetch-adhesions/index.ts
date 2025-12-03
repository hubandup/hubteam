import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro/firms';

// Recurring invoice references for adhesions
const ADHESION_REFERENCES = ['32', '30', '29', '27', '26', '24', '23', '22', '10'];

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
    
    let totalAdhesions = 0;
    const invoicesDetails: any[] = [];

    // Fetch recurring invoices for each reference
    for (const ref of ADHESION_REFERENCES) {
      try {
        // Fetch the recurring invoice details
        const recurringResponse = await fetch(
          `${FACTURATION_PRO_API_URL}/${firmId}/recurring_invoices/${ref}.json`,
          {
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!recurringResponse.ok) {
          console.log(`Recurring invoice ${ref} not found or error: ${recurringResponse.status}`);
          continue;
        }

        const recurringInvoice = await recurringResponse.json();
        console.log(`Found recurring invoice ${ref}: ${recurringInvoice.title || 'No title'}`);

        // Fetch invoices generated from this recurring invoice
        const invoicesResponse = await fetch(
          `${FACTURATION_PRO_API_URL}/${firmId}/invoices.json?recurring_invoice_id=${ref}&per_page=100`,
          {
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!invoicesResponse.ok) {
          console.log(`Error fetching invoices for recurring ${ref}: ${invoicesResponse.status}`);
          continue;
        }

        const invoices = await invoicesResponse.json();
        
        // Filter invoices within fiscal year and with published status
        for (const invoice of invoices) {
          const invoiceDate = new Date(invoice.invoiced_on || invoice.created_at);
          
          // Check if invoice is within fiscal year and is published (status 2 = published)
          if (invoiceDate >= fiscalYearStart && invoiceDate <= fiscalYearEnd && invoice.status >= 2) {
            const amount = parseFloat(invoice.total) || 0;
            totalAdhesions += amount;
            
            invoicesDetails.push({
              reference: invoice.information,
              title: invoice.title || recurringInvoice.title,
              client: invoice.customer?.short_name || invoice.customer?.name || 'Unknown',
              amount: amount,
              date: invoice.invoiced_on,
              recurringRef: ref,
            });
          }
        }
      } catch (error) {
        console.error(`Error processing recurring invoice ${ref}:`, error);
      }
    }

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
