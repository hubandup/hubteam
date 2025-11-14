import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KDRIVE_API_BASE = 'https://api.infomaniak.com';
const KDRIVE_TOKEN = Deno.env.get('KDRIVE_API_TOKEN');

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

    const { action, driveId, folderId, folderPath, fileName, fileContent, parentId } = await req.json();

    console.log('KDrive API request:', { action, driveId, folderId, folderPath, fileName });

    const kdriveHeaders = {
      'Authorization': `Bearer ${KDRIVE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    let response;

    switch (action) {
      case 'list-drives':
        response = await fetch(`${KDRIVE_API_BASE}/1/drive`, {
          headers: kdriveHeaders,
        });
        break;

      case 'list-files':
        if (!driveId || !folderId) {
          throw new Error('driveId and folderId are required');
        }
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${folderId}?with=capabilities,categories,conversion,dropbox,path,users`,
          {
            headers: kdriveHeaders,
          }
        );
        break;

      case 'create-folder':
        if (!driveId || !parentId || !folderPath) {
          throw new Error('driveId, parentId, and folderPath are required');
        }
        response = await fetch(`${KDRIVE_API_BASE}/2/drive/${driveId}/files/${parentId}/directory`, {
          method: 'POST',
          headers: kdriveHeaders,
          body: JSON.stringify({
            name: folderPath.split('/').pop(),
          }),
        });
        break;

      case 'search-folder':
        if (!driveId || !folderPath) {
          throw new Error('driveId and folderPath are required');
        }
        // Search for folder by path
        response = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${driveId}/files/search?query=${encodeURIComponent(folderPath)}&types=dir`,
          {
            headers: kdriveHeaders,
          }
        );
        break;

      case 'upload-file':
        if (!driveId || !folderId || !fileName || !fileContent) {
          throw new Error('driveId, folderId, fileName, and fileContent are required');
        }
        
        // Decode base64 content
        const binaryData = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));
        
        const formData = new FormData();
        formData.append('file', new Blob([binaryData]), fileName);
        
        response = await fetch(`${KDRIVE_API_BASE}/2/drive/${driveId}/files/${folderId}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${KDRIVE_TOKEN}`,
          },
          body: formData,
        });
        break;

      case 'download-file':
        if (!driveId || !folderId) {
          throw new Error('driveId and folderId are required');
        }
        response = await fetch(`${KDRIVE_API_BASE}/2/drive/${driveId}/files/${folderId}/download`, {
          headers: kdriveHeaders,
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              content: base64,
              contentType: response.headers.get('content-type') 
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        break;

      case 'get-folder-info':
        if (!driveId || !folderId) {
          throw new Error('driveId and folderId are required');
        }
        response = await fetch(`${KDRIVE_API_BASE}/2/drive/${driveId}/files/${folderId}`, {
          headers: kdriveHeaders,
        });
        break;

      default:
        throw new Error('Invalid action');
    }

    if (!response) {
      throw new Error('No response from KDrive API');
    }

    const data = await response.json();
    
    if (!response.ok) {
      console.error('KDrive API error:', data);
      throw new Error(data.error || 'KDrive API error');
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in kdrive-api function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
