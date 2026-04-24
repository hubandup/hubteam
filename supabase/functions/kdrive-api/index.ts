import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KDRIVE_API_BASE = 'https://api.infomaniak.com';
const KDRIVE_TOKEN = Deno.env.get('KDRIVE_API_TOKEN');
const KDRIVE_PRODUCT_ID = Deno.env.get('KDRIVE_PRODUCT_ID') || '969307'; // Hub & Up

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle GET requests for file download proxy
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      
      if (action === 'download') {
        const driveId = url.searchParams.get('driveId');
        const fileId = url.searchParams.get('fileId');
        
        if (!driveId || !fileId) {
          return new Response(JSON.stringify({ error: 'Missing driveId or fileId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('=== PROXY DOWNLOAD REQUEST ===');
        console.log('Drive ID:', driveId);
        console.log('File ID:', fileId);

        // Fetch file from kDrive and stream it back
        const downloadUrl = `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${fileId}/download`;
        const kdriveHeaders = {
          'Authorization': `Bearer ${KDRIVE_TOKEN}`,
        };

        // Try to get original filename for Content-Disposition
        let originalName: string | null = null;
        try {
          const metaUrl = `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${fileId}`;
          const metaRes = await fetch(metaUrl, { headers: kdriveHeaders });
          if (metaRes.ok) {
            const metaJson = await metaRes.json();
            originalName = metaJson?.data?.name || metaJson?.data?.filename || null;
          } else {
            console.warn('Could not fetch file metadata for filename. Status:', metaRes.status);
          }
        } catch (e) {
          console.warn('Filename lookup failed:', e);
        }

        // Forward Range header if present (better PDF experience)
        const range = req.headers.get('range') || undefined;
        console.log('Request Range header:', range);

        console.log('Fetching from kDrive:', downloadUrl);
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: { ...kdriveHeaders, ...(range ? { Range: range } : {}) },
        });

        if (!response.ok && response.status !== 206) { // 206 is Partial Content
          console.error('kDrive download failed:', response.status, response.statusText);
          return new Response(JSON.stringify({ error: 'Failed to download file from kDrive' }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Stream the file back to the client with the same content-type
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length') || undefined;
        const contentRange = response.headers.get('content-range') || undefined;
        const acceptRanges = response.headers.get('accept-ranges') || 'bytes';
        console.log('✓ Streaming file back, content-type:', contentType, 'status:', response.status);
        
        // Determine if this is a PDF for proper headers
        const isPdf = contentType.includes('pdf') || (originalName?.toLowerCase().endsWith('.pdf') ?? false);
        
        // Sanitize filename for header
        const safeFilename = (originalName || `file${isPdf ? '.pdf' : ''}`).replace(/\r|\n|"/g, '').trim();
        
        // Allow forcing download via query (?dl=1 or ?download=true)
        const dlParam = url.searchParams.get('dl') || url.searchParams.get('download');
        const forceDownload = dlParam === '1' || dlParam === 'true';
        
        const contentDisposition = !forceDownload && isPdf
          ? `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
          : `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
        
        const headers: Record<string, string> = {
          ...corsHeaders,
          'Content-Type': isPdf ? 'application/pdf' : contentType,
          'Content-Disposition': contentDisposition,
          'Cache-Control': isPdf ? 'public, max-age=3600' : 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "frame-ancestors *",
          'Accept-Ranges': acceptRanges,
          'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type, Content-Length, Accept-Ranges, Content-Range',
        };

        if (!isPdf) {
          headers.Pragma = 'no-cache';
          headers.Expires = '0';
        }

        if (contentLength) headers['Content-Length'] = contentLength;
        if (contentRange) headers['Content-Range'] = contentRange;

        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, driveId, folderId, folderPath, fileName, fileContent, fileSize, parentId, rootFolderId, debugNoFilter, fileId, limit, offset, folderName, fileIds, newName, searchQuery } = await req.json();

    console.log('=== KDrive API Full Request ===');
    console.log('Action:', action);
    console.log('Drive ID:', driveId);
    console.log('Folder ID:', folderId);
    console.log('Parent ID:', parentId);
    console.log('Root Folder ID:', rootFolderId);
    console.log('File Name:', fileName);
    console.log('Folder Name:', folderName);
    console.log('Full body:', JSON.stringify({ action, driveId, folderId, folderPath, fileName, fileId, newName, parentId, rootFolderId }));

    const kdriveHeaders = {
      'Authorization': `Bearer ${KDRIVE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    let response;
    let listTargetFolderId: string | number | undefined;

    switch (action) {
      case 'check-permissions':
        // Check product endpoint and v2 files access
        const productResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
        const productOk = productResp.ok;
        const productData = await productResp.json().catch(() => ({}));
        console.log('Product endpoint response:', { status: productResp.status, ok: productOk });

        if (!productOk) {
          const errorDetails = productData?.error?.description || productData?.error?.code || 'Unknown error';
          return new Response(
            JSON.stringify({ 
              hasRequiredScopes: false,
              errorDetails,
              message: "Le token n'a pas les permissions requises pour accéder aux produits"
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const products = productData?.data || [];
        const configuredProduct = products.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
        if (!configuredProduct) {
          return new Response(
            JSON.stringify({ 
              hasRequiredScopes: false,
              errorDetails: `Produit kDrive ${KDRIVE_PRODUCT_ID} non trouvé`,
              message: "Le produit kDrive configuré n'est pas accessible avec ce token"
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify API v3 access using last_modified endpoint (minimum limit is 5)
        const driveIdToTest = configuredProduct.id; // Use product ID, not unique_id
        console.log('Testing API v3 access:', { 
          url: `${KDRIVE_API_BASE}/3/drive/${driveIdToTest}/files/last_modified?limit=5`,
          driveId: driveIdToTest,
          token: KDRIVE_TOKEN ? `${KDRIVE_TOKEN.substring(0, 10)}...` : 'MISSING'
        });
        
        const filesTest = await fetch(
          `${KDRIVE_API_BASE}/3/drive/${driveIdToTest}/files/last_modified?limit=5`,
          { headers: kdriveHeaders }
        );

        if (!filesTest.ok) {
          const err = await filesTest.json().catch(() => ({}));
          const errorDetails = err?.error?.description || err?.error?.code || `HTTP ${filesTest.status}`;
          console.error('API v3 test failed:', { status: filesTest.status, error: err });
          return new Response(
            JSON.stringify({ 
              hasRequiredScopes: false,
              errorDetails,
              message: filesTest.status === 401 
                ? "Le token n'a pas les droits API v3 (lecture) sur ce kDrive"
                : "Échec d'accès au kDrive via l'API v3",
              debugInfo: {
                testedUrl: `${KDRIVE_API_BASE}/3/drive/${driveIdToTest}/files/last_modified`,
                driveId: driveIdToTest,
                status: filesTest.status
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('API v3 test successful');

        return new Response(
          JSON.stringify({ 
            hasRequiredScopes: true,
            message: 'Token valide avec accès API v3 au kDrive'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      case 'list-drives':
        // Return the fixed drive from products
        const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
        
        if (!productsResp.ok) {
          console.error('Failed to load products:', productsResp.status);
          return new Response(
            JSON.stringify({ data: [], error: 'Failed to load products' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const productsData = await productsResp.json();
        const allProducts = productsData?.data || [];
        const driveProduct = allProducts.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));

        if (!driveProduct) {
          console.error('Configured kDrive product not found');
          return new Response(
            JSON.stringify({ data: [], error: 'Configured kDrive not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use product ID directly (not unique_id which doesn't exist in API response)
        const drive = {
          id: driveProduct.id, // Use product ID for API v3 calls
          name: driveProduct.customer_name || 'Hub & Up',
          account_id: driveProduct.account_id,
          product_id: driveProduct.id,
        };

        console.log('Returning drive:', drive);

        return new Response(
          JSON.stringify({ data: [drive] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'list-files':
        // Build candidate drive IDs: use product ID (not unique_id)
        let providedDriveId = driveId;
        let productDriveId: string | undefined;
        try {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            productDriveId = driveProduct?.id?.toString();
          }
        } catch (_) {}

        const candidateDriveIds = Array.from(new Set([providedDriveId, productDriveId].filter(Boolean))) as string[];
        if (candidateDriveIds.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const targetFolderId = folderId || rootFolderId || 1; // Use provided folder, root folder, or drive root
        listTargetFolderId = targetFolderId;
        const limitParam = typeof limit === 'number' ? limit : 50;
        const offsetParam = typeof offset === 'number' ? offset : 0;
        console.log('Listing files candidates:', { candidateDriveIds, targetFolderId, limitParam, offsetParam });

        const tryErrors: any[] = [];
        for (const did of candidateDriveIds) {
          console.log('Trying driveId:', did);
          const attempts = [
            `${KDRIVE_API_BASE}/3/drive/${did}/files/${targetFolderId}/files?limit=${limitParam}&offset=${offsetParam}`,
            `${KDRIVE_API_BASE}/3/drive/${did}/files/${targetFolderId}/children?limit=${limitParam}&offset=${offsetParam}`,
            `${KDRIVE_API_BASE}/3/drive/${did}/files?parent_id=${targetFolderId}&limit=${limitParam}&offset=${offsetParam}`,
            `${KDRIVE_API_BASE}/2/drive/${did}/files/${targetFolderId}/children`,
            `${KDRIVE_API_BASE}/2/drive/${did}/files?parent_id=${targetFolderId}`,
          ];

          for (const url of attempts) {
            const r = await fetch(url, { headers: kdriveHeaders });
            if (r.ok) {
              response = r;
              console.log('List-files succeeded with:', url);
              break;
            } else {
              const err = await r.json().catch(() => ({}));
              tryErrors.push({ driveIdTried: did, url, status: r.status, error: err });
              console.error('List-files failed attempt:', { driveId: did, url, status: r.status, err });
            }
          }

          if (response) break; // stop if succeeded for this drive
        }

        if (!response) {
          return new Response(
            JSON.stringify({ error: 'Failed to list files', attempts: tryErrors }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;

      case 'create-folder':
        console.log('=== CREATE FOLDER DEBUG ===');
        console.log('Received driveId:', driveId);
        console.log('Received parentId:', parentId);
        console.log('Received folderName:', folderName);
        console.log('Received rootFolderId:', rootFolderId);
        
        // Get the actual drive ID from product if not provided
        let createDriveId = driveId;
        if (!createDriveId) {
          console.log('No driveId provided, fetching from product...');
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            createDriveId = driveProduct?.id;
            console.log('Fetched driveId from product:', createDriveId);
          } else {
            console.error('Failed to fetch products:', productsResp.status);
          }
        }
        
        // Fallback to KDRIVE_PRODUCT_ID if still no drive ID
        if (!createDriveId) {
          createDriveId = KDRIVE_PRODUCT_ID;
          console.log('Using fallback KDRIVE_PRODUCT_ID:', createDriveId);
        }
        
        if (!createDriveId) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const createParentId = parentId || rootFolderId || 1;
        const createFolderName = folderName || fileName;
        
        console.log('Final values - driveId:', createDriveId, 'parentId:', createParentId, 'folderName:', createFolderName);
        
        if (!createFolderName) {
          return new Response(
            JSON.stringify({ error: 'Folder name is required' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const createFolderUrl = `${KDRIVE_API_BASE}/2/drive/${createDriveId}/files/${createParentId}/directory`;
        console.log('Creating folder at URL:', createFolderUrl);
        
        response = await fetch(
          createFolderUrl,
          {
            method: 'POST',
            headers: kdriveHeaders,
            body: JSON.stringify({ name: createFolderName })
          }
        );
        
        console.log('Create folder response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error creating folder:', response.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to create folder', details: errorData }),
            { 
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        break;

      case 'search-folder':
        // Get the actual drive ID from product if not provided
        let searchDriveId = driveId;
        if (!searchDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            searchDriveId = driveProduct?.id;
          }
        }
        
        if (!searchDriveId) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${searchDriveId}/files/search?query=${encodeURIComponent(folderPath || '')}`,
          { headers: kdriveHeaders }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error searching folder:', response.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to search folder', details: errorData }),
            { 
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        break;

      case 'resolve-path': {
        // Navigate a folder path like "CLIENTS/LAGOSTINA/_DATA" step by step
        // folderPath should be a "/" separated path of folder names from root
        let resolveDriveId = driveId;
        if (!resolveDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            resolveDriveId = driveProduct?.id;
          }
        }
        if (!resolveDriveId) {
          return new Response(JSON.stringify({ error: 'Drive ID not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const pathSegments = (folderPath || '').split('/').filter(Boolean);
        if (pathSegments.length === 0) {
          return new Response(JSON.stringify({ error: 'folderPath is required (e.g. CLIENTS/LAGOSTINA/_DATA)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let currentFolderId: string | number = 1; // root
        console.log('resolve-path: navigating', pathSegments, 'in drive', resolveDriveId);

        for (const segment of pathSegments) {
          const listUrl = `${KDRIVE_API_BASE}/3/drive/${resolveDriveId}/files/${currentFolderId}/files?limit=200`;
          console.log('resolve-path: listing', listUrl, 'looking for', segment);
          const listResp = await fetch(listUrl, { headers: kdriveHeaders });
          
          if (!listResp.ok) {
            // Fallback to v2
            const listUrl2: string = `${KDRIVE_API_BASE}/2/drive/${resolveDriveId}/files/${currentFolderId}/children`;
            const listResp2: Response = await fetch(listUrl2, { headers: kdriveHeaders });
            if (!listResp2.ok) {
              return new Response(JSON.stringify({ error: `Cannot list folder ${currentFolderId}`, segment }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            const listData2: any = await listResp2.json();
            const items2: any[] = listData2?.data || [];
            const found2: any = items2.find((f: any) => (f.name || '').toLowerCase() === segment.toLowerCase() && f.type === 'dir');
            if (!found2) {
              return new Response(JSON.stringify({ error: `Folder "${segment}" not found in ${currentFolderId}`, available: items2.filter((f: any) => f.type === 'dir').map((f: any) => f.name).slice(0, 20) }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            currentFolderId = found2.id;
            continue;
          }

          const listData = await listResp.json();
          const items = listData?.data || [];
          const found = items.find((f: any) => (f.name || '').toLowerCase() === segment.toLowerCase() && f.type === 'dir');
          if (!found) {
            return new Response(JSON.stringify({ error: `Folder "${segment}" not found in ${currentFolderId}`, available: items.filter((f: any) => f.type === 'dir').map((f: any) => f.name).slice(0, 20) }), {
              status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          currentFolderId = found.id;
          console.log('resolve-path: found', segment, '->', currentFolderId);
        }

        // Now list all files in the resolved folder
        const finalListUrl = `${KDRIVE_API_BASE}/3/drive/${resolveDriveId}/files/${currentFolderId}/files?limit=200`;
        const finalResp = await fetch(finalListUrl, { headers: kdriveHeaders });
        let finalFiles: any[] = [];
        if (finalResp.ok) {
          const finalData = await finalResp.json();
          finalFiles = (finalData?.data || []).map((f: any) => ({ ...f, drive_id: resolveDriveId }));
        } else {
          // v2 fallback
          const finalResp2 = await fetch(`${KDRIVE_API_BASE}/2/drive/${resolveDriveId}/files/${currentFolderId}/children`, { headers: kdriveHeaders });
          if (finalResp2.ok) {
            const finalData2 = await finalResp2.json();
            finalFiles = (finalData2?.data || []).map((f: any) => ({ ...f, drive_id: resolveDriveId }));
          }
        }

        console.log('resolve-path: resolved to', currentFolderId, 'with', finalFiles.length, 'items');
        return new Response(JSON.stringify({ data: finalFiles, folderId: currentFolderId, driveId: resolveDriveId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'upload-file':
        // Get the actual drive ID from product if not provided
        let uploadDriveId = driveId;
        if (!uploadDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            uploadDriveId = driveProduct?.id;
          }
        }
        
        if (!uploadDriveId) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const uploadFolderId = folderId || 1;
        
        // Decode base64 content safely (only for real uploads)
        if (typeof fileContent !== 'string') {
          console.error('Invalid fileContent type for upload:', { type: typeof fileContent });
          return new Response(
            JSON.stringify({ error: 'fileContent must be a base64 string for upload-file action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const base64Data = fileContent.includes(',') ? fileContent.split(',').pop()! : fileContent;
        console.log('Upload base64 meta:', {
          provided: !!fileContent,
          length: fileContent.length,
          sample: fileContent.substring(0, Math.min(50, fileContent.length)),
        });

        let binaryString: string;
        try {
          binaryString = atob(base64Data);
        } catch (e) {
          console.error('Base64 decode failed:', e);
          return new Response(
            JSON.stringify({ error: 'Failed to decode base64', details: { length: base64Data?.length ?? 0, sample: String(base64Data).substring(0, 50) } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use kDrive API v3 upload flow with upload tokens
        // Step 1: Create upload session and get upload token
        console.info(`Creating upload session for file: ${fileName} in folder: ${uploadFolderId}`);
        
        // Build payloads for kDrive upload session (batch API expects an array under `files`)
        const uploadPayloadFlat = {
          directory_id: Number(uploadFolderId),
          file_name: fileName || 'file',
          conflict: 'rename',
          total_size: typeof fileSize === 'number' ? fileSize : bytes.length,
          total_chunks: 1,
        };
        const batchPayload = { files: [ uploadPayloadFlat ] };

        // Debug: explicit values and types before request
        const ENABLE_LEGACY_FALLBACK = false;
        console.info('Upload precheck debug:', {
          uploadFolderId,
          typeofUploadFolderId: typeof uploadFolderId,
          numberDirId: Number(uploadFolderId),
          isDirIdFinite: Number.isFinite(Number(uploadFolderId)),
          fileSize,
          typeofFileSize: typeof fileSize,
          bytesLength: bytes.length,
          uploadPayloadFlat,
        });

        // Prefer official session start endpoint (batch)
        const sessionBatchUrl = `${KDRIVE_API_BASE}/3/drive/${uploadDriveId}/upload/session/batch/start`;
        console.info('Create upload session (batch) request:', {
          url: sessionBatchUrl,
          payload: batchPayload,
        });
        
        let uploadTokenStr: string | null = null;
        let lastError: any = null;
        
        const headersForBatch = {
          'Authorization': `Bearer ${KDRIVE_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
        };
        
        try {
          const bodyString = JSON.stringify(batchPayload);
          console.info('Batch request debug:', {
            url: sessionBatchUrl,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ***' },
            bodyString,
            filesIsArray: Array.isArray((batchPayload as any).files),
            filesLength: Array.isArray((batchPayload as any).files) ? (batchPayload as any).files.length : undefined,
          });
          const sessionResp = await fetch(sessionBatchUrl, {
            method: 'POST',
            headers: headersForBatch,
            body: bodyString
          });

          const respText = await sessionResp.text();
          let sessionData: any = {};
          try { sessionData = JSON.parse(respText); } catch (_) { /* keep raw */ }
          console.info('Session (batch) response:', { status: sessionResp.status, body: sessionData || respText });

          if (sessionResp.ok) {
            // Try multiple shapes defensively
            uploadTokenStr =
              sessionData?.data?.files?.[0]?.upload_token ||
              sessionData?.files?.[0]?.upload_token ||
              sessionData?.data?.[0]?.upload_token ||
              sessionData?.upload_token ||
              null;
            lastError = sessionData;
          } else {
            lastError = sessionData;
            console.error('Upload session (batch) failed:', sessionResp.status, sessionData);
          }
        } catch (e) {
          lastError = e;
          console.error('Upload session (batch) threw:', e);
        }
        // Try batch start with application/x-www-form-urlencoded
        try {
          const urlencoded = new URLSearchParams();
          urlencoded.append('files[0][directory_id]', String(uploadPayloadFlat.directory_id));
          urlencoded.append('files[0][file_name]', uploadPayloadFlat.file_name);
          urlencoded.append('files[0][total_size]', String(uploadPayloadFlat.total_size));
          urlencoded.append('files[0][total_chunks]', '1');
          urlencoded.append('files[0][conflict]', String(uploadPayloadFlat.conflict));
          console.info('Batch request (urlencoded) debug:', {
            url: sessionBatchUrl,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'Authorization': 'Bearer ***' },
            bodyString: urlencoded.toString(),
          });
          const urlEncResp = await fetch(sessionBatchUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${KDRIVE_TOKEN}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: urlencoded.toString(),
          });
          const urlEncText = await urlEncResp.text();
          let urlEncData: any = {};
          try { urlEncData = JSON.parse(urlEncText); } catch (_) { /* keep raw */ }
          console.info('Session (batch urlencoded) response:', { status: urlEncResp.status, body: urlEncData || urlEncText });
          if (urlEncResp.ok) {
            uploadTokenStr = urlEncData?.data?.files?.[0]?.upload_token ||
                             urlEncData?.files?.[0]?.upload_token ||
                             urlEncData?.data?.[0]?.upload_token ||
                             urlEncData?.upload_token || null;
            lastError = urlEncData;
          }
        } catch (e) {
          console.error('Batch urlencoded threw:', e);
        }
        
        // Fallback to multipart/form-data if still no token
        if (!uploadTokenStr) {
          try {
            const form = new FormData();
            form.append('files[0][directory_id]', String(uploadPayloadFlat.directory_id));
            form.append('files[0][file_name]', uploadPayloadFlat.file_name);
            form.append('files[0][total_size]', String(uploadPayloadFlat.total_size));
            form.append('files[0][total_chunks]', '1');
            form.append('files[0][conflict]', String(uploadPayloadFlat.conflict));
            console.info('Batch request (multipart) debug:', {
              url: sessionBatchUrl,
              headers: { 'Authorization': 'Bearer ***', 'Accept': 'application/json' },
              fields: [
                'files[0][directory_id]',
                'files[0][file_name]',
                'files[0][total_size]',
                'files[0][total_chunks]',
                'files[0][conflict]'
              ]
            });
            const mpResp = await fetch(sessionBatchUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${KDRIVE_TOKEN}`,
                'Accept': 'application/json',
              },
              body: form,
            });
            const mpText = await mpResp.text();
            let mpData: any = {};
            try { mpData = JSON.parse(mpText); } catch (_) { /* keep raw */ }
            console.info('Session (batch multipart) response:', { status: mpResp.status, body: mpData || mpText });
            if (mpResp.ok) {
              uploadTokenStr = mpData?.data?.files?.[0]?.upload_token ||
                               mpData?.files?.[0]?.upload_token ||
                               mpData?.data?.[0]?.upload_token ||
                               mpData?.upload_token || null;
              lastError = mpData;
            }
          } catch (e) {
            console.error('Batch multipart threw:', e);
          }
        }
        // Attempt single-file session start if batch didn't yield a token
        if (!uploadTokenStr) {
          const singleSessionUrl = `${KDRIVE_API_BASE}/3/drive/${uploadDriveId}/upload/session/start`;
          const singlePayload = { ...uploadPayloadFlat };
          const singleBody = JSON.stringify(singlePayload);
          console.info('Single session request debug:', {
            url: singleSessionUrl,
            bodyString: singleBody,
          });
          try {
            const singleResp = await fetch(singleSessionUrl, {
              method: 'POST',
              headers: headersForBatch,
              body: singleBody,
            });
            const singleText = await singleResp.text();
            let singleData: any = {};
            try { singleData = JSON.parse(singleText); } catch (_) { /* keep raw */ }
            console.info('Single session response:', { status: singleResp.status, body: singleData || singleText });
            if (singleResp.ok) {
              uploadTokenStr = singleData?.data?.token || singleData?.data?.upload_token || singleData?.upload_token || null;
              // Extract the upload_url provided by kDrive for chunk uploads
              const uploadUrl = singleData?.data?.upload_url || null;
              if (uploadUrl) {
                console.info('Upload URL from kDrive:', uploadUrl);
                // Store it for later use in chunk upload
                lastError = { ...singleData, _upload_url: uploadUrl };
              } else {
                lastError = singleData;
              }
            }
          } catch (e) {
            console.error('Single session request threw:', e);
          }
        }
        
        // Legacy fallback: old endpoint with flat body (kept for compatibility while we align the client)
          if (ENABLE_LEGACY_FALLBACK && !uploadTokenStr) {
          const legacySessionUrl = `${KDRIVE_API_BASE}/3/drive/${uploadDriveId}/upload`;
          console.info('Falling back to legacy create upload session:', {
            url: legacySessionUrl,
            payload: uploadPayloadFlat,
          });

          // Attempt 1: JSON
          try {
            const sessionResp = await fetch(legacySessionUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${KDRIVE_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(uploadPayloadFlat)
            });

            if (sessionResp.ok) {
              const sessionDataJson = await sessionResp.json();
              console.info('Session response (legacy json):', sessionDataJson);
              uploadTokenStr = sessionDataJson?.data?.upload_token || null;
              lastError = sessionDataJson;
            } else {
              lastError = await sessionResp.json().catch(() => ({}));
              console.error('Upload session (legacy json) failed:', sessionResp.status, lastError);
            }
          } catch (e) {
            lastError = e;
            console.error('Upload session (legacy json) threw:', e);
          }

          // Attempt 2: x-www-form-urlencoded fallback if no token
          if (!uploadTokenStr) {
            const formParams = new URLSearchParams({
              directory_id: String(uploadPayloadFlat.directory_id),
              file_name: uploadPayloadFlat.file_name,
              conflict: String(uploadPayloadFlat.conflict),
              total_size: String(uploadPayloadFlat.total_size),
            });

            console.info('Retrying legacy session with x-www-form-urlencoded:', {
              url: legacySessionUrl,
              form: Object.fromEntries(formParams.entries()),
            });

            const sessionRespForm = await fetch(legacySessionUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${KDRIVE_TOKEN}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formParams.toString(),
            });

            if (sessionRespForm.ok) {
              const sessionDataForm = await sessionRespForm.json();
              console.info('Session response (legacy form):', sessionDataForm);
              uploadTokenStr = sessionDataForm?.data?.upload_token || null;
              lastError = sessionDataForm;
            } else {
              const errForm = await sessionRespForm.json().catch(() => ({}));
              lastError = errForm;
              console.error('Upload session (legacy form) failed:', sessionRespForm.status, errForm);
            }
          }
        }

        if (!uploadTokenStr) {
          return new Response(
            JSON.stringify({ error: 'Failed to create upload session', details: lastError ?? 'no_token' }),
            { 
              status: 422,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.info(`Upload token received: ${uploadTokenStr.substring(0, 10)}...`);
        
        // Step 2: Upload file chunk using the upload_url from kDrive or fallback to API base
        const uploadBaseUrl = (lastError as any)?._upload_url || `${KDRIVE_API_BASE}`;
        // Build chunk URL (no extra query params; send metadata in body)
        const chunkUrl = `${uploadBaseUrl}/3/drive/${uploadDriveId}/upload/session/${uploadTokenStr}/chunk`;
        const chunkNumber = 1;
        const chunkSize = bytes.length;
        
        // Use multipart/form-data: kDrive expects chunk_number and chunk_size in the body
        const chunkForm = new FormData();
        chunkForm.append('chunk_number', String(chunkNumber));
        chunkForm.append('chunk_size', String(chunkSize));
        // Use field name 'chunk' for the binary as many APIs expect this exact name
        chunkForm.append('chunk', new Blob([bytes], { type: 'application/octet-stream' }), fileName || 'file');
        
        // Produce a safe log of form-data fields
        console.info('Chunk upload debug:', {
          url: chunkUrl,
          method: 'POST',
          contentType: 'multipart/form-data (auto-boundary)',
          uploadBaseUrl,
          hasUploadUrl: !!(lastError as any)?._upload_url,
          fields: {
            chunk_number: String(chunkNumber),
            chunk_size: String(chunkSize),
            chunk: { byteLength: bytes.length, fileName: fileName || 'file' }
          }
        });
        
        let chunkResp = await fetch(
          chunkUrl,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${KDRIVE_TOKEN}`,
              'Accept': 'application/json',
            },
            body: chunkForm
          }
        );
        
        // Fallback: try octet-stream + query params if validation complains about missing fields
        let chunkData: any = null;
        if (!chunkResp.ok) {
          const errorText = await chunkResp.text();
          let errorData: any = {};
          try { errorData = JSON.parse(errorText); } catch (_) { errorData = { raw: errorText }; }
          console.error('Chunk upload failed (multipart):', chunkResp.status, errorData);
          const needsFallback = chunkResp.status === 422 && JSON.stringify(errorData).includes('chunk')
          
          if (needsFallback) {
            const fallbackUrl = `${chunkUrl}?chunk_number=${chunkNumber}&chunk_size=${chunkSize}`;
            console.info('Retrying chunk upload with octet-stream + query params:', {
              url: fallbackUrl,
              method: 'POST',
              contentType: 'application/octet-stream',
              query: { chunk_number: chunkNumber, chunk_size: chunkSize },
              bodyByteLength: bytes.length
            });
            const fbResp = await fetch(fallbackUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${KDRIVE_TOKEN}`,
                'Content-Type': 'application/octet-stream',
                'Accept': 'application/json',
              },
              body: bytes,
            });
            if (!fbResp.ok) {
              const fbText = await fbResp.text();
              let fbErr: any = {};
              try { fbErr = JSON.parse(fbText); } catch (_) { fbErr = { raw: fbText }; }
              console.error('Chunk upload failed (fallback):', fbResp.status, fbErr);
              return new Response(
                JSON.stringify({ error: 'Failed to upload file chunk', details: fbErr }),
                { status: fbResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            const fbText = await fbResp.text();
            try { chunkData = JSON.parse(fbText); } catch (_) { chunkData = { raw: fbText }; }
            console.info('Chunk upload response (fallback):', chunkData);
          } else {
            return new Response(
              JSON.stringify({ error: 'Failed to upload file chunk', details: errorData }),
              { 
                status: chunkResp.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
        
        if (!chunkData) {
          const chunkText = await chunkResp.text();
          try { chunkData = JSON.parse(chunkText); } catch (_) { chunkData = { raw: chunkText }; }
          console.info('Chunk upload response:', chunkData);
        }
        
        if (chunkData.result !== 'success') {
          return new Response(
            JSON.stringify({ error: 'Chunk upload failed', details: chunkData }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Step 3: Finalize the upload using the same upload base URL
        const finalizeUrl = `${uploadBaseUrl}/3/drive/${uploadDriveId}/upload/session/${uploadTokenStr}/finish`;
        console.info('Finalize upload debug:', {
          url: finalizeUrl,
          method: 'POST'
        });
        
        const finalizeResp = await fetch(
          finalizeUrl,
          {
            method: 'POST',
            headers: kdriveHeaders,
            body: JSON.stringify({
              file_name: fileName || 'file'
            })
          }
        );
        
        if (!finalizeResp.ok) {
          const errText = await finalizeResp.text();
          let errorData: any = {};
          try { errorData = JSON.parse(errText); } catch (_) { errorData = { raw: errText }; }
          console.error('Upload finalization failed:', finalizeResp.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to finalize upload', details: errorData }),
            { 
              status: finalizeResp.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const finalizeText = await finalizeResp.text();
        let finalizeData: any = {};
        try { finalizeData = JSON.parse(finalizeText); } catch (_) { finalizeData = { raw: finalizeText }; }
        console.info('Upload finalized successfully:', finalizeData);
        
        if (finalizeData.result !== 'success') {
          return new Response(
            JSON.stringify({ error: 'Finalize failed', details: finalizeData }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Return here to avoid re-consuming the response body later
        return new Response(JSON.stringify(finalizeData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
        
        // no break needed since we returned

      case 'download-file':
        // Get the actual drive ID from product if not provided
        let downloadDriveId = driveId;
        if (!downloadDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            downloadDriveId = driveProduct?.id;
          }
        }
        
        if (!downloadDriveId) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const downloadFileId = fileId || folderId; // Support both legacy (folderId) and explicit fileId
        
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${downloadDriveId}/files/${downloadFileId}/download`,
          { headers: kdriveHeaders }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error downloading file:', response.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to download file', details: errorData }),
            { 
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Stream + chunked base64 to avoid memory blowups on large files.
        // The previous version built a JS string char-by-char from the full
        // ArrayBuffer, which exceeded the edge function memory limit.
        {
          const reader = response.body!.getReader();
          let binary = '';
          const CHUNK = 0x8000; // 32KB sub-chunks for fromCharCode.apply
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (let i = 0; i < value.length; i += CHUNK) {
              binary += String.fromCharCode.apply(
                null,
                value.subarray(i, i + CHUNK) as unknown as number[],
              );
            }
          }
          const base64 = btoa(binary);
          return new Response(
            JSON.stringify({ data: base64 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

      case 'get-folder-info':
        // Get the actual drive ID from product if not provided
        let infoDriveId = driveId;
        if (!infoDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            infoDriveId = driveProduct?.id;
          }
        }
        
        if (!infoDriveId) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const infoFolderId = folderId || 1;
        
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${infoDriveId}/files/${infoFolderId}`,
          { headers: kdriveHeaders }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error getting folder info:', response.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to get folder info', details: errorData }),
            { 
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        break;

      case 'delete-files':
        // Delete multiple files or folders at once
        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
          return new Response(
            JSON.stringify({ error: 'fileIds array is required' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Get the actual drive ID from product if not provided
        let batchDeleteDriveId = driveId;
        if (!batchDeleteDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            batchDeleteDriveId = driveProduct?.id;
          }
        }
        
        if (!batchDeleteDriveId) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Build numeric array once
        const fileIdsNum = fileIds.map((id: string | number) => Number(id));

        // Try official-looking batch endpoints first (v3 then v2) with multiple payload shapes
        const batchAttempts: Array<{
          url: string;
          method: 'POST' | 'DELETE';
          type: 'json' | 'urlencoded';
          body?: any;
          label: string;
        }> = [
          {
            url: `${KDRIVE_API_BASE}/3/drive/${batchDeleteDriveId}/files/trash`,
            method: 'POST',
            type: 'json',
            body: { file_ids: fileIdsNum },
            label: 'v3 files/trash (json file_ids)'
          },
          {
            url: `${KDRIVE_API_BASE}/2/drive/${batchDeleteDriveId}/files/trash`,
            method: 'POST',
            type: 'json',
            body: { file_ids: fileIdsNum },
            label: 'v2 files/trash (json file_ids)'
          },
          {
            url: `${KDRIVE_API_BASE}/3/drive/${batchDeleteDriveId}/files/delete`,
            method: 'POST',
            type: 'json',
            body: { files: fileIdsNum.map((id) => ({ id })) },
            label: 'v3 files/delete (json files[])'
          },
          {
            url: `${KDRIVE_API_BASE}/2/drive/${batchDeleteDriveId}/files/delete`,
            method: 'POST',
            type: 'json',
            body: { files: fileIdsNum.map((id) => ({ id })) },
            label: 'v2 files/delete (json files[])'
          },
          {
            url: `${KDRIVE_API_BASE}/3/drive/${batchDeleteDriveId}/files/trash`,
            method: 'POST',
            type: 'urlencoded',
            body: (() => { const u = new URLSearchParams(); fileIdsNum.forEach((id) => u.append('file_ids[]', String(id))); return u; })(),
            label: 'v3 files/trash (x-www-form-urlencoded file_ids[])'
          },
          {
            url: `${KDRIVE_API_BASE}/2/drive/${batchDeleteDriveId}/files/trash`,
            method: 'POST',
            type: 'urlencoded',
            body: (() => { const u = new URLSearchParams(); fileIdsNum.forEach((id) => u.append('file_ids[]', String(id))); return u; })(),
            label: 'v2 files/trash (x-www-form-urlencoded file_ids[])'
          }
        ];

        let batchSuccess = false;
        let batchData: any = null;
        const attemptsLog: any[] = [];

        for (const attempt of batchAttempts) {
          const headers: Record<string,string> = { 'Authorization': `Bearer ${KDRIVE_TOKEN}` };
          let bodyToSend: string | URLSearchParams | undefined;
          if (attempt.type === 'json') {
            headers['Content-Type'] = 'application/json';
            bodyToSend = JSON.stringify(attempt.body ?? {});
          } else {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            bodyToSend = (attempt.body as URLSearchParams).toString();
          }

          console.log('════════ DELETE-FILES attempt ════════');
          console.log('Label:', attempt.label);
          console.log('URL:', attempt.url);
          console.log('Method:', attempt.method);
          console.log('Headers:', { Authorization: 'Bearer [REDACTED]', 'Content-Type': headers['Content-Type'] });
          console.log('Raw body:', attempt.type === 'json' ? bodyToSend : bodyToSend);

          const r = await fetch(attempt.url, { method: attempt.method, headers, body: bodyToSend });
          const t = await r.text();
          let d: any = {};
          try { d = JSON.parse(t); } catch (_) { d = { raw: t }; }
          console.log('HTTP status:', r.status);
          console.log('Response:', d);
          attemptsLog.push({ label: attempt.label, url: attempt.url, status: r.status, response: d });

          if (r.ok) { batchSuccess = true; batchData = d; break; }
        }

        if (batchSuccess) {
          return new Response(
            JSON.stringify({ result: 'success', deletedIds: fileIdsNum, details: batchData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Batch failed, try per-file endpoints (v3 then v2) with different verbs
        const perFileDeleted: number[] = [];
        const perFileErrors: any[] = [];
        for (const fid of fileIdsNum) {
          const perFileAttempts: Array<{ url: string; method: 'POST' | 'DELETE'; label: string }> = [
            { url: `${KDRIVE_API_BASE}/3/drive/${batchDeleteDriveId}/files/${fid}/trash`, method: 'POST', label: 'v3 file trash (POST)' },
            { url: `${KDRIVE_API_BASE}/2/drive/${batchDeleteDriveId}/files/${fid}/trash`, method: 'POST', label: 'v2 file trash (POST)' },
            { url: `${KDRIVE_API_BASE}/3/drive/${batchDeleteDriveId}/files/${fid}`, method: 'DELETE', label: 'v3 file delete (DELETE)' },
            { url: `${KDRIVE_API_BASE}/2/drive/${batchDeleteDriveId}/files/${fid}`, method: 'DELETE', label: 'v2 file delete (DELETE)' },
          ];

          let done = false;
          for (const a of perFileAttempts) {
            console.log('— Per-file attempt:', { label: a.label, url: a.url, method: a.method });
            const r = await fetch(a.url, { method: a.method, headers: { 'Authorization': `Bearer ${KDRIVE_TOKEN}` } });
            const t = await r.text();
            let d: any = {};
            try { d = JSON.parse(t); } catch (_) { d = { raw: t }; }
            console.log('Per-file status:', r.status, 'response:', d);

            if (r.ok || r.status === 204) { perFileDeleted.push(fid); done = true; break; }
            perFileErrors.push({ fid, label: a.label, status: r.status, response: d });
          }
        }

        if (perFileDeleted.length === fileIdsNum.length) {
          return new Response(
            JSON.stringify({ result: 'success', deletedIds: perFileDeleted }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            error: 'Failed to delete files',
            details: {
              message: 'All attempts failed. See logs for each URL/method tried.',
              attempts: attemptsLog,
              perFileErrors
            }
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'get-file-details':
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${fileId}`,
          { headers: kdriveHeaders }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error getting file details:', response.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to get file details', details: errorData }),
            { 
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const fileDetailsData = await response.json();
        return new Response(
          JSON.stringify({ file: fileDetailsData.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'delete-file':
      case 'delete-folder': {
        if (!fileId) {
          return new Response(
            JSON.stringify({ error: 'fileId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Resolve driveId from product if not provided
        let resolvedDriveId = driveId;
        if (!resolvedDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            resolvedDriveId = driveProduct?.id;
          }
        }

        if (!resolvedDriveId) {
          return new Response(
            JSON.stringify({ error: 'Drive ID not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const fileIdNum = Number(fileId);

        // Per-file attempts (proven working in delete-files batch fallback)
        const singleAttempts: Array<{ url: string; method: 'POST' | 'DELETE'; label: string }> = [
          { url: `${KDRIVE_API_BASE}/3/drive/${resolvedDriveId}/files/${fileIdNum}/trash`, method: 'POST', label: 'v3 file trash (POST)' },
          { url: `${KDRIVE_API_BASE}/2/drive/${resolvedDriveId}/files/${fileIdNum}/trash`, method: 'POST', label: 'v2 file trash (POST)' },
          { url: `${KDRIVE_API_BASE}/3/drive/${resolvedDriveId}/files/${fileIdNum}`, method: 'DELETE', label: 'v3 file delete (DELETE)' },
          { url: `${KDRIVE_API_BASE}/2/drive/${resolvedDriveId}/files/${fileIdNum}`, method: 'DELETE', label: 'v2 file delete (DELETE)' },
        ];

        let lastError: any = null;
        for (const attempt of singleAttempts) {
          console.log('════ DELETE-FILE attempt:', attempt.label, attempt.method, attempt.url);
          const r = await fetch(attempt.url, {
            method: attempt.method,
            headers: { 'Authorization': `Bearer ${KDRIVE_TOKEN}` },
          });
          const t = await r.text();
          let d: any = {};
          try { d = JSON.parse(t); } catch (_) { d = { raw: t }; }
          console.log('HTTP status:', r.status, 'Response:', d);
          if (r.ok || r.status === 204) {
            return new Response(
              JSON.stringify({ success: true, data: d }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          lastError = { status: r.status, data: d };
        }

        return new Response(
          JSON.stringify({ error: 'Failed to delete item', details: lastError?.data }),
          { status: lastError?.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'rename':
        if (!fileId || !newName) {
          return new Response(JSON.stringify({ error: 'fileId and newName are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('=== RENAME FILE REQUEST ===');
        console.log('Drive ID:', driveId);
        console.log('File ID:', fileId);
        console.log('New Name:', newName);

        const renameAttempts = [
          { path: `/3/drive/${driveId}/files/${fileId}/rename`, method: 'POST' },
          { path: `/3/drive/${driveId}/file/${fileId}/rename`, method: 'POST' },
          { path: `/2/drive/${driveId}/files/${fileId}/rename`, method: 'POST' },
          { path: `/3/drive/${driveId}/files/${fileId}`, method: 'PATCH' },
        ];

        let renameError = null;

        for (const attempt of renameAttempts) {
          try {
            const renameUrl = `${KDRIVE_API_BASE}${attempt.path}`;
            const renamePayload = JSON.stringify({ name: newName });

            console.log('--- Rename Attempt ---');
            console.log('URL:', renameUrl);
            console.log('Method:', attempt.method);
            console.log('Payload:', renamePayload);

            const renameResp = await fetch(renameUrl, {
              method: attempt.method,
              headers: kdriveHeaders,
              body: renamePayload,
            });

            console.log('Response status:', renameResp.status);
            const renameData = await renameResp.json().catch(() => null);
            console.log('Response body:', JSON.stringify(renameData, null, 2));

            if (renameResp.ok && (renameData?.result === 'success' || renameData?.data)) {
              console.log('✓ Rename succeeded');
              return new Response(JSON.stringify({ result: 'success', fileId, newName }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            renameError = renameData;
          } catch (err) {
            console.error('Rename attempt failed:', err);
            renameError = { error: String(err) };
          }
        }

        return new Response(JSON.stringify({ error: 'Failed to rename file', details: renameError }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get-file-url':
        if (!fileId) {
          return new Response(JSON.stringify({ error: 'fileId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('=== GET FILE URL REQUEST ===');
        console.log('Drive ID:', driveId);
        console.log('File ID:', fileId);

        // Construct the proxy URL for the file download
        // The GET endpoint handler above will proxy the download from kDrive
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const proxyUrl = `${supabaseUrl}/functions/v1/kdrive-api?action=download&driveId=${driveId}&fileId=${fileId}`;
        
        console.log('✅ Returning proxy URL:', proxyUrl);

        return new Response(
          JSON.stringify({ 
            result: 'success',
            data: { url: proxyUrl }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    let data = await response.json();
    console.log('kDrive response summary:', {
      action,
      targetFolderId: listTargetFolderId,
      dataLength: Array.isArray(data?.data) ? data.data.length : 'NOT_ARRAY',
      debugNoFilter,
      dataType: typeof data?.data,
      isArray: Array.isArray(data?.data),
    });
    
    if (action === 'list-files' && !debugNoFilter && listTargetFolderId !== undefined && data && Array.isArray(data.data)) {
      const targetIdNum = Number(listTargetFolderId);
      const targetIdStr = String(listTargetFolderId);
      console.log('Filtering with:', { targetIdNum, targetIdStr, totalItems: data.data.length, searchQuery });
      
      let filtered = data.data.filter((item: any) => {
        const itemParentNum = Number(item.parent_id);
        const itemParentStr = String(item.parent_id);
        return itemParentNum === targetIdNum || itemParentStr === targetIdStr;
      });
      
      // Apply search filter if searchQuery is provided
      if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((item: any) => item.name && item.name.toLowerCase().includes(query));
        console.log('After search filtering:', { filteredLength: filtered.length, searchQuery: query });
      }
      
      console.log('After filtering:', { filteredLength: filtered.length });
      data = { ...data, data: filtered };
    } else if (debugNoFilter) {
      console.log('Debug mode: no filtering applied');
    }
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('KDrive API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
