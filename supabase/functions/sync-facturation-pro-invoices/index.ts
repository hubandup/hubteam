import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const FACTURATION_PRO_API_URL = 'https://www.facturation.pro'

interface FacturationProInvoice {
  id: number
  customer_id: number
  invoice_ref: string
  title?: string
  total: string          // TTC
  total_pre_tax?: string // HT
  paid_on: string | null
  invoiced_on: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ── Auth guard ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  const xCronHeader = req.headers.get('x-cron-secret');
  let trigger = 'manual';
  if (xCronHeader) {
    if (xCronHeader !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    trigger = 'cron';
  } else {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const startedAt = Date.now();
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let syncedInvoices = 0;
  let skippedInvoices = 0;
  let autoCreatedClients = 0;
  let totalHT = 0;
  let totalTTC = 0;
  const missingCustomerIds = new Set<number>();

  try {
    const apiId = Deno.env.get('FACTURATION_PRO_API_ID')
    const apiKey = Deno.env.get('FACTURATION_PRO_API_KEY')
    const firmId = Deno.env.get('FACTURATION_PRO_FIRM_ID')
    if (!apiId || !apiKey || !firmId) {
      throw new Error('Missing Facturation.PRO API credentials')
    }
    const authHeader = `Basic ${btoa(`${apiId}:${apiKey}`)}`;

    console.log('Starting invoice synchronization from Facturation.PRO')

    // Fetch all invoices with pagination
    const allInvoices: FacturationProInvoice[] = []
    let page = 1
    while (true) {
      const r = await fetch(
        `${FACTURATION_PRO_API_URL}/firms/${firmId}/invoices.json?page=${page}&per_page=100`,
        { headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' } }
      )
      if (!r.ok) throw new Error(`Facturation.PRO API error (page ${page}): ${await r.text()}`)
      const pageInvoices: FacturationProInvoice[] = await r.json()
      console.log(`Page ${page}: ${pageInvoices.length} invoices`)
      if (pageInvoices.length === 0) break
      allInvoices.push(...pageInvoices)
      page++
      if (page > 200) break // safety
    }
    console.log(`Total fetched: ${allInvoices.length}`)

    // Cache to avoid lookup duplication
    const clientCache = new Map<string, string>(); // fp_customer_id -> client.id

    for (const fp of allInvoices) {
      const customerKey = fp.customer_id?.toString();
      if (!customerKey) { skippedInvoices++; continue; }

      let clientId = clientCache.get(customerKey);
      if (!clientId) {
        const { data: existingClient } = await supabaseClient
          .from('clients')
          .select('id')
          .eq('facturation_pro_id', customerKey)
          .maybeSingle();
        if (existingClient?.id) {
          clientId = existingClient.id;
        } else {
          // Auto-create minimal client by fetching its details
          try {
            const cr = await fetch(
              `${FACTURATION_PRO_API_URL}/firms/${firmId}/customers/${customerKey}.json`,
              { headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' } }
            );
            if (cr.ok) {
              const cust = await cr.json();
              const company = cust.company_name || cust.last_name || `Facturation #${customerKey}`;
              const { data: created } = await supabaseClient
                .from('clients')
                .insert({
                  company,
                  first_name: cust.first_name || null,
                  last_name: cust.last_name || null,
                  email: cust.email || null,
                  phone: cust.phone || null,
                  facturation_pro_id: customerKey,
                  facturation_pro_synced_at: new Date().toISOString(),
                  active: true,
                })
                .select('id')
                .single();
              if (created?.id) {
                clientId = created.id;
                autoCreatedClients++;
                console.log(`Auto-created client for FP customer ${customerKey} (${company})`);
              }
            }
          } catch (e) {
            console.warn(`Failed to auto-create client ${customerKey}:`, e);
          }
        }
        if (clientId) clientCache.set(customerKey, clientId);
      }

      if (!clientId) {
        missingCustomerIds.add(fp.customer_id);
        skippedInvoices++;
        continue;
      }

      const amountTTC = parseFloat(fp.total) || 0;
      const amountHT = fp.total_pre_tax != null ? parseFloat(fp.total_pre_tax) : amountTTC;
      totalTTC += amountTTC;
      totalHT += amountHT;

      const pdfUrl = `${FACTURATION_PRO_API_URL}/firms/${firmId}/invoices/${fp.id}.pdf`
      const invoiceData = {
        client_id: clientId,
        invoice_number: fp.invoice_ref,
        title: fp.title || null,
        amount: amountTTC,
        amount_ht: amountHT,
        status: fp.paid_on ? 'paid' : 'unpaid',
        invoice_date: fp.invoiced_on,
        facturation_pro_id: fp.id?.toString(),
        facturation_pro_pdf_url: pdfUrl,
      }

      const { data: existingInvoice } = await supabaseClient
        .from('invoices')
        .select('id')
        .eq('facturation_pro_id', fp.id?.toString())
        .maybeSingle();

      if (existingInvoice) {
        await supabaseClient.from('invoices').update(invoiceData).eq('id', existingInvoice.id);
      } else {
        await supabaseClient.from('invoices').insert(invoiceData);
      }
      syncedInvoices++;
    }

    console.log('Invoking calculate-client-revenue...');
    const { error: revenueError } = await supabaseClient.functions.invoke('calculate-client-revenue', {
      headers: { 'x-cron-secret': cronSecret ?? '' },
    });
    if (revenueError) console.error('Failed to calculate client revenue:', revenueError);

    // Log
    await supabaseClient.from('facturation_sync_log').insert({
      trigger,
      synced_invoices: syncedInvoices,
      skipped_invoices: skippedInvoices,
      auto_created_clients: autoCreatedClients,
      total_invoices: allInvoices.length,
      missing_customer_ids: Array.from(missingCustomerIds),
      total_ht: totalHT,
      total_ttc: totalTTC,
      duration_ms: Date.now() - startedAt,
    });

    return new Response(JSON.stringify({
      success: true,
      syncedInvoices, skippedInvoices, autoCreatedClients,
      totalInvoices: allInvoices.length,
      missingCustomerIds: Array.from(missingCustomerIds),
      totalHT, totalTTC,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in sync-facturation-pro-invoices:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabaseClient.from('facturation_sync_log').insert({
      trigger,
      synced_invoices: syncedInvoices,
      skipped_invoices: skippedInvoices,
      auto_created_clients: autoCreatedClients,
      missing_customer_ids: Array.from(missingCustomerIds),
      total_ht: totalHT,
      total_ttc: totalTTC,
      error: message,
      duration_ms: Date.now() - startedAt,
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
