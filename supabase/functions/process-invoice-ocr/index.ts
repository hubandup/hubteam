// Process invoice: OCR via Lovable AI (Gemini) + upload to kDrive
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

const KDRIVE_FOLDER_ID = Deno.env.get("KDRIVE_INVOICES_FOLDER_ID") || "1";

// ---------- OCR via Lovable AI (Gemini supports PDFs natively) ----------
async function extractInvoiceFields(base64Pdf: string, mimeType: string) {
  const schema = {
    type: "object",
    properties: {
      supplier: { type: "string", description: "Nom du fournisseur / émetteur" },
      invoiceNumber: { type: "string", description: "Numéro de facture" },
      amountHT: { type: "number", description: "Montant total HT en euros" },
      amountTTC: { type: "number", description: "Montant total TTC en euros" },
      invoiceDate: { type: "string", description: "Date d'émission au format YYYY-MM-DD" },
      dueDate: { type: "string", description: "Date d'échéance au format YYYY-MM-DD" },
      paymentTerms: { type: "string", description: "Conditions de règlement (ex: '30 jours', 'Comptant')" },
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
            "Tu es un expert en extraction de données de factures fournisseurs françaises. Extrais précisément les champs demandés. Pour les dates, retourne YYYY-MM-DD. Pour les montants, retourne uniquement le nombre (point décimal).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrais les données de cette facture." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Pdf}` },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_invoice_data",
            description: "Sauvegarde les données extraites de la facture",
            parameters: schema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_invoice_data" } },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI OCR failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No structured output from AI");
  return JSON.parse(toolCall.function.arguments);
}

// ---------- kDrive upload via existing kdrive-api function ----------
async function uploadToKDrive(base64: string, fileName: string) {
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
      folderId: KDRIVE_FOLDER_ID,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("kDrive upload failed:", text);
    return null;
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileName, fileContent, mimeType } = await req.json();
    if (!fileName || !fileContent) {
      return new Response(JSON.stringify({ error: "fileName and fileContent (base64) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedMime = mimeType || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    console.log(`Processing invoice: ${fileName} (${detectedMime})`);

    // Run OCR + upload in parallel
    const [ocrResult, kdriveResult] = await Promise.allSettled([
      extractInvoiceFields(fileContent, detectedMime),
      uploadToKDrive(fileContent, fileName),
    ]);

    if (ocrResult.status === "rejected") {
      console.error("OCR error:", ocrResult.reason);
      return new Response(
        JSON.stringify({ error: "OCR extraction failed", details: String(ocrResult.reason) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const kdriveData = kdriveResult.status === "fulfilled" ? kdriveResult.value : null;

    return new Response(
      JSON.stringify({
        success: true,
        extracted: ocrResult.value,
        kdrive: kdriveData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-invoice-ocr error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
