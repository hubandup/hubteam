import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro'

interface FacturationProQuote {
  id: number
  client_id: number
  title: string
  status: string
  accepted_date?: string
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

    console.log('Checking for accepted quotes in Facturation.PRO')

    // Fetch all quotes from Facturation.PRO
    const quotesResponse = await fetch(
      `${FACTURATION_PRO_API_URL}/firms/${firmId}/quotes.json`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${apiId}:${apiKey}`)}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!quotesResponse.ok) {
      const errorText = await quotesResponse.text()
      throw new Error(`Facturation.PRO API error: ${errorText}`)
    }

    const quotes: FacturationProQuote[] = await quotesResponse.json()
    console.log(`Fetched ${quotes.length} quotes from Facturation.PRO`)

    // Filter for accepted quotes
    const acceptedQuotes = quotes.filter(q => q.status === 'accepted')
    console.log(`Found ${acceptedQuotes.length} accepted quotes`)

    let createdProjects = 0

    for (const quote of acceptedQuotes) {
      // Check if project already exists for this quote
      const { data: existingProject } = await supabaseClient
        .from('projects')
        .select('id')
        .eq('name', quote.title)
        .single()

      if (existingProject) {
        console.log(`Project already exists for quote ${quote.id}`)
        continue
      }

      // Find the corresponding client in our CRM
      const { data: client } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('facturation_pro_id', quote.client_id.toString())
        .single()

      if (!client) {
        console.warn(`Client not found for Facturation.PRO client_id: ${quote.client_id}`)
        continue
      }

      // Get the first admin user as project creator
      const { data: adminUser } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single()

      // Create the project
      const { data: newProject, error: projectError } = await supabaseClient
        .from('projects')
        .insert({
          name: quote.title,
          description: `Projet créé automatiquement depuis le devis accepté #${quote.id}`,
          status: 'active',
          start_date: quote.accepted_date || new Date().toISOString().split('T')[0],
          created_by: adminUser?.user_id,
        })
        .select()
        .single()

      if (projectError) {
        console.error(`Error creating project for quote ${quote.id}:`, projectError)
        continue
      }

      // Link the project to the client
      await supabaseClient
        .from('project_clients')
        .insert({
          project_id: newProject.id,
          client_id: client.id,
        })

      createdProjects++
      console.log(`Created project "${quote.title}" for accepted quote ${quote.id}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalQuotes: quotes.length,
        acceptedQuotes: acceptedQuotes.length,
        createdProjects,
        message: 'Quote check completed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in check-facturation-pro-quotes:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
