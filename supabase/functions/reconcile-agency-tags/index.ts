// Reconcile legacy tags in agencies.tags with the expertises reference table.
// - Normalizes typographic differences (apostrophes, quotes, accents, spacing, case)
// - Maps unknown tags to existing expertises when a normalized match is found
// - dryRun=true (default): returns what would change without writing
// - dryRun=false: applies the rewrites to agencies.tags
// Auth: requires authenticated admin (verified via JWT + has_role check).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents
    .replace(/[\u2018\u2019\u02BC\u2032]/g, "'") // curly/prime quotes -> '
    .replace(/[\u201C\u201D\u2033]/g, '"') // curly double quotes -> "
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller identity via anon client + JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client for admin check + writes
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden (admin only)' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dryRun !== false; // default true

    // Load expertises (canonical names)
    const { data: expertises, error: expErr } = await admin
      .from('expertises')
      .select('nom, actif');
    if (expErr) throw expErr;

    // Map normalized -> canonical name (prefer active)
    const normMap = new Map<string, { nom: string; actif: boolean }>();
    for (const e of expertises || []) {
      const key = normalize(e.nom);
      const existing = normMap.get(key);
      if (!existing || (!existing.actif && e.actif)) {
        normMap.set(key, { nom: e.nom, actif: e.actif });
      }
    }

    // Load all agencies with tags
    const { data: agencies, error: agErr } = await admin
      .from('agencies')
      .select('id, name, tags')
      .not('tags', 'is', null);
    if (agErr) throw agErr;

    type Change = {
      agencyId: string;
      agencyName: string;
      before: string[];
      after: string[];
      remappings: { from: string; to: string }[];
      stillUnknown: string[];
    };

    const changes: Change[] = [];
    const globalRemap = new Map<string, string>(); // legacy -> canonical
    const globalUnknown = new Set<string>();

    for (const ag of agencies || []) {
      const tags: string[] = ag.tags || [];
      const after: string[] = [];
      const remappings: { from: string; to: string }[] = [];
      const stillUnknown: string[] = [];
      let mutated = false;

      for (const raw of tags) {
        if (!raw || typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;

        // Already canonical?
        const directHit = (expertises || []).find((e) => e.nom === trimmed);
        if (directHit) {
          after.push(trimmed);
          continue;
        }

        // Try normalized match
        const norm = normalize(trimmed);
        const match = normMap.get(norm);
        if (match) {
          after.push(match.nom);
          if (match.nom !== trimmed) {
            remappings.push({ from: trimmed, to: match.nom });
            globalRemap.set(trimmed, match.nom);
            mutated = true;
          }
        } else {
          // Unknown: keep as-is (no breaking change)
          after.push(trimmed);
          stillUnknown.push(trimmed);
          globalUnknown.add(trimmed);
        }
      }

      // Dedupe while preserving order
      const seen = new Set<string>();
      const deduped = after.filter((t) => {
        if (seen.has(t)) {
          mutated = true;
          return false;
        }
        seen.add(t);
        return true;
      });

      if (mutated) {
        changes.push({
          agencyId: ag.id,
          agencyName: ag.name,
          before: tags,
          after: deduped,
          remappings,
          stillUnknown,
        });
      }
    }

    // Apply if not dry run
    let applied = 0;
    if (!dryRun && changes.length > 0) {
      for (const c of changes) {
        const { error: updErr } = await admin
          .from('agencies')
          .update({ tags: c.after })
          .eq('id', c.agencyId);
        if (updErr) {
          console.error('Update failed for', c.agencyId, updErr);
          continue;
        }
        applied += 1;
      }
    }

    return new Response(
      JSON.stringify({
        dryRun,
        agenciesScanned: agencies?.length || 0,
        agenciesAffected: changes.length,
        applied,
        uniqueRemappings: Array.from(globalRemap.entries()).map(([from, to]) => ({
          from,
          to,
        })),
        stillUnknown: Array.from(globalUnknown).sort(),
        changes,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('reconcile-agency-tags error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
