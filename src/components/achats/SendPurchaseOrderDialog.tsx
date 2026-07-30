import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Paperclip, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";
import type { Supplier } from "@/hooks/usePurchasing";

const ACCOUNTING_EMAIL = "compta@hubandup.com";

const emailSchema = z.string().trim().email();

export function buildDefaultMessage(poNumber: string, firstName?: string | null, lastName?: string | null) {
  const fullName = [firstName, lastName]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const greeting = fullName ? `Bonjour ${fullName},` : "Bonjour,";
  return `${greeting}

Veuillez trouver en pièce jointe, la commande référence n°${poNumber}.

Nous vous rappelons que ce numéro de commande doit être inscrit sur votre facture afin que celle-ci soit comptabilisée et payée.

Ceci est un message automatique, merci de ne pas répondre.

Vous en souhaitant bonne réception,

Cordialement,

Service Comptabilité
${ACCOUNTING_EMAIL}`;
}

interface SendPurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder;
  supplier?: Supplier | null;
  resend?: boolean;
  onSent?: () => void | Promise<void>;
}

export function SendPurchaseOrderDialog({
  open,
  onOpenChange,
  po,
  supplier,
  resend = false,
  onSent,
}: SendPurchaseOrderDialogProps) {
  const [from, setFrom] = useState(ACCOUNTING_EMAIL);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultMessage = useMemo(
    () => buildDefaultMessage(po.po_number, supplier?.first_name, supplier?.last_name),
    [po.po_number, supplier?.first_name, supplier?.last_name],
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    setFrom(ACCOUNTING_EMAIL);
    setTo(po.sent_to_email ?? supplier?.email ?? "");
    setSubject(`Bon de commande n°${po.po_number} - Hub & Up`);
    setMessage(defaultMessage);
    setCc(ACCOUNTING_EMAIL);

    (async () => {
      if (!po.created_by) return;
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", po.created_by)
        .maybeSingle();
      const creatorEmail = data?.email?.trim();
      if (!active || !creatorEmail || creatorEmail === ACCOUNTING_EMAIL) return;
      setCc([creatorEmail, ACCOUNTING_EMAIL].join(", "));
    })();

    return () => {
      active = false;
    };
  }, [open, po.id, po.po_number, po.created_by, po.sent_to_email, supplier?.email, defaultMessage]);

  const handleSend = async () => {
    setError(null);

    const toResult = emailSchema.safeParse(to);
    if (!toResult.success) {
      setError("L'adresse du destinataire est invalide.");
      return;
    }
    const fromResult = emailSchema.safeParse(from);
    if (!fromResult.success) {
      setError("L'adresse d'expéditeur est invalide.");
      return;
    }
    const ccList = cc
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter(Boolean);
    const invalidCc = ccList.find((email) => !emailSchema.safeParse(email).success);
    if (invalidCc) {
      setError(`Adresse en copie invalide : ${invalidCc}`);
      return;
    }
    if (!subject.trim()) {
      setError("L'objet est obligatoire.");
      return;
    }
    if (!message.trim()) {
      setError("Le corps du message est obligatoire.");
      return;
    }
    if (/\{[^}]+\}/.test(message) || /\{[^}]+\}/.test(subject)) {
      setError("Une variable non remplacée subsiste dans l'objet ou le message.");
      return;
    }

    setSending(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-purchase-order", {
        body: {
          poId: po.id,
          resend,
          from: fromResult.data,
          to: toResult.data,
          cc: ccList,
          subject: subject.trim(),
          message,
        },
      });
      if (fnError) {
        const details =
          typeof (fnError as { context?: { text?: () => Promise<string> } }).context?.text ===
          "function"
            ? await (fnError as { context: { text: () => Promise<string> } }).context.text()
            : fnError.message;
        let parsed = details;
        try {
          parsed = JSON.parse(details)?.error ?? details;
        } catch {
          /* texte brut */
        }
        throw new Error(parsed || "Envoi impossible");
      }
      if (data?.error) throw new Error(data.error);

      toast.success(`Bon de commande envoyé à ${data?.to ?? toResult.data}`);
      onOpenChange(false);
      await onSent?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Envoi impossible";
      setError(msg);
      toast.error(`Échec de l'envoi : ${msg}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (sending ? null : onOpenChange(next))}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{resend ? "Renvoyer le bon de commande" : "Envoyer le bon de commande"}</DialogTitle>
          <DialogDescription>
            Tous les champs sont modifiables avant expédition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="po-from">De</Label>
            <Input id="po-from" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="po-to">À</Label>
            <Input
              id="po-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@fournisseur.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="po-cc">Copie</Label>
            <Input
              id="po-cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="adresses séparées par des virgules"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="po-subject">Objet</Label>
            <Input id="po-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Pièce jointe</Label>
            <Badge variant="secondary" className="w-fit gap-2 font-normal">
              <Paperclip className="h-3.5 w-3.5" />
              {po.po_number}.pdf
            </Badge>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="po-message">Message</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMessage(defaultMessage)}
              >
                Réinitialiser
              </Button>
            </div>
            <Textarea
              id="po-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={14}
              className="font-normal leading-relaxed"
            />
          </div>

          {error && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {error ? "Réessayer" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
