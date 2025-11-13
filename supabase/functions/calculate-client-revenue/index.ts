import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting revenue calculation for all clients')

    // Get all clients
    const { data: clients } = await supabaseClient
      .from('clients')
      .select('id, company')
    
    if (!clients) {
      throw new Error('No clients found')
    }

    let updatedCount = 0

    for (const client of clients) {
      // Calculate total revenue from paid invoices
      const { data: invoices } = await supabaseClient
        .from('invoices')
        .select('amount')
        .eq('client_id', client.id)
        .eq('status', 'paid')
      
      const revenue = invoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0
      
      // Update client revenue
      await supabaseClient
        .from('clients')
        .update({ revenue })
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
