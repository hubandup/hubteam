import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  exceeded: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check and enforce rate limiting for a given key.
 * Uses the rate_limits table with service_role access.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const now = new Date();
  const windowStart = new Date(now.getTime() - options.windowSeconds * 1000);
  const expiresAt = new Date(now.getTime() + options.windowSeconds * 1000);

  // Clean up expired entries occasionally (1% chance per call)
  if (Math.random() < 0.01) {
    await supabaseAdmin
      .from("rate_limits")
      .delete()
      .lt("expires_at", now.toISOString());
  }

  // Check current count
  const { data: existing } = await supabaseAdmin
    .from("rate_limits")
    .select("count, window_start, expires_at")
    .eq("key", key)
    .single();

  if (existing) {
    const existingWindowStart = new Date(existing.window_start);
    
    // Window has expired, reset
    if (existingWindowStart < windowStart) {
      await supabaseAdmin
        .from("rate_limits")
        .update({
          count: 1,
          window_start: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("key", key);

      return {
        exceeded: false,
        remaining: options.max - 1,
        retryAfterSeconds: 0,
      };
    }

    // Window is active, check limit
    if (existing.count >= options.max) {
      const retryAfter = Math.ceil(
        (existingWindowStart.getTime() + options.windowSeconds * 1000 - now.getTime()) / 1000
      );
      return {
        exceeded: true,
        remaining: 0,
        retryAfterSeconds: Math.max(retryAfter, 1),
      };
    }

    // Increment count
    await supabaseAdmin
      .from("rate_limits")
      .update({ count: existing.count + 1 })
      .eq("key", key);

    return {
      exceeded: false,
      remaining: options.max - existing.count - 1,
      retryAfterSeconds: 0,
    };
  }

  // No existing record, create one
  await supabaseAdmin.from("rate_limits").insert({
    key,
    count: 1,
    window_start: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return {
    exceeded: false,
    remaining: options.max - 1,
    retryAfterSeconds: 0,
  };
}

/**
 * Helper to return a 429 response when rate limited
 */
export function rateLimitResponse(
  retryAfterSeconds: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: "Trop de requêtes. Veuillez réessayer plus tard.",
      retry_after: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        ...corsHeaders,
      },
    }
  );
}
