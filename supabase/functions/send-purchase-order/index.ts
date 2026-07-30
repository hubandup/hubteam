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
    const overrideEmail = typeof body?.to === "string" ? body.to.trim() : "";
    const isResend = body?.resend === true;
    if (!/^[0-9a-f-]{36}$/i.test(poId)) return json({ error: "Identifiant de PO invalide" }, 400);
    if (overrideEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(overrideEmail)) {
      return json({ error: "Adresse e-mail invalide" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: po, error: poError } = await admin
      .from("purchase_orders")
      .select("*, suppliers(company_name, email)")
      .eq("id", poId)
      .maybeSingle();
    if (poError) throw poError;
    if (!po) return json({ error: "Bon de commande introuvable" }, 404);
    if (po.status === "cancelled") return json({ error: "Bon de commande annulé" }, 400);
    if (!po.pdf_path) return json({ error: "PDF non généré" }, 400);

    const recipient = overrideEmail || po.suppliers?.email;
    if (!recipient) return json({ error: "Aucune adresse e-mail pour ce fournisseur" }, 400);

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
    if (!brevoApiKey) throw new Error("BREVO_API_KEY non configurée");

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Hub & Up", email: "orga@hubandup.com" },
        to: [{ email: recipient }],
        subject: `Bon de commande ${po.po_number} — Hub & Up`,
        htmlContent: `<p>Bonjour,</p><p>Veuillez trouver ci-joint notre bon de commande <strong>${po.po_number}</strong>${
          po.description ? ` concernant : ${po.description}` : ""
        }.</p><p>Bien cordialement,<br/>L'équipe Hub &amp; Up</p>`,
        attachment: [{ content: base64, name: `${po.po_number}.pdf` }],
      }),
    });

    if (!res.ok) {
      console.error("Brevo error", res.status, await res.text());
      return json({ error: "Échec de l'envoi de l'e-mail" }, 502);
    }

    const patch: Record<string, unknown> = { sent_to_email: recipient, sent_at: new Date().toISOString() };
    if (po.status === "draft") {
      patch.status = "sent";
      patch.sent_by = user.id;
    }
    await admin.from("purchase_orders").update(patch).eq("id", poId);

    await admin.from("purchase_order_events").insert({
      purchase_order_id: poId,
      event_type: isResend || po.status !== "draft" ? "resent" : "sent",
      payload: { to: recipient },
      user_id: user.id,
    });

    return json({ success: true, to: recipient });
  } catch (error) {
    console.error("send-purchase-order error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
