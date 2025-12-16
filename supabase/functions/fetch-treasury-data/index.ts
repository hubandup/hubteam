import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID');
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Microsoft credentials');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token error:', errorText);
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchExcelData(accessToken: string): Promise<any[]> {
  const fileId = Deno.env.get('ONEDRIVE_TREASURY_FILE_ID');
  const driveId = Deno.env.get('ONEDRIVE_DRIVE_ID');
  
  if (!fileId || !driveId) {
    throw new Error('Missing OneDrive file ID or drive ID');
  }

  // Use drives/{driveId}/items/{itemId} for application-level access
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/worksheets`;
  
  console.log('[TREASURY] Fetching worksheets from drive:', driveId, 'file:', fileId);
  
  const worksheetsResponse = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!worksheetsResponse.ok) {
    const errorText = await worksheetsResponse.text();
    console.error('[TREASURY] Worksheets error:', errorText);
    throw new Error(`Failed to fetch worksheets: ${worksheetsResponse.status}`);
  }

  const worksheetsData = await worksheetsResponse.json();
  const firstWorksheet = worksheetsData.value?.[0];
  
  if (!firstWorksheet) {
    throw new Error('No worksheet found in the Excel file');
  }

  console.log('[TREASURY] Using worksheet:', firstWorksheet.name);

  // Fetch the used range data
  const rangeUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(firstWorksheet.name)}')/usedRange`;
  
  const rangeResponse = await fetch(rangeUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!rangeResponse.ok) {
    const errorText = await rangeResponse.text();
    console.error('[TREASURY] Range error:', errorText);
    throw new Error(`Failed to fetch data range: ${rangeResponse.status}`);
  }

  const rangeData = await rangeResponse.json();
  const values = rangeData.values || [];

  console.log('[TREASURY] Fetched', values.length, 'rows');

  // Parse the data - assume first row is headers
  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((h: any) => String(h || '').toLowerCase().trim());
  const rows = values.slice(1);

  // Try to find month and balance columns
  const monthIndex = headers.findIndex((h: string) => 
    h.includes('mois') || h.includes('month') || h.includes('date') || h.includes('période')
  );
  const balanceIndex = headers.findIndex((h: string) => 
    h.includes('solde') || h.includes('balance') || h.includes('trésorerie') || h.includes('total')
  );

  console.log('[TREASURY] Column indices - month:', monthIndex, 'balance:', balanceIndex);
  console.log('[TREASURY] Headers:', headers);

  // If we can't find specific columns, use first two columns
  const mIdx = monthIndex >= 0 ? monthIndex : 0;
  const bIdx = balanceIndex >= 0 ? balanceIndex : 1;

  const treasuryData = rows
    .filter((row: any[]) => row[mIdx] && row[bIdx] !== undefined && row[bIdx] !== null && row[bIdx] !== '')
    .map((row: any[]) => {
      const monthValue = row[mIdx];
      const balanceValue = row[bIdx];
      
      // Parse balance - handle string numbers with spaces/commas
      let balance = 0;
      if (typeof balanceValue === 'number') {
        balance = balanceValue;
      } else if (typeof balanceValue === 'string') {
        balance = parseFloat(balanceValue.replace(/\s/g, '').replace(',', '.')) || 0;
      }

      return {
        month: String(monthValue),
        balance: balance,
      };
    });

  console.log('[TREASURY] Parsed', treasuryData.length, 'data points');
  
  return treasuryData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TREASURY] Starting fetch...');
    
    const accessToken = await getAccessToken();
    console.log('[TREASURY] Got access token');
    
    const treasuryData = await fetchExcelData(accessToken);
    console.log('[TREASURY] Successfully fetched treasury data');

    return new Response(JSON.stringify({
      success: true,
      data: treasuryData,
      lastUpdated: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TREASURY] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
