import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro'

interface FacturationProClient {
  id: number
  company_name?: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
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

    const apiId = Deno.env.get('FACTURATION_PRO_API_ID')
    const apiKey = Deno.env.get('FACTURATION_PRO_API_KEY')
    const firmId = Deno.env.get('FACTURATION_PRO_FIRM_ID')

    if (!apiId || !apiKey || !firmId) {
      throw new Error('Missing Facturation.PRO API credentials')
    }

    console.log('Starting bidirectional client synchronization')

    // Step 1: Fetch all clients from Facturation.PRO with pagination
    const allClients: FacturationProClient[] = []
    let page = 1
    let hasMorePages = true

    while (hasMorePages) {
      const facturationProResponse = await fetch(
        `${FACTURATION_PRO_API_URL}/firms/${firmId}/customers.json?page=${page}`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${apiId}:${apiKey}`)}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!facturationProResponse.ok) {
        const errorText = await facturationProResponse.text()
        throw new Error(`Facturation.PRO API error: ${errorText}`)
      }

      const pageClients: FacturationProClient[] = await facturationProResponse.json()
      console.log(`Fetched ${pageClients.length} clients from page ${page}`)
      
      if (pageClients.length === 0) {
        hasMorePages = false
      } else {
        allClients.push(...pageClients)
        page++
      }
    }

    console.log(`Total: ${allClients.length} clients fetched from Facturation.PRO`)
    const facturationProClients = allClients

    // Step 2: Sync from Facturation.PRO to CRM
    let syncedFromFacturationPro = 0
    let createdClients = 0
    let updatedClients = 0
    let skippedClients = 0
    
    for (const fpClient of facturationProClients) {
      const { data: existingClient } = await supabaseClient
        .from('clients')
        .select('id, facturation_pro_id')
        .eq('facturation_pro_id', fpClient.id.toString())
        .maybeSingle()

      if (!fpClient.email) {
        console.warn(`Skipping client ${fpClient.id} - missing email`)
        skippedClients++
        continue
      }

      if (existingClient) {
        // Update existing client
        const { error: updErr } = await supabaseClient
          .from('clients')
          .update({
            company: fpClient.company_name || `${fpClient.first_name || ''} ${fpClient.last_name || ''}`.trim() || 'Client',
            first_name: fpClient.first_name || '',
            last_name: fpClient.last_name || '',
            email: fpClient.email,
            phone: fpClient.phone || null,
            facturation_pro_synced_at: new Date().toISOString(),
          })
          .eq('id', existingClient.id)

        if (updErr) {
          console.error('Failed to update client', existingClient.id, updErr)
          skippedClients++
          continue
        }
        updatedClients++
      } else {
        // Create new client
        const { error: insErr } = await supabaseClient
          .from('clients')
          .insert({
            company: fpClient.company_name || `${fpClient.first_name || ''} ${fpClient.last_name || ''}`.trim() || 'Client',
            first_name: fpClient.first_name || '',
            last_name: fpClient.last_name || '',
            email: fpClient.email,
            phone: fpClient.phone || null,
            facturation_pro_id: fpClient.id.toString(),
            facturation_pro_synced_at: new Date().toISOString(),
            kanban_stage: 'prospect',
            active: true,
          })

        if (insErr) {
          console.error('Failed to insert client', fpClient.id, insErr)
          skippedClients++
          continue
        }
        createdClients++
      }
      syncedFromFacturationPro++
    }

    console.log(`Synced ${syncedFromFacturationPro} clients from Facturation.PRO to CRM (${createdClients} created, ${updatedClients} updated, ${skippedClients} skipped)`)

    // Step 3: Sync from CRM to Facturation.PRO
    const { data: crmClients } = await supabaseClient
      .from('clients')
      .select('*')
      .is('facturation_pro_id', null)

    let syncedToCRM = 0
    if (crmClients) {
      for (const client of crmClients) {
        // Create client in Facturation.PRO
        const createResponse = await fetch(
          `${FACTURATION_PRO_API_URL}/firms/${firmId}/customers.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${apiId}:${apiKey}`)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              company_name: client.company,
              first_name: client.first_name,
              last_name: client.last_name,
              email: client.email,
              phone: client.phone || '',
            }),
          }
        )

        if (createResponse.ok) {
          const createdClient = await createResponse.json()
          
          // Update CRM client with Facturation.PRO ID
          await supabaseClient
            .from('clients')
            .update({
              facturation_pro_id: createdClient.id.toString(),
              facturation_pro_synced_at: new Date().toISOString(),
            })
            .eq('id', client.id)
          
          syncedToCRM++
        } else {
          console.error(`Failed to create client in Facturation.PRO: ${client.company}`)
        }
      }
    }

    console.log(`Synced ${syncedToCRM} clients from CRM to Facturation.PRO`)

    return new Response(
      JSON.stringify({
        success: true,
        totalClients: allClients.length,
        syncedFromFacturationPro,
        createdClients,
        updatedClients,
        skippedClients,
        syncedToFacturationPro: syncedToCRM,
        message: 'Bidirectional client synchronization completed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in sync-facturation-pro-clients:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
