import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Download,
  Pencil,
  Send,
  Ban,
  CheckCircle2,
  Loader2,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { PurchaseOrderFormDrawer } from "@/components/achats/PurchaseOrderFormDrawer";
import {
  usePurchaseOrder,
  usePurchaseOrderEvents,
  useUpdatePurchaseOrderStatus,
  useLogPurchaseOrderEvent,
} from "@/hooks/usePurchaseOrders";
import { useSupplier, useCompanySettings, usePurchaseCategories } from "@/hooks/usePurchasing";
import {
  formatEUR,
  formatDateFR,
  formatFrNumber,
  PO_STATUS_LABELS,
  PO_STATUS_BADGE,
  PO_EVENT_LABELS,
} from "@/lib/purchasing";
import { generateAndStorePurchaseOrderPdf, getPurchaseOrderPdfUrl } from "@/lib/po-pdf-service";

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  const { data: po, isLoading } = usePurchaseOrder(id);
  const { data: events = [] } = usePurchaseOrderEvents(id);
  const { data: supplier } = useSupplier(po?.supplier_id);
  const { data: company } = useCompanySettings();
  const { data: categories = [] } = usePurchaseCategories();
  const updateStatus = useUpdatePurchaseOrderStatus();
  const logEvent = useLogPurchaseOrderEvent();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [needsResend, setNeedsResend] = useState(false);

  const categoryName = useMemo(
    () => categories.find((c) => c.id === po?.category_id)?.name ?? null,
    [categories, po?.category_id],
  );

  useEffect(() => {
    let active = true;
    if (!po?.pdf_path) {
      setPdfUrl(null);
      return;
    }
    getPurchaseOrderPdfUrl(po.pdf_path).then((url) => {
      if (active) setPdfUrl(url);
    });
    return () => {
      active = false;
    };
  }, [po?.pdf_path, po?.updated_at]);

  const ensurePdf = async () => {
    if (!po) return null;
    const path = await generateAndStorePurchaseOrderPdf({
      po,
      supplier,
      company,
      categoryName,
    });
    await updateStatus.mutateAsync({ id: po.id, pdfPath: path });
    await logEvent.mutateAsync({
      purchaseOrderId: po.id,
      eventType: "pdf_generated",
      payload: { path },
    });
    return path;
  };

  const handleDownload = async () => {
    if (!po) return;
    setBusy("download");
    try {
      const path = po.pdf_path ?? (await ensurePdf());
      const url = path ? await getPurchaseOrderPdfUrl(path) : null;
      if (!url) throw new Error("PDF indisponible");
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléchargement impossible");
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async (resend: boolean) => {
    if (!po) return;
    setBusy("send");
    try {
      if (!po.pdf_path) await ensurePdf();
      const { data, error } = await supabase.functions.invoke("send-purchase-order", {
        body: { poId: po.id, resend },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Bon de commande envoyé à ${data?.to ?? "le fournisseur"}`);
      setNeedsResend(false);
      await Promise.all([
        updateStatus.mutateAsync({ id: po.id }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible");
    } finally {
      setBusy(null);
    }
  };

  const handleInvoiced = async () => {
    if (!po) return;
    setBusy("invoiced");
    try {
      await updateStatus.mutateAsync({ id: po.id, status: "invoiced" });
      toast.success("Bon de commande marqué comme facturé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!po || cancelReason.trim().length < 3) {
      toast.error("Le motif d'annulation est obligatoire");
      return;
    }
    setBusy("cancel");
    try {
      await updateStatus.mutateAsync({
        id: po.id,
        status: "cancelled",
        reason: cancelReason.trim(),
      });
      setCancelOpen(false);
      setCancelReason("");
      toast.success("Bon de commande annulé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Annulation impossible");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="space-y-4">
        <PageHeader title="Bon de commande introuvable" />
        <Button variant="outline" onClick={() => navigate("/achats/bons-de-commande")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la liste
        </Button>
      </div>
    );
  }

  const canEdit = po.status === "draft" || po.status === "sent";
  const canCancel = isAdmin && po.status !== "cancelled";

  const rows: Array<[string, React.ReactNode]> = [
    ["Fournisseur", supplier?.company_name ?? "—"],
    ["N° dossier Hub & Up", po.hubup_dossier_ref],
    ["N° devis fournisseur", po.supplier_quote_ref ?? "—"],
    ["Catégorie d'achat", categoryName ?? "—"],
    ["Descriptif", po.description ?? "—"],
    ["Date de validation", formatDateFR(po.validation_date)],
    ["Date de règlement", formatDateFR(po.payment_date)],
    ["Montant HT", formatEUR(po.amount_ht, po.currency)],
    [`TVA (${formatFrNumber(Number(po.vat_rate))} %)`, formatEUR(po.amount_vat, po.currency)],
    ["Montant TTC", formatEUR(po.amount_ttc, po.currency)],
    ["Envoyé le", po.sent_at ? `${formatDateFR(po.sent_at)} — ${po.sent_to_email ?? ""}` : "—"],
    ["Notes internes", po.internal_notes ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.po_number}
        subtitle={supplier?.company_name ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" asChild>
              <Link to="/achats/bons-de-commande">
                <ArrowLeft className="h-4 w-4 mr-2" /> Liste
              </Link>
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Modifier
              </Button>
            )}
            {po.status !== "cancelled" && (
              <Button variant="outline" onClick={handleDownload} disabled={busy === "download"}>
                {busy === "download" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Télécharger le PDF
              </Button>
            )}
            {po.status === "draft" && (
              <Button onClick={() => handleSend(false)} disabled={busy === "send"}>
                {busy === "send" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer au fournisseur
              </Button>
            )}
            {po.status === "sent" && (
              <>
                <Button variant="outline" onClick={() => handleSend(true)} disabled={busy === "send"}>
                  {busy === "send" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Renvoyer
                </Button>
                <Button onClick={handleInvoiced} disabled={busy === "invoiced"}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Marquer comme facturé
                </Button>
              </>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4 mr-2" /> Annuler
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={PO_STATUS_BADGE[po.status]} variant="secondary">
          {PO_STATUS_LABELS[po.status]}
        </Badge>
        {po.status === "cancelled" && po.cancellation_reason && (
          <span className="text-sm text-muted-foreground">
            Motif : {po.cancellation_reason} ({formatDateFR(po.cancelled_at)})
          </span>
        )}
      </div>

      {needsResend && po.status === "sent" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
          Le PDF a été régénéré suite à une modification : pensez à renvoyer le document au
          fournisseur.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border bg-card p-6">
          <h2 className="font-semibold mb-4">Récapitulatif</h2>
          <dl className="space-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex gap-4 justify-between border-b last:border-0 py-1.5">
                <dt className="text-muted-foreground shrink-0">{label}</dt>
                <dd className="text-right break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Aperçu du PDF</h2>
          {pdfUrl ? (
            <iframe
              title={`Aperçu ${po.po_number}`}
              src={pdfUrl}
              className="w-full h-[520px] rounded-2xl border"
            />
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-sm text-muted-foreground">
              <FileText className="h-6 w-6" />
              Aucun PDF généré pour l'instant
              <Button variant="outline" size="sm" onClick={handleDownload}>
                Générer le PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Journal d'audit</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun évènement</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="text-sm border-l-2 pl-3">
                <p className="font-medium">
                  {PO_EVENT_LABELS[event.event_type] ?? event.event_type}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(event.created_at).toLocaleString("fr-FR")}
                  {event.user_id ? ` · utilisateur ${event.user_id.slice(0, 8)}` : ""}
                </p>
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <pre className="mt-1 max-h-32 overflow-auto rounded-xl bg-muted/50 p-2 text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <PurchaseOrderFormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        purchaseOrder={po}
        onSaved={() => {
          if (po.status === "sent") setNeedsResend(true);
        }}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler {po.po_number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'annulation est irréversible et le bon de commande ne pourra plus être modifié.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motif d'annulation *</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={busy === "cancel"}
            >
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}
