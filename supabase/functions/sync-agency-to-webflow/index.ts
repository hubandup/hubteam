import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webflowApiKey = Deno.env.get('WEBFLOW_API_KEY');
    const collectionId = Deno.env.get('WEBFLOW_COLLECTION_ID');

    if (!webflowApiKey || !collectionId) {
      throw new Error('WEBFLOW_API_KEY or WEBFLOW_COLLECTION_ID not configured');
    }

    const { agencyId, name, description, logoUrl, tags } = await req.json();

    console.log('Syncing agency to Webflow:', { agencyId, name });

    // Prepare item data for Webflow (v2 API uses fieldData, not fields)
    const fieldData = {
      'name': name || '',
      'slug': (name || 'agency').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      'logo': logoUrl || '',
      'description': description || '',
      'expertises': tags ? tags.join(', ') : '',
      'agency-id': agencyId,
    };

    // Check if item already exists in Webflow by searching for agency-id
    const searchResponse = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items?limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${webflowApiKey}`,
          'accept': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Webflow search failed: ${error}`);
    }

    const searchData = await searchResponse.json();
    const existingItem = searchData.items?.find((item: any) => 
      item.fieldData['agency-id'] === agencyId
    );

    let webflowResponse;

    if (existingItem) {
      // Update existing item
      console.log('Updating existing Webflow item:', existingItem.id);
      webflowResponse = await fetch(
        `https://api.webflow.com/v2/collections/${collectionId}/items/${existingItem.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${webflowApiKey}`,
            'accept': 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ fieldData }),
        }
      );
    } else {
      // Create new item
      console.log('Creating new Webflow item');
      webflowResponse = await fetch(
        `https://api.webflow.com/v2/collections/${collectionId}/items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${webflowApiKey}`,
            'accept': 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ fieldData }),
        }
      );
    }

    if (!webflowResponse.ok) {
      const error = await webflowResponse.text();
      console.error('Webflow API error:', error);
      throw new Error(`Webflow API error: ${error}`);
    }

    const result = await webflowResponse.json();
    console.log('Successfully synced to Webflow:', result);

    // Publish the item (if needed)
    if (result.id) {
      const publishResponse = await fetch(
        `https://api.webflow.com/v2/collections/${collectionId}/items/publish`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${webflowApiKey}`,
            'accept': 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ itemIds: [result.id] }),
        }
      );

      if (publishResponse.ok) {
        console.log('Item published successfully');
      } else {
        console.warn('Failed to publish item:', await publishResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ success: true, webflowItemId: result.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in sync-agency-to-webflow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});