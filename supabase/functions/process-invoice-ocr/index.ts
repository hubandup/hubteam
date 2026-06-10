// Process invoice: OCR via Lovable AI (Gemini) + upload to kDrive (ADMINISTRATIF/_NEW)
// Also emails the invoice file as attachment to cbaulu@gmail.com via Brevo.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";

const KDRIVE_API_BASE = "https://api.infomaniak.com";
const KDRIVE_TOKEN = Deno.env.get("KDRIVE_API_TOKEN") || "";
const KDRIVE_PRODUCT_ID = Deno.env.get("KDRIVE_PRODUCT_ID") || "969307";

const FORWARD_EMAIL = "cbaulu@gmail.com";

// ---------- kDrive helpers (resolve ADMINISTRATIF > _NEW) ----------
const kdriveHeaders = { Authorization: `Bearer ${KDRIVE_TOKEN}` };
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

async function getDriveId(): Promise<string> {
  const res = await fetch(`${KDRIVE_API_BASE}/1/product`, { headers: kdriveHeaders });
  if (!res.ok) throw new Error(`product list failed: ${res.status}`);
  const json = await res.json();
  const product = json?.data?.find((p: any) => String(p.id) === String(KDRIVE_PRODUCT_ID));
  if (!product) throw new Error("kDrive product not found");
  return String(product.id);
}

async function listChildren(driveId: string, folderId: string | number): Promise<any[]> {
  const r = await fetch(
    `${KDRIVE_API_BASE}/3/drive/${driveId}/files/${folderId}/files?limit=200&offset=0`,
    { headers: kdriveHeaders },
  );
  if (!r.ok) {
    const r2 = await fetch(
      `${KDRIVE_API_BASE}/2/drive/${driveId}/files/${folderId}/children`,
      { headers: kdriveHeaders },
    );
    if (!r2.ok) throw new Error(`list children failed: ${r.status}`);
    const j2 = await r2.json();
    return j2?.data || [];
  }
  const j = await r.json();
  return j?.data || [];
}

function isDir(c: any): boolean {
  const t = (c?.type || c?.kind || "").toString().toLowerCase();
  return t === "dir" || t === "folder" || t === "directory" || c?.is_dir === true;
}

async function findFolderByName(
  driveId: string,
  parentId: string | number,
  name: string,
): Promise<any | null> {
  const children = await listChildren(driveId, parentId);
  const target = normalize(name);
  const dirs = children.filter(isDir);
  return (
    dirs.find((c) => normalize(c.name || "") === target) ||
    dirs.find((c) => normalize(c.name || "").includes(target)) ||
    null
  );
}

async function resolveNewFolder(): Promise<{ driveId: string; folderId: string | number }> {
  const driveId = await getDriveId();
  let administratif = await findFolderByName(driveId, 1, "ADMINISTRATIF");
  if (!administratif) {
    const rootChildren = await listChildren(driveId, 1);
    for (const top of rootChildren.filter(isDir)) {
      const sub = await findFolderByName(driveId, top.id, "ADMINISTRATIF");
      if (sub) {
        administratif = sub;
        break;
      }
    }
  }
  if (!administratif) throw new Error("ADMINISTRATIF folder not found");
  const newFolder = await findFolderByName(driveId, administratif.id, "_NEW");
  if (!newFolder) throw new Error("ADMINISTRATIF/_NEW folder not found");
  return { driveId, folderId: newFolder.id };
}

// ---------- OCR via Lovable AI ----------
async function extractInvoiceFields(base64Pdf: string, mimeType: string) {
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
            "Tu es un expert en extraction de données de factures fournisseurs françaises. Dates YYYY-MM-DD. Montants en nombre (point décimal).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrais les données de cette facture." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Pdf}` } },
          ],
        },
      ],
      tools: [
        { type: "function", function: { name: "save_invoice_data", parameters: schema } },
      ],
      tool_choice: { type: "function", function: { name: "save_invoice_data" } },
    }),
  });

  if (!res.ok) throw new Error(`AI OCR failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No structured output from AI");
  return JSON.parse(toolCall.function.arguments);
}

// ---------- kDrive upload via existing kdrive-api function ----------
async function uploadToKDrive(
  base64: string,
  fileName: string,
  folderId: string | number,
  driveId: string,
) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/kdrive-api`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "upload-file",
      fileName,
      fileContent: base64,
      folderId,
      driveId,
    }),
  });
  if (!res.ok) {
    console.error("kDrive upload failed:", await res.text());
    return null;
  }
  return await res.json();
}

// ---------- Email forward via Brevo ----------
async function forwardByEmail(
  base64: string,
  fileName: string,
  mimeType: string,
  extracted: any,
) {
  if (!BREVO_API_KEY) {
    console.warn("BREVO_API_KEY missing — skipping email forward");
    return null;
  }
  const subject = `Nouvelle facture fournisseur : ${extracted?.supplier || "—"} — ${extracted?.invoiceNumber || fileName}`;
  const html = `
    <p>Bonjour,</p>
    <p>Une nouvelle facture fournisseur vient d'être uploadée dans la comptabilité Hub & Up.</p>
    <ul>
      <li><strong>Fournisseur :</strong> ${extracted?.supplier || "—"}</li>
      <li><strong>N° facture :</strong> ${extracted?.invoiceNumber || "—"}</li>
      <li><strong>Date :</strong> ${extracted?.invoiceDate || "—"}</li>
      <li><strong>Échéance :</strong> ${extracted?.dueDate || "—"}</li>
      <li><strong>Montant HT :</strong> ${extracted?.amountHT ?? "—"} €</li>
      <li><strong>Montant TTC :</strong> ${extracted?.amountTTC ?? "—"} €</li>
    </ul>
    <p>La facture est jointe à cet email et stockée dans kDrive (ADMINISTRATIF/_NEW).</p>
  `;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Hub & Up", email: "orga@hubandup.com" },
      to: [{ email: FORWARD_EMAIL }],
      subject,
      htmlContent: html,
      attachment: [{ name: fileName, content: base64 }],
    }),
  });
  if (!res.ok) {
    console.error("Brevo email failed:", res.status, await res.text());
    return null;
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileName, fileContent, mimeType } = await req.json();
    if (!fileName || !fileContent) {
      return new Response(JSON.stringify({ error: "fileName and fileContent (base64) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedMime = mimeType ||
      (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    console.log(`Processing invoice: ${fileName} (${detectedMime})`);

    // Resolve target folder (ADMINISTRATIF/_NEW)
    let target: { driveId: string; folderId: string | number } | null = null;
    try {
      target = await resolveNewFolder();
    } catch (e) {
      console.error("Failed to resolve _NEW folder:", e);
    }

    // Run OCR + upload + email forward in parallel
    const [ocrResult, kdriveResult, emailResult] = await Promise.allSettled([
      extractInvoiceFields(fileContent, detectedMime),
      target
        ? uploadToKDrive(fileContent, fileName, target.folderId, target.driveId)
        : Promise.resolve(null),
      // email runs after OCR via a thenable; we'll send a basic email if OCR fails too
      (async () => {
        // Wait briefly for OCR to enrich the email content (best-effort)
        return null;
      })(),
    ]);

    if (ocrResult.status === "rejected") {
      console.error("OCR error:", ocrResult.reason);
      return new Response(
        JSON.stringify({ error: "OCR extraction failed", details: String(ocrResult.reason) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const kdriveData = kdriveResult.status === "fulfilled" ? kdriveResult.value : null;

    // Send forward email with extracted metadata (non-blocking on failure)
    await forwardByEmail(fileContent, fileName, detectedMime, ocrResult.value).catch((e) =>
      console.error("Email forward error:", e),
    );

    return new Response(
      JSON.stringify({
        success: true,
        extracted: ocrResult.value,
        kdrive: kdriveData,
        emailed_to: FORWARD_EMAIL,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-invoice-ocr error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
