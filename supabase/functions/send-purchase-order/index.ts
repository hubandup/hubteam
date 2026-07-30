import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const textToHtml = (text: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000c1f;line-height:1.6;">${
    escapeHtml(text)
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("")
  }</div>`;

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
    const isResend = body?.resend === true;
    if (!/^[0-9a-f-]{36}$/i.test(poId)) return json({ error: "Identifiant de PO invalide" }, 400);

    const fromEmail = (typeof body?.from === "string" && body.from.trim()) || "compta@hubandup.com";
    if (!EMAIL_RE.test(fromEmail)) return json({ error: "Adresse d'expéditeur invalide" }, 400);

    const overrideEmail = typeof body?.to === "string" ? body.to.trim() : "";
    if (overrideEmail && !EMAIL_RE.test(overrideEmail)) {
      return json({ error: "Adresse e-mail du destinataire invalide" }, 400);
    }

    const ccList: string[] = Array.isArray(body?.cc)
      ? Array.from(
          new Set(
            body.cc
              .filter((v: unknown) => typeof v === "string")
              .map((v: string) => v.trim())
              .filter(Boolean),
          ),
        )
      : [];
    const invalidCc = ccList.find((email) => !EMAIL_RE.test(email));
    if (invalidCc) return json({ error: `Adresse en copie invalide : ${invalidCc}` }, 400);

    const customSubject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const customMessage = typeof body?.message === "string" ? body.message : "";
    if (customSubject.length > 300) return json({ error: "Objet trop long" }, 400);
    if (customMessage.length > 20000) return json({ error: "Message trop long" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: po, error: poError } = await admin
      .from("purchase_orders")
      .select("*, suppliers(company_name, email, first_name, last_name)")
      .eq("id", poId)
      .maybeSingle();
    if (poError) throw poError;
    if (!po) return json({ error: "Bon de commande introuvable" }, 404);
    if (po.status === "cancelled") return json({ error: "Bon de commande annulé" }, 400);
    if (!po.pdf_path) return json({ error: "PDF non généré" }, 400);

    const recipient = overrideEmail || po.suppliers?.email;
    if (!recipient) return json({ error: "Aucune adresse e-mail pour ce fournisseur" }, 400);

    const fullName = [po.suppliers?.first_name, po.suppliers?.last_name]
      .filter((v: string | null) => v && v.trim())
      .join(" ")
      .trim();
    const greeting = fullName ? `Bonjour ${fullName},` : "Bonjour,";

    const defaultMessage = `${greeting}

Veuillez trouver en pièce jointe, la commande référence n°${po.po_number}.

Nous vous rappelons que ce numéro de commande doit être inscrit sur votre facture afin que celle-ci soit comptabilisée et payée.

Ceci est un message automatique, merci de ne pas répondre.

Vous en souhaitant bonne réception,

Cordialement,

Service Comptabilité
compta@hubandup.com`;

    // Aucun placeholder ne doit partir non remplacé
    const rawMessage = customMessage.trim() ? customMessage : defaultMessage;
    const message = rawMessage
      .replace(/\{Prénom\}\s*\{Nom\}/g, fullName)
      .replace(/\{Prénom\}/g, po.suppliers?.first_name?.trim() ?? "")
      .replace(/\{Nom\}/g, po.suppliers?.last_name?.trim() ?? "")
      .replace(/\{PO\}/g, po.po_number)
      .replace(/^Bonjour\s*,?\s*$/m, "Bonjour,")
      .replace(/Bonjour\s+,/g, "Bonjour,");

    const subject = (customSubject || `Bon de commande n°${po.po_number} - Hub & Up`)
      .replace(/\{PO\}/g, po.po_number);

    const { data: file, error: fileError } = await admin.storage
      .from("purchase-orders")
      .download(po.pdf_path);
    if (fileError || !file) return json({ error: "PDF introuvable dans le stockage" }, 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) throw new Error("Configuration e-mail manquante (BREVO_API_KEY)");

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Hub & Up — Service Comptabilité", email: fromEmail },
        replyTo: { email: fromEmail },
        to: [{ email: recipient }],
        ...(ccList.filter((e) => e !== recipient).length
          ? { cc: ccList.filter((e) => e !== recipient).map((email) => ({ email })) }
          : {}),
        subject,
        htmlContent: textToHtml(message),
        textContent: message,
        attachment: [{ content: base64, name: `${po.po_number}.pdf` }],
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error("Brevo error", res.status, details);
      return json(
        { error: `Échec de l'envoi de l'e-mail (${res.status}) : ${details.slice(0, 300)}` },
        502,
      );
    }

    // Archive la version exacte transmise au fournisseur (reste téléchargeable)
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const year = new Date(po.validation_date ?? po.created_at ?? Date.now()).getUTCFullYear();
    const archivePath = `${year}/archives/${po.po_number}-${stamp}.pdf`;
    const { error: archiveError } = await admin.storage
      .from("purchase-orders")
      .upload(archivePath, bytes, { contentType: "application/pdf", upsert: true });
    if (archiveError) console.error("archive error", archiveError);

    const patch: Record<string, unknown> = {
      sent_to_email: recipient,
      sent_at: new Date().toISOString(),
      sent_pdf_path: archiveError ? po.sent_pdf_path ?? null : archivePath,
    };
    if (po.status === "draft") {
      patch.status = "sent";
      patch.sent_by = user.id;
    }
    await admin.from("purchase_orders").update(patch).eq("id", poId);

    await admin.from("purchase_order_events").insert({
      purchase_order_id: poId,
      event_type: isResend || po.status !== "draft" ? "resent" : "sent",
      payload: {
        from: fromEmail,
        to: recipient,
        cc: ccList,
        subject,
        archive_path: archiveError ? null : archivePath,
      },
      user_id: user.id,
    });

    return json({ success: true, to: recipient, cc: ccList, subject });
  } catch (error) {
    console.error("send-purchase-order error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
