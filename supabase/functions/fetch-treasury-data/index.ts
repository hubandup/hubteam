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

function getMonthIndexInTimeZone(date: Date, timeZone: string): number {
  // month as 1..12
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).formatToParts(date);
  const monthStr = parts.find((p) => p.type === 'month')?.value;
  const month = Number(monthStr);
  if (!Number.isFinite(month) || month < 1 || month > 12) return date.getMonth();
  return month - 1;
}

function getRollingMonthLabels(count: number, startDate = new Date()): string[] {
  const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const startMonthIndex = getMonthIndexInTimeZone(startDate, 'Europe/Paris');

  return Array.from({ length: count }, (_, i) => {
    const idx = (startMonthIndex + i) % 12;
    return monthLabels[idx];
  });
}

async function fetchExcelData(accessToken: string): Promise<any[]> {
  const fileId = Deno.env.get('ONEDRIVE_TREASURY_FILE_ID');
  const driveId = Deno.env.get('ONEDRIVE_DRIVE_ID');

  if (!fileId || !driveId) {
    throw new Error('Missing OneDrive file ID or drive ID');
  }

  // Use drives/{driveId}/items/{itemId} for application-level access
  const baseUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/worksheets`;

  console.log('[TREASURY] Fetching worksheets from drive:', driveId, 'file:', fileId);

  const worksheetsResponse = await fetch(baseUrl, {
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

  // Fetch the specific range C4:N4 for month headers (row 4)
  const headersRangeUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(firstWorksheet.name)}')/range(address='C4:N4')`;

  const headersResponse = await fetch(headersRangeUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  // IMPORTANT: In this workbook, C70 is the current month balance and D70 is +1 month, etc.
  // So if headers are empty, we generate a rolling month list starting from the current month.
  const defaultMonths = getRollingMonthLabels(12);
  let monthHeaders: string[] = [];

  if (headersResponse.ok) {
    const headersData = await headersResponse.json();
    const rawHeaders = (headersData.values?.[0] || []).map((v: any) => String(v || '').trim());
    console.log('[TREASURY] Raw month headers:', rawHeaders);

    // Check if headers are mostly empty - if so, use rolling months from current month
    const nonEmptyCount = rawHeaders.filter((h: string) => h !== '').length;
    if (nonEmptyCount < 3) {
      console.log('[TREASURY] Headers mostly empty, using rolling months (current month + next 11)');
      monthHeaders = defaultMonths;
    } else {
      monthHeaders = rawHeaders;
    }
  } else {
    console.log('[TREASURY] Could not fetch headers, using rolling months (current month + next 11)');
    monthHeaders = defaultMonths;
  }
  console.log('[TREASURY] Final month headers:', monthHeaders);

  // Fetch the specific range C70:N70 for balance values
  const balanceRangeUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(firstWorksheet.name)}')/range(address='C70:N70')`;

  console.log('[TREASURY] Fetching balance range C70:N70');

  const balanceResponse = await fetch(balanceRangeUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!balanceResponse.ok) {
    const errorText = await balanceResponse.text();
    console.error('[TREASURY] Balance range error:', errorText);
    throw new Error(`Failed to fetch balance range: ${balanceResponse.status}`);
  }

  const balanceData = await balanceResponse.json();
  const balanceValues = balanceData.values?.[0] || [];

  console.log('[TREASURY] Balance values:', balanceValues);

  // Combine month headers with balance values
  const treasuryData: { month: string; balance: number }[] = [];

  for (let i = 0; i < balanceValues.length; i++) {
    const balanceValue = balanceValues[i];
    const monthLabel = monthHeaders[i] || `Mois ${i + 1}`;

    // Parse balance - handle string numbers with spaces/commas
    let balance = 0;
    if (typeof balanceValue === 'number') {
      balance = balanceValue;
    } else if (typeof balanceValue === 'string' && balanceValue.trim() !== '') {
      balance = parseFloat(balanceValue.replace(/\s/g, '').replace(',', '.')) || 0;
    }

    // Only add if we have a valid balance value
    if (balance !== 0 || balanceValue === 0) {
      treasuryData.push({
        month: monthLabel,
        balance: balance,
      });
    }
  }

  console.log('[TREASURY] Parsed', treasuryData.length, 'data points');

  return treasuryData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── CRON_SECRET guard ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  const providedSecret = req.headers.get('x-cron-secret');
  if (cronSecret && providedSecret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  try {
    console.log('[TREASURY] Starting fetch...');

    const accessToken = await getAccessToken();
    console.log('[TREASURY] Got access token');

    const treasuryData = await fetchExcelData(accessToken);
    console.log('[TREASURY] Successfully fetched treasury data');

    return new Response(
      JSON.stringify({
        success: true,
        data: treasuryData,
        lastUpdated: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[TREASURY] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
