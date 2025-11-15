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

    const { action, driveId, folderId, folderPath, fileName, fileContent, parentId, rootFolderId } = await req.json();

    console.log('KDrive API request:', { action, driveId, folderId, folderPath, fileName });

    const kdriveHeaders = {
      'Authorization': `Bearer ${KDRIVE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    let response;

    switch (action) {
      case 'check-permissions':
        // Only check product endpoint since we use product-based access
        const productResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
        const productOk = productResp.ok;
        const productData = await productResp.json().catch(() => ({}));
        
        console.log('Product endpoint response:', { status: productResp.status, ok: productOk, data: productData });
        
        if (!productOk) {
          const errorDetails = productData?.error?.description || productData?.error?.code || 'Unknown error';
          return new Response(
            JSON.stringify({ 
              hasRequiredScopes: false,
              errorDetails,
              message: 'Le token n\'a pas les permissions requises pour accéder aux produits'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if our configured product exists
        const products = productData?.data || [];
        const configuredProduct = products.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
        
        if (!configuredProduct) {
          return new Response(
            JSON.stringify({ 
              hasRequiredScopes: false,
              errorDetails: `Produit kDrive ${KDRIVE_PRODUCT_ID} non trouvé`,
              message: 'Le produit kDrive configuré n\'est pas accessible avec ce token'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            hasRequiredScopes: true,
            message: 'Token valide avec accès au kDrive Hub & Up'
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

        // IMPORTANT: Use unique_id as the drive ID for API v2 calls, not the product ID
        const drive = {
          id: driveProduct.unique_id, // This is the actual kDrive ID for API calls
          name: driveProduct.customer_name || 'Hub & Up',
          account_id: driveProduct.account_id,
          product_id: driveProduct.id, // Keep product ID for reference
        };

        console.log('Returning drive:', drive);

        return new Response(
          JSON.stringify({ data: [drive] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'list-files':
        // Build candidate drive IDs: provided one (if any) and the configured product's unique_id
        let providedDriveId = driveId;
        let productDriveId: string | undefined;
        try {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            productDriveId = driveProduct?.unique_id?.toString();
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
        console.log('Listing files candidates:', { candidateDriveIds, targetFolderId });

        const tryErrors: any[] = [];
        for (const did of candidateDriveIds) {
          console.log('Trying driveId:', did);
          const attempts = [
            `${KDRIVE_API_BASE}/2/drive/${did}/files?parent_id=${targetFolderId}`,
            `${KDRIVE_API_BASE}/2/drive/${did}/files/${targetFolderId}/children`,
            `${KDRIVE_API_BASE}/2/drive/${did}/files/${targetFolderId}/directory`,
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
            createDriveId = driveProduct?.unique_id;
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
        
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${createDriveId}/files/${createParentId}/directory`,
          {
            method: 'POST',
            headers: kdriveHeaders,
            body: JSON.stringify({ name: fileName })
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
            searchDriveId = driveProduct?.unique_id;
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
            uploadDriveId = driveProduct?.unique_id;
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
        const binaryString = atob(fileContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${uploadDriveId}/files/${uploadFolderId}/upload`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${KDRIVE_TOKEN}`,
              'Content-Type': 'application/octet-stream',
              'X-Filename': encodeURIComponent(fileName || 'file'),
            },
            body: bytes
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error uploading file:', response.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to upload file', details: errorData }),
            { 
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        break;

      case 'download-file':
        // Get the actual drive ID from product if not provided
        let downloadDriveId = driveId;
        if (!downloadDriveId) {
          const productsResp = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
          if (productsResp.ok) {
            const productsData = await productsResp.json();
            const driveProduct = productsData?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
            downloadDriveId = driveProduct?.unique_id;
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
        
        const fileId = folderId; // For download, folderId is actually the file ID
        
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${downloadDriveId}/files/${fileId}/download`,
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
            infoDriveId = driveProduct?.unique_id;
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

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    const data = await response.json();
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
