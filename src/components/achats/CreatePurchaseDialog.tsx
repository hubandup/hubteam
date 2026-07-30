import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { formatEUR } from "@/lib/purchasing";
import {
  useCreatePurchaseInFacturation,
  type PurchaseOrder,
} from "@/hooks/usePurchaseOrders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder;
  /** Callback exécuté après création réussie de l'achat, avec le statut renvoyé par facturation.pro. */
  onCreated?: (status?: string) => void | Promise<void>;
  /** Texte d'information additionnel affiché dans le dialogue. */
  notice?: string;
}

/** Création manuelle de l'achat correspondant dans facturation.pro. */
export function CreatePurchaseDialog({ open, onOpenChange, po, onCreated, notice }: Props) {
  const createPurchase = useCreatePurchaseInFacturation();
  const [ref, setRef] = useState("");
  const [invoicedOn, setInvoicedOn] = useState("");
  const [termOn, setTermOn] = useState("");

  useEffect(() => {
    if (!open) return;
    setRef(po.supplier_quote_ref ?? "");
    setInvoicedOn(new Date().toISOString().slice(0, 10));
    setTermOn(po.payment_date ?? "");
  }, [open, po.supplier_quote_ref, po.payment_date]);

  const submit = async () => {
    if (!ref.trim()) {
      toast.error("Le n° de facture fournisseur est obligatoire");
      return;
    }
    try {
      await createPurchase.mutateAsync({
        purchase_order_id: po.id,
        ref: ref.trim(),
        invoiced_on: invoicedOn,
        term_on: termOn || null,
      });
      toast.success("Achat créé dans facturation.pro");
      onOpenChange(false);
      await onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer l'achat dans facturation.pro</DialogTitle>
          <DialogDescription>
            {po.po_number} · {po.suppliers?.company_name ?? "Fournisseur"} ·{" "}
            {formatEUR(po.amount_ttc, po.currency)} TTC (dont {formatEUR(po.amount_vat, po.currency)}{" "}
            de TVA)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="purchase-ref">N° de facture fournisseur *</Label>
            <Input id="purchase-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchase-invoiced-on">Date de facture *</Label>
              <Input
                id="purchase-invoiced-on"
                type="date"
                value={invoicedOn}
                onChange={(e) => setInvoicedOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-term-on">Date d'échéance</Label>
              <Input
                id="purchase-term-on"
                type="date"
                value={termOn}
                onChange={(e) => setTermOn(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Le montant HT est recalculé par facturation.pro à partir du TTC et de la TVA
            transmis. Descriptif, catégorie comptable et n° de dossier sont repris du bon de
            commande.
          </p>
          {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={createPurchase.isPending}>
            {createPurchase.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer l'achat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
