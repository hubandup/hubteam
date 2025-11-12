import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    // Get invoice_id from query params
    const url = new URL(req.url)
    const invoiceId = url.searchParams.get('invoice_id')

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: 'invoice_id parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify invoice exists in database
    const { data: invoice, error: dbError } = await supabaseClient
      .from('invoices')
      .select('facturation_pro_id, invoice_number')
      .eq('id', invoiceId)
      .single()

    if (dbError || !invoice?.facturation_pro_id) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Downloading PDF for invoice ${invoice.facturation_pro_id}`)

    // Download PDF from Facturation.PRO
    const pdfResponse = await fetch(
      `${FACTURATION_PRO_API_URL}/firms/${firmId}/invoices/${invoice.facturation_pro_id}.pdf`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${apiId}:${apiKey}`)}`,
          'User-Agent': 'HubAndUp CRM (charles@hubandup.com)',
        },
      }
    )

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text()
      console.error('Facturation.PRO API error:', errorText)
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`)
    }

    // Get PDF as blob
    const pdfBlob = await pdfResponse.blob()

    // Return PDF to client
    return new Response(pdfBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="facture-${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error in download-invoice-pdf:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
