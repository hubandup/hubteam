// Sync supplier invoices from kDrive folders
// Folders scanned (under ADMINISTRATIF):
//   - FACTURES À TRAITER
//   - FACTURES FOURNISSEURS À PAYER
//   - _NEW
//   - _OLD
// New files (not yet in supplier_invoices.kdrive_file_id) are downloaded,
// OCR'ed via Lovable AI (Gemini), then inserted into supplier_invoices.
//
// Auth: admin JWT OR x-cron-secret header matching CRON_SECRET env.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const KDRIVE_API_BASE = "https://api.infomaniak.com";
const KDRIVE_TOKEN = Deno.env.get("KDRIVE_API_TOKEN")!;
const KDRIVE_PRODUCT_ID = Deno.env.get("KDRIVE_PRODUCT_ID") || "969307";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const MAX_FILES_PER_RUN = 10; // cap to stay under edge function timeout

const TARGET_FOLDERS = [
  "FACTURES À TRAITER",
  "FACTURES FOURNISSEURS À PAYER",
  "_NEW",
  "_OLD",
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// ---------- kDrive helpers ----------
const kdriveHeaders = { Authorization: `Bearer ${KDRIVE_TOKEN}` };

async function getDriveId(): Promise<string> {
  const res = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
  if (!res.ok) throw new Error(`product list failed: ${res.status}`);
  const json = await res.json();
  const product = json?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
  if (!product) throw new Error("kDrive product not found");
  return String(product.id);
}

async function listChildren(driveId: string, folderId: string | number): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const limit = 200;
  // Try v3 first
  while (true) {
    const url = `${KDRIVE_API_BASE}/3/drive/${driveId}/files/${folderId}/files?limit=${limit}&offset=${offset}`;
    const r = await fetch(url, { headers: kdriveHeaders });
    if (!r.ok) {
      if (offset === 0) {
        // Fallback v2
        const r2 = await fetch(
          `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${folderId}/children`,
          { headers: kdriveHeaders },
        );
        if (!r2.ok) throw new Error(`list children failed: ${r.status}`);
        const j2 = await r2.json();
        return j2?.data || [];
      }
      break;
    }
    const j = await r.json();
    const data = j?.data || [];
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

function isDir(c: any): boolean {
  const t = (c?.type || c?.kind || "").toString().toLowerCase();
  return t === "dir" || t === "folder" || t === "directory" || c?.is_dir === true;
}

async function findFolderByName(
  driveId: string,
  parentId: string | number,
  name: string,
): Promise<{ match: any | null; available: string[] }> {
  const children = await listChildren(driveId, parentId);
  const target = normalize(name);
  const dirs = children.filter(isDir);
  const match =
    dirs.find((c) => normalize(c.name || "") === target) ||
    dirs.find((c) => normalize(c.name || "").includes(target)) ||
    null;
  return { match, available: dirs.map((d) => d.name) };
}

async function downloadFileBase64(driveId: string, fileId: string | number): Promise<string> {
  const url = `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${fileId}/download`;
  const res = await fetch(url, { headers: kdriveHeaders });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // Convert to base64 in chunks to avoid stack overflow
  let bin = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buf.length; i += chunkSize) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunkSize));
  }
  return btoa(bin);
}

// ---------- OCR ----------
async function extractInvoiceFields(base64: string, mimeType: string) {
  const schema = {
    type: "object",
    properties: {
      supplier: { type: "string" },
      invoiceNumber: { type: "string" },
      amountHT: { type: "number" },
      amountTTC: { type: "number" },
      invoiceDate: { type: "string", description: "YYYY-MM-DD" },
      dueDate: { type: "string", description: "YYYY-MM-DD" },
      paymentTerms: { type: "string" },
    },
    required: ["supplier", "invoiceNumber", "amountHT", "amountTTC", "invoiceDate", "dueDate", "paymentTerms"],
    additionalProperties: false,
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en extraction de données de factures fournisseurs françaises. Extrais précisément les champs. Dates au format YYYY-MM-DD. Montants en nombre (point décimal).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrais les données de cette facture." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: { name: "save_invoice_data", parameters: schema },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_invoice_data" } },
    }),
  });
  if (!res.ok) throw new Error(`OCR ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call from AI");
  return JSON.parse(tc.function.arguments);
}

// ---------- Fiscal year helper (April 1 -> March 31) ----------
function fiscalYearLabel(isoDate?: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12
  const start = m >= 4 ? y : y - 1;
  return `${start}/${start + 1}`;
}

// ---------- Status mapping per source folder ----------
function statusForFolder(folder: string): "À payer" | "Payé" {
  // Files in _NEW and _OLD are archives, considered paid.
  if (folder === "_NEW" || folder === "_OLD") return "Payé";
  return "À payer";
}

// ---------- Main ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: cron secret OR service-role bearer OR admin JWT
    const cronHeader = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const isCron =
      (CRON_SECRET && cronHeader === CRON_SECRET) ||
      (bearer && bearer === SUPABASE_SERVICE_ROLE_KEY);
    let userId: string | null = null;

    if (!isCron) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (role?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Resolve drive and traverse to ADMINISTRATIF
    // kDrive root contains shared top-level folders like "Common documents" / "Documents communs"
    // and "Private" / "Privé". ADMINISTRATIF lives inside one of them — search recursively.
    const driveId = await getDriveId();
    let administratif: any = null;
    const rootLookup = await findFolderByName(driveId, 1, "ADMINISTRATIF");
    const triedPaths: string[] = ["/"];
    if (rootLookup.match) {
      administratif = rootLookup.match;
    } else {
      // Search inside each top-level folder
      const rootChildren = await listChildren(driveId, 1);
      for (const top of rootChildren.filter(isDir)) {
        triedPaths.push(`/${top.name}`);
        const sub = await findFolderByName(driveId, top.id, "ADMINISTRATIF");
        if (sub.match) {
          administratif = sub.match;
          break;
        }
      }
    }
    if (!administratif) {
      return new Response(
        JSON.stringify({
          error: "ADMINISTRATIF folder not found",
          driveId,
          searched_paths: triedPaths,
          available_root_folders: rootLookup.available,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Resolve the 4 target subfolders
    const folders: { name: string; id: string | number }[] = [];
    const missing: { name: string; available: string[] }[] = [];
    for (const name of TARGET_FOLDERS) {
      const f = await findFolderByName(driveId, administratif.id, name);
      if (f.match) folders.push({ name, id: f.match.id });
      else missing.push({ name, available: f.available });
    }

    // 3) Collect existing kdrive_file_ids
    const { data: existing } = await admin
      .from("supplier_invoices")
      .select("kdrive_file_id")
      .not("kdrive_file_id", "is", null);
    const seen = new Set((existing || []).map((r: any) => String(r.kdrive_file_id)));

    // 4) Walk each folder and process new files
    const processed: any[] = [];
    const errors: any[] = [];
    let budget = MAX_FILES_PER_RUN;

    for (const folder of folders) {
      if (budget <= 0) break;
      const children = await listChildren(driveId, folder.id);
      for (const child of children) {
        if (budget <= 0) break;
        if (child.type !== "file") continue;
        const lower = (child.name || "").toLowerCase();
        const isPdf = lower.endsWith(".pdf");
        const isJpg = lower.endsWith(".jpg") || lower.endsWith(".jpeg");
        if (!isPdf && !isJpg) continue;
        const fileIdStr = String(child.id);
        if (seen.has(fileIdStr)) continue;

        try {
          const mimeType = isPdf ? "application/pdf" : "image/jpeg";
          const b64 = await downloadFileBase64(driveId, child.id);
          const ocr = await extractInvoiceFields(b64, mimeType);
          const fy = fiscalYearLabel(ocr.invoiceDate);
          const status = statusForFolder(folder.name);
          const fileUrl = `${SUPABASE_URL}/functions/v1/kdrive-api?action=download&driveId=${driveId}&fileId=${child.id}`;

          const { error } = await admin.from("supplier_invoices").insert({
            supplier: ocr.supplier || "Inconnu",
            invoice_number: ocr.invoiceNumber || child.name,
            amount_ht: Number(ocr.amountHT) || 0,
            amount_ttc: Number(ocr.amountTTC) || 0,
            invoice_date: ocr.invoiceDate || null,
            due_date: ocr.dueDate || null,
            payment_terms: ocr.paymentTerms || "30 jours",
            status,
            payment_detail: status === "Payé" ? "Archivé kDrive" : "",
            file_url: fileUrl,
            remark: "",
            created_by: userId,
            kdrive_file_id: fileIdStr,
            kdrive_folder: folder.name,
            fiscal_year: fy,
          });

          if (error) throw error;

          processed.push({ folder: folder.name, name: child.name, fiscal_year: fy });
          seen.add(fileIdStr);
          budget--;
        } catch (e) {
          console.error(`Failed file ${child.name}:`, e);
          errors.push({ folder: folder.name, name: child.name, error: String(e) });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processed.length,
        processed,
        errors,
        missing_folders: missing,
        budget_remaining: budget,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-kdrive-supplier-invoices error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
