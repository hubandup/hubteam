import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('Starting revenue calculation for all clients')

    // Calculate current fiscal year period (April 1 - March 31)
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // getMonth() returns 0-11

    let fiscalYearStart: string
    let fiscalYearEnd: string

    if (currentMonth >= 4) {
      // Between April and December: fiscal year is April currentYear to March nextYear
      fiscalYearStart = `${currentYear}-04-01`
      fiscalYearEnd = `${currentYear + 1}-03-31`
    } else {
      // Between January and March: fiscal year is April lastYear to March currentYear
      fiscalYearStart = `${currentYear - 1}-04-01`
      fiscalYearEnd = `${currentYear}-03-31`
    }

    console.log(`Current date: ${now.toISOString()}`)
    console.log(`Current month: ${currentMonth}, Current year: ${currentYear}`)
    console.log(`Fiscal year period: ${fiscalYearStart} to ${fiscalYearEnd}`)

    // Get all clients
    const { data: clients } = await supabaseClient
      .from('clients')
      .select('id, company')
    
    if (!clients) {
      throw new Error('No clients found')
    }

    let updatedCount = 0

    for (const client of clients) {
      // Calculate total revenue from all invoices
      const { data: allInvoices } = await supabaseClient
        .from('invoices')
        .select('amount')
        .eq('client_id', client.id)
      
      const revenue = allInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0

      // Calculate revenue for current fiscal year
      const { data: fiscalYearInvoices } = await supabaseClient
        .from('invoices')
        .select('amount')
        .eq('client_id', client.id)
        .gte('invoice_date', fiscalYearStart)
        .lte('invoice_date', fiscalYearEnd)
      
      const revenueCurrentYear = fiscalYearInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0
      
      // Update client revenue (both total and current year)
      await supabaseClient
        .from('clients')
        .update({ 
          revenue,
          revenue_current_year: revenueCurrentYear
        })
        .eq('id', client.id)
      
      updatedCount++
      if (updatedCount % 10 === 0) {
        console.log(`Updated ${updatedCount}/${clients.length} clients`)
      }
    }

    console.log(`Revenue calculation completed for ${updatedCount} clients`)

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount,
        message: `Revenue calculated for ${updatedCount} clients`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in calculate-client-revenue:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
