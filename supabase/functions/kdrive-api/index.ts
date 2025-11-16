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

    const { action, driveId, folderId, folderPath, fileName, fileContent, fileSize, parentId, rootFolderId, debugNoFilter, fileId, limit, offset, folderName } = await req.json();

    console.log('KDrive API request:', { action, driveId, folderId, folderPath, fileName });

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
        // Get the actual drive ID from product if not provided
        let createDriveId = driveId;
        if (!createDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            createDriveId = driveProduct?.id;
          }
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
        
        if (!createFolderName) {
          return new Response(
            JSON.stringify({ error: 'Folder name is required' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${createDriveId}/files/${createParentId}/directory`,
          {
            method: 'POST',
            headers: kdriveHeaders,
            body: JSON.stringify({ name: createFolderName })
          }
        );
        
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
        
        // Decode base64 content
        const base64Data = (typeof fileContent === 'string' && fileContent.includes(','))
          ? fileContent.split(',').pop()!
          : fileContent;
        const binaryString = atob(base64Data);
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
        // Add chunk_number and chunk_size as query parameters
        const chunkUrl = `${uploadBaseUrl}/3/drive/${uploadDriveId}/upload/session/${uploadTokenStr}/chunk?chunk_number=1&chunk_size=${bytes.length}`;
        console.info('Chunk upload debug:', {
          url: chunkUrl,
          method: 'POST',
          uploadBaseUrl,
          hasUploadUrl: !!(lastError as any)?._upload_url,
          chunkNumber: 1,
          chunkSize: bytes.length
        });
        
        const chunkResp = await fetch(
          chunkUrl,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${KDRIVE_TOKEN}`,
              'Content-Type': 'application/octet-stream',
              'Content-Length': String(bytes.length)
            },
            body: bytes
          }
        );
        
        if (!chunkResp.ok) {
          const errorData = await chunkResp.json().catch(() => ({}));
          console.error('Chunk upload failed:', chunkResp.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to upload file chunk', details: errorData }),
            { 
              status: chunkResp.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const chunkData = await chunkResp.json();
        console.info('Chunk upload response:', chunkData);
        
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
          const errorData = await finalizeResp.json().catch(() => ({}));
          console.error('Upload finalization failed:', finalizeResp.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to finalize upload', details: errorData }),
            { 
              status: finalizeResp.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const finalizeData = await finalizeResp.json();
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
        
        response = finalizeResp;
        break;

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
        
        // Convert to base64
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        
        return new Response(
          JSON.stringify({ data: base64 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

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
      case 'delete-folder':
        const deleteResponse = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${fileId}/trash`,
          { 
            method: 'POST',
            headers: kdriveHeaders 
          }
        );
        
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          console.error('Error deleting item:', deleteResponse.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to delete item', details: errorData }),
            { 
              status: deleteResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    console.log('Raw API response for list-files:', { 
      action, 
      targetFolderId: listTargetFolderId, 
      dataLength: Array.isArray(data?.data) ? data.data.length : 'NOT_ARRAY',
      debugNoFilter,
      dataType: typeof data?.data,
      isArray: Array.isArray(data?.data),
      allItems: Array.isArray(data?.data) ? data.data.map((f: any) => ({ id: f.id, name: f.name, parent_id: f.parent_id, type: f.type })) : data?.data,
      rawResponse: data
    });
    
    if (action === 'list-files' && !debugNoFilter && listTargetFolderId !== undefined && data && Array.isArray(data.data)) {
      const targetIdNum = Number(listTargetFolderId);
      const targetIdStr = String(listTargetFolderId);
      console.log('Filtering with:', { targetIdNum, targetIdStr, totalItems: data.data.length });
      
      const filtered = data.data.filter((item: any) => {
        const itemParentNum = Number(item.parent_id);
        const itemParentStr = String(item.parent_id);
        const matches = itemParentNum === targetIdNum || itemParentStr === targetIdStr;
        if (!matches) {
          console.log('Filtered out:', { name: item.name, parent_id: item.parent_id, expected: targetIdStr });
        }
        return matches;
      });
      
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
