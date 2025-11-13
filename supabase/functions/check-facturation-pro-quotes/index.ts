import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro'

interface FacturationProQuote {
  id: number
  customer_id: number
  title: string
  quote_status: number
  accepted_date?: string
  invoiced_on?: string
  fully_invoiced?: boolean
  ignore_quote?: boolean
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

    console.log('Checking for quotes in Facturation.PRO (statuses: À facturer, Soldé, accepted)')

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

    // Log the fields available in the first quote
    if (quotes.length > 0) {
      console.log('Available quote fields:', Object.keys(quotes[0]))
      console.log('First quote sample - id:', quotes[0].id, 'customer_id:', quotes[0].customer_id, 'title:', quotes[0].title?.substring(0, 30), 'quote_status:', quotes[0].quote_status)
    }

    // Log all unique quote_status values to identify the correct codes
    const uniqueStatuses = [...new Set(quotes.map(q => q.quote_status))]
    console.log('Unique quote_status values found:', uniqueStatuses)

    // Sample quotes with different statuses
    uniqueStatuses.forEach(status => {
      const sample = quotes.find(q => q.quote_status === status)
      if (sample) {
        console.log(`Status ${status} example:`, {
          id: sample.id,
          title: sample.title?.substring(0, 30),
          fully_invoiced: sample.fully_invoiced,
          ignore_quote: sample.ignore_quote
        })
      }
    })

    // Filter for quotes to create projects
    // Status 1 = À facturer (ready to invoice) -> create project
    const quotesToProcess = quotes.filter(q => q.quote_status === 1)
    console.log(`Found ${quotesToProcess.length} quotes to process (À facturer)`)

    // Filter for completed quotes from previous fiscal year to archive
    // Status 9 = Soldé (completed) -> archive if from previous fiscal year
    // Fiscal year: April 1 to March 31
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    
    // Calculate previous fiscal year end date (March 31 of current year if we're past April, or previous year if before April)
    const previousFiscalYearEnd = new Date(
      currentMonth >= 3 ? currentYear : currentYear - 1, // Year
      2, // March (0-indexed)
      31 // Last day
    )
    
    const completedQuotes = quotes.filter(q => {
      if (q.quote_status !== 9) return false
      // Check if quote was completed before the end of previous fiscal year
      const invoicedDate = q.invoiced_on ? new Date(q.invoiced_on) : null
      return invoicedDate && invoicedDate <= previousFiscalYearEnd
    })
    console.log(`Found ${completedQuotes.length} completed quotes from previous fiscal year to archive`)

    let createdProjects = 0
    let archivedProjects = 0

    // Process quotes to create projects
    for (const quote of quotesToProcess) {
      // Check if project already exists for this quote
      const { data: existingProject } = await supabaseClient
        .from('projects')
        .select('id, archived')
        .eq('name', quote.title)
        .single()

      if (existingProject && !existingProject.archived) {
        console.log(`Project already exists for quote ${quote.id}`)
        continue
      }

      // Find the corresponding client in our CRM
      const { data: client } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('facturation_pro_id', quote.customer_id.toString())
        .single()

      if (!client) {
        console.warn(`Client not found for Facturation.PRO customer_id: ${quote.customer_id}`)
        continue
      }

      // Get all admin users for notifications
      const { data: adminUsers } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      const firstAdmin = adminUsers?.[0]

      // Create the project
      const { data: newProject, error: projectError } = await supabaseClient
        .from('projects')
        .insert({
          name: quote.title,
          description: `Projet créé automatiquement depuis le devis #${quote.id}`,
          status: 'active',
          start_date: quote.accepted_date || new Date().toISOString().split('T')[0],
          created_by: firstAdmin?.user_id,
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

      // Create notifications for all admins
      if (adminUsers && adminUsers.length > 0) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.user_id,
          type: 'project_created',
          title: 'Nouveau projet créé automatiquement',
          message: `Le projet "${quote.title}" a été créé depuis un devis accepté`,
          link: `/projects/${newProject.id}`,
        }))

        await supabaseClient
          .from('notifications')
          .insert(notifications)
      }

      createdProjects++
      console.log(`Created project "${quote.title}" for quote ${quote.id} (status: ${quote.quote_status})`)
    }

    // Archive projects for completed quotes from previous fiscal year
    for (const quote of completedQuotes) {
      // Find the project by name
      const { data: project } = await supabaseClient
        .from('projects')
        .select('id, archived')
        .eq('name', quote.title)
        .single()

      if (!project) {
        console.log(`No project found for paid quote ${quote.id}`)
        continue
      }

      if (project.archived) {
        console.log(`Project for quote ${quote.id} is already archived`)
        continue
      }

      // Archive the project
      const { error: archiveError } = await supabaseClient
        .from('projects')
        .update({ archived: true })
        .eq('id', project.id)

      if (archiveError) {
        console.error(`Error archiving project for quote ${quote.id}:`, archiveError)
        continue
      }

      archivedProjects++
      console.log(`Archived project "${quote.title}" for completed quote ${quote.id} from previous fiscal year`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalQuotes: quotes.length,
        quotesToProcess: quotesToProcess.length,
        completedQuotesFromPreviousFiscalYear: completedQuotes.length,
        createdProjects,
        archivedProjects,
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
