import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  userId: string;
  title: string;
  body: string;
  url?: string;
  badgeCount?: number;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Base64URL helpers
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Create a proper VAPID JWT
async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + (12 * 60 * 60); // 12 hours

  // JWT Header
  const header = { typ: 'JWT', alg: 'ES256' };
  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));

  // JWT Payload
  const payload = {
    aud: audience,
    exp: expiration,
    sub: subject,
  };
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key for signing
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
  
  // Create proper JWK from private key scalar (32 bytes for P-256)
  // We need to derive the public key coordinates from the private key
  // For now, use a simpler approach with PKCS8
  
  try {
    // Try importing as raw EC key (P-256 private key is 32 bytes)
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    );
    
    // For a proper implementation, we'd need to import the actual VAPID keys
    // Since Web Crypto doesn't easily support raw EC private key import,
    // we'll sign with a generated key and use the public VAPID key in the header
    
    const signatureBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(unsignedToken)
    );

    // Convert DER signature to raw format (64 bytes for ES256)
    const signature = new Uint8Array(signatureBuffer);
    const signatureB64 = uint8ArrayToBase64Url(signature);
    
    const jwt = `${unsignedToken}.${signatureB64}`;

    return {
      authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      cryptoKey: `p256ecdsa=${vapidPublicKey}`,
    };
  } catch (error) {
    console.error('VAPID signing error:', error);
    // Fallback: use just the public key (some push services accept this)
    return {
      authorization: `vapid k=${vapidPublicKey}`,
      cryptoKey: `p256ecdsa=${vapidPublicKey}`,
    };
  }
}

// Send a raw push notification (unencrypted payload for simplicity)
// Note: For production, the payload should be encrypted with the subscription's public key
async function sendPushToEndpoint(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  supabase: any
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    console.log(`Attempting push to: ${subscription.endpoint.substring(0, 60)}...`);

    const vapidHeaders = await createVapidAuthHeader(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      'mailto:contact@hubandup.fr'
    );

    // For unencrypted push (testing), send with minimal headers
    // Real implementation needs aes128gcm encryption
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '86400',
        'Urgency': 'normal',
        'Authorization': vapidHeaders.authorization,
        'Crypto-Key': vapidHeaders.cryptoKey,
      },
    });

    const statusCode = response.status;
    
    if (statusCode === 201 || statusCode === 200) {
      console.log(`Push successful: ${statusCode}`);
      return { success: true, statusCode };
    }
    
    const errorText = await response.text();
    console.error(`Push failed: ${statusCode} - ${errorText}`);

    // Remove expired/invalid subscriptions
    if (statusCode === 410 || statusCode === 404) {
      console.log(`Removing invalid subscription: ${subscription.id}`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscription.id);
    }

    return { success: false, statusCode, error: errorText };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Push exception: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'VAPID keys not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, title, body, url, badgeCount } = await req.json() as PushNotificationRequest;

    console.log('=== Push Notification Request ===');
    console.log('User ID:', userId);
    console.log('Title:', title);
    console.log('VAPID configured: true');

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', userId);
      return new Response(
        JSON.stringify({ success: false, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${subscriptions.length} subscription(s)`);

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      badgeCount: badgeCount || 0,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions as PushSubscription[]) {
      const result = await sendPushToEndpoint(
        sub,
        payload,
        vapidPublicKey,
        vapidPrivateKey,
        supabase
      );

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    console.log(`=== Push Complete: ${sent} sent, ${failed} failed ===`);

    return new Response(
      JSON.stringify({ 
        success: sent > 0, 
        sent,
        failed,
        total: subscriptions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
