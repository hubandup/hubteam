import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fromFpSupplier,
  listSuppliers,
  normalizeCompanyName,
  readCredentials,
  type FpSupplier,
} from "../_shared/facturation-pro.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_PAGES = 40;

interface HubRow {
  id: string;
  company_name: string;
  iban: string | null;
  bic: string | null;
  facturation_pro_id: number | null;
}

type MatchKind = "id" | "api_custom" | "name" | "new";

interface Proposal {
  fp_id: number;
  fp_company_name: string;
  fp_city: string | null;
  match: MatchKind;
  hub_id: string | null;
  hub_company_name: string | null;
}

/**
 * Import des fournisseurs facturation.pro dans HubTeam.
 * mode = "preview" : rapprochement propose (api_custom, puis nom normalise).
 * mode = "apply"   : creation / mise a jour, selon les decisions confirmees.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Reserve aux administrateurs" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "apply" ? "apply" : "preview";
    /** decisions[fp_id] = hub_id | "new" | "skip" */
    const decisions = (body?.decisions ?? {}) as Record<string, string>;

    const creds = readCredentials();

    // 1. Recuperation paginee des fournisseurs facturation.pro
    const fpSuppliers: FpSupplier[] = [];
    let page = 1;
    while (page <= MAX_PAGES) {
      const res = await listSuppliers(creds, page);
      fpSuppliers.push(...res.data);
      const totalPages = res.pagination?.totalPages ?? 1;
      if (!res.data.length || page >= totalPages) break;
      page++;
    }

    // 2. Fournisseurs HubTeam existants
    const { data: hubRows, error: hubError } = await admin
      .from("suppliers")
      .select("id, company_name, iban, bic, facturation_pro_id");
    if (hubError) return json({ error: hubError.message }, 500);
    const hub = (hubRows ?? []) as HubRow[];

    const byFpId = new Map<number, HubRow>();
    const byUuid = new Map<string, HubRow>();
    const byName = new Map<string, HubRow>();
    for (const row of hub) {
      if (row.facturation_pro_id) byFpId.set(row.facturation_pro_id, row);
      byUuid.set(row.id, row);
      byName.set(normalizeCompanyName(row.company_name), row);
    }

    // 3. Rapprochement
    const proposals: Proposal[] = fpSuppliers.map((fp) => {
      const name = fp.company_name || [fp.first_name, fp.last_name].filter(Boolean).join(" ") || "Sans nom";
      const linked = byFpId.get(fp.id);
      const viaCustom = fp.api_custom ? byUuid.get(String(fp.api_custom).trim()) : undefined;
      const viaName = byName.get(normalizeCompanyName(name));
      const matched = linked ?? viaCustom ?? viaName ?? null;
      const kind: MatchKind = linked ? "id" : viaCustom ? "api_custom" : viaName ? "name" : "new";
      return {
        fp_id: fp.id,
        fp_company_name: name,
        fp_city: fp.city ?? null,
        match: kind,
        hub_id: matched?.id ?? null,
        hub_company_name: matched?.company_name ?? null,
      };
    });

    if (mode === "preview") {
      return json({
        success: true,
        total: fpSuppliers.length,
        pages: page,
        proposals,
      });
    }

    // 4. Application
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const fp of fpSuppliers) {
      const proposal = proposals.find((p) => p.fp_id === fp.id)!;
      const decision = decisions[String(fp.id)] ?? (proposal.hub_id ?? "new");
      if (decision === "skip") {
        skipped++;
        continue;
      }

      const targetId = decision === "new" ? null : decision;
      const existing = targetId ? byUuid.get(targetId) ?? null : null;
      const values = fromFpSupplier(fp, existing);

      try {
        if (targetId) {
          const { error } = await admin
            .from("suppliers")
            .update({
              ...values,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
              sync_error: null,
            })
            .eq("id", targetId);
          if (error) throw new Error(error.message);
          updated++;
        } else {
          const { error } = await admin.from("suppliers").insert({
            ...values,
            created_by: user.id,
            sync_status: "synced",
            synced_at: new Date().toISOString(),
            sync_error: null,
          } as never);
          if (error) throw new Error(error.message);
          created++;
        }
      } catch (err) {
        errors.push(`${proposal.fp_company_name} : ${err instanceof Error ? err.message : "erreur"}`);
      }
    }

    return json({ success: true, created, updated, skipped, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return json({ error: message }, 500);
  }
});
