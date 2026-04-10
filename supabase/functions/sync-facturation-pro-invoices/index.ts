import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro'

interface FacturationProInvoice {
  id: number
  customer_id: number
  invoice_ref: string
  title?: string
  total: string
  paid_on: string | null
  invoiced_on: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const apiId = Deno.env.get('FACTURATION_PRO_API_ID')
    const apiKey = Deno.env.get('FACTURATION_PRO_API_KEY')
    const firmId = Deno.env.get('FACTURATION_PRO_FIRM_ID')

    if (!apiId || !apiKey || !firmId) {
      throw new Error('Missing Facturation.PRO API credentials')
    }

    console.log('Starting invoice synchronization from Facturation.PRO')

    // Fetch all invoices from Facturation.PRO with pagination
    const allInvoices: FacturationProInvoice[] = []
    let page = 1
    let hasMorePages = true

    while (hasMorePages) {
      const invoicesResponse = await fetch(
        `${FACTURATION_PRO_API_URL}/firms/${firmId}/invoices.json?page=${page}`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${apiId}:${apiKey}`)}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!invoicesResponse.ok) {
        const errorText = await invoicesResponse.text()
        throw new Error(`Facturation.PRO API error: ${errorText}`)
      }

      const pageInvoices: FacturationProInvoice[] = await invoicesResponse.json()
      console.log(`Fetched ${pageInvoices.length} invoices from page ${page}`)
      
      if (pageInvoices.length === 0) {
        hasMorePages = false
      } else {
        allInvoices.push(...pageInvoices)
        page++
      }
    }

    console.log(`Total: ${allInvoices.length} invoices fetched from Facturation.PRO`)
    const facturationProInvoices = allInvoices

    let syncedInvoices = 0
    let skippedInvoices = 0
    const missingClientIds = new Set<number>()

    for (const fpInvoice of facturationProInvoices) {
      // Find the corresponding client in our CRM
      const { data: client } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('facturation_pro_id', fpInvoice.customer_id?.toString())
        .single()

      if (!client) {
        missingClientIds.add(fpInvoice.customer_id)
        skippedInvoices++
        continue
      }

      // Check if invoice already exists
      const { data: existingInvoice } = await supabaseClient
        .from('invoices')
        .select('id')
        .eq('facturation_pro_id', fpInvoice.id?.toString())
        .single()

      // Generate PDF URL
      const pdfUrl = `${FACTURATION_PRO_API_URL}/firms/${firmId}/invoices/${fpInvoice.id}.pdf`

      const invoiceData = {
        client_id: client.id,
        invoice_number: fpInvoice.invoice_ref,
        title: fpInvoice.title || null,
        amount: parseFloat(fpInvoice.total),
        status: fpInvoice.paid_on ? 'paid' : 'unpaid',
        invoice_date: fpInvoice.invoiced_on,
        facturation_pro_id: fpInvoice.id?.toString(),
        facturation_pro_pdf_url: pdfUrl,
      }

      if (existingInvoice) {
        // Update existing invoice
        await supabaseClient
          .from('invoices')
          .update(invoiceData)
          .eq('id', existingInvoice.id)
      } else {
        // Create new invoice
        await supabaseClient
          .from('invoices')
          .insert(invoiceData)
      }

      syncedInvoices++
    }

    // Step 4: Trigger revenue calculation for all clients
    console.log('Invoking calculate-client-revenue function...')
    const { error: revenueError } = await supabaseClient.functions.invoke('calculate-client-revenue')
    
    if (revenueError) {
      console.error('Failed to calculate client revenue:', revenueError)
    } else {
      console.log('Revenue calculation completed successfully')
    }

    console.log(`Synced ${syncedInvoices} invoices, skipped ${skippedInvoices}`)
    if (missingClientIds.size > 0) {
      console.warn(`Missing clients for customer IDs: ${Array.from(missingClientIds).join(', ')}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedInvoices,
        skippedInvoices,
        totalInvoices: facturationProInvoices.length,
        missingClientIds: Array.from(missingClientIds),
        message: 'Invoice synchronization completed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in sync-facturation-pro-invoices:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
