import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const LOGO_URL =
  `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/email-images/po%2Flogo-hubandup-horizontal.png`;

const INK = rgb(0, 12 / 255, 31 / 255); // #000c1f
const ACCENT = rgb(232 / 255, 255 / 255, 76 / 255); // #E8FF4C
const GREY = rgb(0.45, 0.47, 0.52);
const LIGHT = rgb(0.88, 0.89, 0.91);

const A4 = { w: 595.28, h: 841.89 };
const M = 42; // marge

const clean = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  return s ? s : null;
};

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

const fmtEUR = (v: number | string | null | undefined, currency = "EUR") => {
  const n = Number(v ?? 0);
  const s = n
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d)(?=.*,))/g, "\u00a0");
  return `${s} ${currency === "EUR" ? "€" : currency}`;
};

const fmtRate = (v: number | string | null | undefined) =>
  `${Number(v ?? 0).toFixed(2).replace(".", ",")} %`;

// pdf-lib standard fonts only encode WinAnsi; strip anything outside it.
const sanitize = (s: string) =>
  s
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    // deno-lint-ignore no-control-regex
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff\u20ac]/g, "");

interface Ctx {
  page: ReturnType<PDFDocument["addPage"]>;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}

function wrap(text: string, font: Ctx["font"], size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of sanitize(text).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        out.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    out.push(current);
  }
  return out.length ? out : [""];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const poId = typeof body?.poId === "string" ? body.poId : "";
    if (!/^[0-9a-f-]{36}$/i.test(poId)) return json({ error: "Identifiant de PO invalide" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: po, error: poError } = await admin
      .from("purchase_orders")
      .select("*, suppliers(*), purchase_categories(name)")
      .eq("id", poId)
      .maybeSingle();
    if (poError) throw poError;
    if (!po) return json({ error: "Bon de commande introuvable" }, 404);

    const { data: company } = await admin.from("company_settings").select("*").limit(1).maybeSingle();
    const supplier = po.suppliers as Record<string, string | null> | null;
    const categoryName = (po.purchase_categories as { name?: string } | null)?.name ?? null;

    const pdf = await PDFDocument.create();
    pdf.setTitle(`Bon de commande ${po.po_number}`);
    pdf.setProducer("Hub & Up");
    const page = pdf.addPage([A4.w, A4.h]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const text = (
      s: string,
      x: number,
      y: number,
      opts: { size?: number; bold?: boolean; color?: typeof INK; align?: "left" | "right" } = {},
    ) => {
      const size = opts.size ?? 9;
      const f = opts.bold ? bold : font;
      const value = sanitize(s);
      const px = opts.align === "right" ? x - f.widthOfTextAtSize(value, size) : x;
      page.drawText(value, { x: px, y, size, font: f, color: opts.color ?? INK });
    };

    const contentW = A4.w - M * 2;

    // ---- En-tête : logo + bandeau numéro ----
    let logoDrawn = false;
    try {
      const res = await fetch(LOGO_URL);
      if (res.ok) {
        const img = await pdf.embedPng(new Uint8Array(await res.arrayBuffer()));
        const scaled = img.scaleToFit(130, 40);
        page.drawImage(img, { x: M, y: A4.h - M - scaled.height, width: scaled.width, height: scaled.height });
        logoDrawn = true;
      }
    } catch (_) {
      logoDrawn = false;
    }
    if (!logoDrawn) text("HUB + UP", M, A4.h - M - 22, { size: 20, bold: true });

    // Bandeau accent avec le numéro de PO en très forte évidence
    const badgeW = 220;
    const badgeH = 58;
    const badgeX = A4.w - M - badgeW;
    const badgeY = A4.h - M - badgeH;
    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: badgeH, color: ACCENT });
    text("BON DE COMMANDE", badgeX + badgeW - 12, badgeY + badgeH - 17, { size: 8, bold: true, align: "right" });
    text(String(po.po_number), badgeX + badgeW - 12, badgeY + 22, { size: 17, bold: true, align: "right" });
    text(`Validé le ${fmtDate(po.validation_date)}`, badgeX + badgeW - 12, badgeY + 10, {
      size: 8,
      align: "right",
    });

    let y = badgeY - 24;
    page.drawRectangle({ x: M, y, width: contentW, height: 3, color: ACCENT });
    y -= 26;

    // ---- Blocs émetteur / fournisseur ----
    const emitter = [
      clean(company?.legal_name) ?? "Hub & Up",
      clean(company?.address_1),
      clean(company?.address_2),
      [clean(company?.postal_code), clean(company?.city)].filter(Boolean).join(" ") || null,
      clean(company?.country),
      company?.siret ? `SIRET : ${company.siret}` : null,
      company?.vat_number ? `TVA intracom. : ${company.vat_number}` : null,
      clean(company?.phone),
      clean(company?.accounting_email),
    ].filter(Boolean) as string[];

    const supplierBlock = [
      clean(supplier?.company_name) ?? "—",
      [clean(supplier?.first_name), clean(supplier?.last_name)].filter(Boolean).join(" ") || null,
      clean(supplier?.address_1),
      clean(supplier?.address_2),
      [clean(supplier?.postal_code), clean(supplier?.city)].filter(Boolean).join(" ") || null,
      clean(supplier?.country),
      supplier?.vat_number ? `TVA intracom. : ${supplier.vat_number}` : null,
      clean(supplier?.email),
      clean(supplier?.phone),
    ].filter(Boolean) as string[];

    const colW = (contentW - 20) / 2;
    const colRight = M + colW + 20;
    text("ÉMETTEUR", M, y, { size: 8, bold: true, color: GREY });
    text("FOURNISSEUR", colRight, y, { size: 8, bold: true, color: GREY });
    y -= 6;
    page.drawRectangle({ x: M, y, width: colW, height: 1, color: LIGHT });
    page.drawRectangle({ x: colRight, y, width: colW, height: 1, color: LIGHT });
    y -= 14;

    const rows = Math.max(emitter.length, supplierBlock.length);
    for (let i = 0; i < rows; i++) {
      if (emitter[i]) text(emitter[i], M, y - i * 12, { size: 9, bold: i === 0 });
      if (supplierBlock[i]) text(supplierBlock[i], colRight, y - i * 12, { size: 9, bold: i === 0 });
    }
    y -= rows * 12 + 18;

    // ---- Tableau récapitulatif ----
    const rowLines: Array<[string, string]> = [
      ["N° de dossier Hub & Up", String(po.hubup_dossier_ref ?? "—")],
      ["N° de devis fournisseur", clean(po.supplier_quote_ref) ?? "—"],
      ["Catégorie d'achat", categoryName ?? "—"],
    ];

    page.drawRectangle({ x: M, y: y - 18, width: contentW, height: 18, color: INK });
    text("RÉCAPITULATIF DE LA COMMANDE", M + 8, y - 13, { size: 8, bold: true, color: rgb(1, 1, 1) });
    y -= 18;

    for (const [label, value] of rowLines) {
      page.drawRectangle({ x: M, y: y - 20, width: contentW, height: 20, borderColor: LIGHT, borderWidth: 0.7 });
      text(label, M + 8, y - 14, { size: 9, color: GREY });
      text(value, M + contentW - 8, y - 14, { size: 9, bold: true, align: "right" });
      y -= 20;
    }

    // Descriptif
    const descLines = wrap(clean(po.description) ?? "—", font, 9, contentW - 16);
    const descH = 16 + descLines.length * 11 + 8;
    page.drawRectangle({ x: M, y: y - descH, width: contentW, height: descH, borderColor: LIGHT, borderWidth: 0.7 });
    text("DESCRIPTIF", M + 8, y - 12, { size: 8, bold: true, color: GREY });
    descLines.forEach((l, i) => text(l, M + 8, y - 26 - i * 11, { size: 9 }));
    y -= descH;

    // Montants
    const amountRows: Array<[string, string, boolean]> = [
      ["Montant HT", fmtEUR(po.amount_ht, po.currency), false],
      [`TVA (${fmtRate(po.vat_rate)})`, fmtEUR(po.amount_vat, po.currency), false],
      ["Montant TTC", fmtEUR(po.amount_ttc, po.currency), true],
    ];
    const amtX = M + contentW / 2;
    for (const [label, value, strong] of amountRows) {
      page.drawRectangle({
        x: amtX,
        y: y - 22,
        width: contentW / 2,
        height: 22,
        color: strong ? ACCENT : undefined,
        borderColor: LIGHT,
        borderWidth: 0.7,
      });
      text(label, amtX + 10, y - 15, { size: strong ? 10 : 9, bold: strong });
      text(value, M + contentW - 10, y - 15, { size: strong ? 11 : 9, bold: true, align: "right" });
      y -= 22;
    }
    y -= 18;

    // ---- Règlement ----
    text("Date de règlement prévue", M, y, { size: 8, bold: true, color: GREY });
    text(fmtDate(po.payment_date), M, y - 15, { size: 12, bold: true });
    if (supplier?.iban) {
      text(
        `IBAN : ${supplier.iban}${supplier.bic ? `   BIC : ${supplier.bic}` : ""}`,
        M + contentW,
        y - 15,
        { size: 9, align: "right" },
      );
    }
    y -= 38;

    // ---- Mention encadrée ----
    const mention =
      "Ce numéro de commande doit obligatoirement figurer sur votre facture. À défaut, celle-ci ne pourra être comptabilisée ni réglée.";
    const mentionLines = wrap(mention, bold, 9.5, contentW - 28);
    const mentionH = 18 + mentionLines.length * 13;
    page.drawRectangle({
      x: M,
      y: y - mentionH,
      width: contentW,
      height: mentionH,
      borderColor: INK,
      borderWidth: 1.4,
    });
    page.drawRectangle({ x: M, y: y - mentionH, width: 5, height: mentionH, color: ACCENT });
    mentionLines.forEach((l, i) => text(l, M + 16, y - 22 - i * 13, { size: 9.5, bold: true }));

    // ---- Pied de page ----
    const footerY = 64;
    page.drawRectangle({ x: M, y: footerY + 20, width: contentW, height: 1, color: LIGHT });
    const accountingEmail = clean(company?.accounting_email) ?? "comptabilite@hubandup.com";
    const footer = [
      `${clean(company?.legal_name) ?? "Hub & Up"}${company?.siret ? ` — SIRET ${company.siret}` : ""}${
        company?.vat_number ? ` — TVA ${company.vat_number}` : ""
      }`,
      `Service comptabilité : ${accountingEmail}${company?.phone ? ` — ${company.phone}` : ""}`,
      "Commande soumise aux conditions générales d'achat Hub & Up. Toute facture doit être adressée au service comptabilité en mentionnant le numéro de commande.",
    ];
    let fy = footerY + 8;
    for (const l of footer) {
      for (const wl of wrap(l, font, 7.5, contentW)) {
        text(wl, M, fy, { size: 7.5, color: GREY });
        fy -= 9;
      }
    }
    text(`${po.po_number} — généré le ${fmtDate(new Date().toISOString())}`, M + contentW, footerY + 8, {
      size: 7.5,
      color: GREY,
      align: "right",
    });

    // ---- Filigrane ANNULÉ ----
    if (po.status === "cancelled") {
      page.drawText(sanitize("ANNULÉ"), {
        x: 118,
        y: 215,
        size: 104,
        font: bold,
        color: rgb(0.85, 0.15, 0.15),
        opacity: 0.18,
        rotate: degrees(38),
      });
    }

    const bytes = await pdf.save();
    const year = new Date(po.validation_date ?? po.created_at ?? Date.now()).getUTCFullYear();
    const path = `${year}/${po.po_number}.pdf`;

    const { error: uploadError } = await admin.storage
      .from("purchase-orders")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const generatedAt = new Date().toISOString();
    await admin
      .from("purchase_orders")
      .update({ pdf_path: path, pdf_generated_at: generatedAt })
      .eq("id", poId);

    await admin.from("purchase_order_events").insert({
      purchase_order_id: poId,
      event_type: "pdf_generated",
      payload: { path, status: po.status },
      user_id: user.id,
    });

    const { data: signed } = await admin.storage
      .from("purchase-orders")
      .createSignedUrl(path, 60 * 30);

    return json({ success: true, path, signedUrl: signed?.signedUrl ?? null, generatedAt });
  } catch (error) {
    console.error("generate-purchase-order-pdf error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
