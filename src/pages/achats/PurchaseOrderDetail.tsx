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
  AlertTriangle,
  RefreshCw,
  Receipt,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { PurchaseOrderFormDrawer } from "@/components/achats/PurchaseOrderFormDrawer";
import { SendPurchaseOrderDialog } from "@/components/achats/SendPurchaseOrderDialog";
import { CreatePurchaseDialog } from "@/components/achats/CreatePurchaseDialog";
import { PurchaseOrderPdfViewer } from "@/components/achats/PurchaseOrderPdfViewer";
import {
  usePurchaseOrder,
  
  useUpdatePurchaseOrderStatus,
  useLogPurchaseOrderEvent,
  useSyncPurchaseOrderToFacturation,
  useConfirmPurchaseMatch,
} from "@/hooks/usePurchaseOrders";
import { useSupplier, useCompanySettings, usePurchaseCategories } from "@/hooks/usePurchasing";
import {
  formatEUR,
  formatDateFR,
  formatFrNumber,
  PO_STATUS_LABELS,
  PO_STATUS_BADGE,
  
} from "@/lib/purchasing";
import { generateAndStorePurchaseOrderPdf, getPurchaseOrderPdfUrl } from "@/lib/po-pdf-service";

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  const { data: po, isLoading } = usePurchaseOrder(id);
  
  const { data: supplier } = useSupplier(po?.supplier_id);
  const { data: company } = useCompanySettings();
  const { data: categories = [] } = usePurchaseCategories();
  const updateStatus = useUpdatePurchaseOrderStatus();
  const logEvent = useLogPurchaseOrderEvent();
  const syncFacturation = useSyncPurchaseOrderToFacturation();
  const confirmMatch = useConfirmPurchaseMatch();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [needsResend, setNeedsResend] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendResend, setSendResend] = useState(false);
  const [createPurchaseOpen, setCreatePurchaseOpen] = useState(false);

  const categoryName = useMemo(
    () => categories.find((c) => c.id === po?.category_id)?.name ?? null,
    [categories, po?.category_id],
  );

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!po?.pdf_path) {
      setPdfUrl(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase.storage
        .from("purchase-orders")
        .download(po.pdf_path!);
      if (!active) return;
      if (error || !data) {
        // Repli : URL signée directe
        const signed = await getPurchaseOrderPdfUrl(po.pdf_path!);
        if (active) setPdfUrl(signed);
        return;
      }
      objectUrl = URL.createObjectURL(data.slice(0, data.size, "application/pdf"));
      setPdfUrl(objectUrl);
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [po?.pdf_path, po?.updated_at]);


  const ensurePdf = async () => {
    if (!po) return null;
    const path = await generateAndStorePurchaseOrderPdf({ id: po.id });
    await updateStatus.mutateAsync({ id: po.id, pdfPath: path });
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

  const openSendDialog = async (resend: boolean) => {
    if (!po) return;
    setBusy("send");
    try {
      if (!po.pdf_path) await ensurePdf();
      setSendResend(resend);
      setSendOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF indisponible");
    } finally {
      setBusy(null);
    }
  };


  const markInvoiced = async () => {
    if (!po) return;
    await updateStatus.mutateAsync({ id: po.id, status: "invoiced" });
    toast.success("Bon de commande marqué comme facturé");
  };

  const handleInvoiced = async () => {
    if (!po) return;
    // Pas encore d'achat côté facturation.pro : on le crée avant de passer en facturé.
    if (!po.facturation_pro_purchase_id) {
      setCreatePurchaseOpen(true);
      return;
    }
    setBusy("invoiced");
    try {
      await markInvoiced();
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
    [
      "Achat facturation.pro",
      po.facturation_pro_purchase_id
        ? `#${po.facturation_pro_purchase_id}${po.purchase_matched_at ? ` — rapproché le ${formatDateFR(po.purchase_matched_at)}` : ""}`
        : "—",
    ],
    ["Notes internes", po.internal_notes ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/achats/bons-de-commande">
          <ArrowLeft className="h-4 w-4 mr-2" /> Liste
        </Link>
      </Button>

      <PageHeader title={po.po_number} subtitle={supplier?.company_name ?? undefined} />

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Modifier
          </Button>
        )}
        {po.sent_pdf_path && (
          <Button
            variant="outline"
            onClick={async () => {
              const url = await getPurchaseOrderPdfUrl(po.sent_pdf_path!);
              if (url) window.open(url, "_blank", "noopener");
              else toast.error("Version envoyée introuvable");
            }}
          >
            <FileText className="h-4 w-4 mr-2" /> Version envoyée
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
          <Button onClick={() => openSendDialog(false)} disabled={busy === "send"}>
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
            <Button variant="outline" onClick={() => openSendDialog(true)} disabled={busy === "send"}>
              {busy === "send" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Renvoyer
            </Button>
            {!po.facturation_pro_purchase_id && (
              <Button variant="outline" onClick={() => setCreatePurchaseOpen(true)}>
                <Receipt className="h-4 w-4 mr-2" /> Créer l'achat dans facturation.pro
              </Button>
            )}
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

      <div className="flex flex-wrap items-center gap-2">

        <Badge className={PO_STATUS_BADGE[po.status]} variant="secondary">
          {PO_STATUS_LABELS[po.status]}
        </Badge>
        {po.sync_status === "failed" && (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            <AlertTriangle className="h-3 w-3 mr-1" /> À reporter manuellement
          </Badge>
        )}
        {po.sync_status === "synced" && (
          <span className="text-xs text-muted-foreground">
            Synchronisé avec facturation.pro{po.synced_at ? ` le ${formatDateFR(po.synced_at)}` : ""}
          </span>
        )}
        {po.status === "cancelled" && po.cancellation_reason && (
          <span className="text-sm text-muted-foreground">
            Motif : {po.cancellation_reason} ({formatDateFR(po.cancelled_at)})
          </span>
        )}
      </div>

      {po.facturation_pro_purchase_id &&
        po.purchase_match_confidence === "probable" &&
        !po.purchase_match_confirmed && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
              <div>
                <p className="font-medium">Rapprochement probable à confirmer</p>
                <p className="text-muted-foreground">
                  L'achat facturation.pro #{po.facturation_pro_purchase_id} a été rapproché
                  automatiquement (
                  {po.purchase_match_method === "supplier_amount"
                    ? "fournisseur et montant TTC identiques"
                    : "n° de facture fournisseur identique"}
                  ). Confirmez le rapprochement ou dissociez-le.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={confirmMatch.isPending}
                onClick={() =>
                  confirmMatch.mutate(
                    { id: po.id, confirm: true },
                    {
                      onSuccess: () => toast.success("Rapprochement confirmé"),
                      onError: () => toast.error("Action impossible"),
                    },
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmer
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={confirmMatch.isPending}
                onClick={() =>
                  confirmMatch.mutate(
                    { id: po.id, confirm: false },
                    {
                      onSuccess: () => toast.success("Rapprochement dissocié"),
                      onError: () => toast.error("Action impossible"),
                    },
                  )
                }
              >
                <XCircle className="h-4 w-4 mr-2" /> Dissocier
              </Button>
            </div>
          </div>
        )}

      {po.sync_status === "failed" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
            <div>
              <p className="font-medium">
                À reporter manuellement dans facturation.pro
              </p>
              <p className="text-muted-foreground">{po.sync_error ?? "Synchronisation échouée"}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={syncFacturation.isPending}
            onClick={() =>
              syncFacturation.mutate(po.id, {
                onSuccess: (res) =>
                  res?.success
                    ? toast.success(
                        res.skipped ? "Synchronisation désactivée" : "Synchronisation réussie",
                      )
                    : toast.error(res?.error ?? "Synchronisation impossible"),
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Synchronisation impossible"),
              })
            }
          >
            {syncFacturation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Relancer la synchronisation
          </Button>
        </div>
      )}

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
            <PurchaseOrderPdfViewer url={pdfUrl} />
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


      <PurchaseOrderFormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        purchaseOrder={po}
        onSaved={() => {
          if (po.status === "sent") setNeedsResend(true);
        }}
      />

      <SendPurchaseOrderDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        po={po}
        supplier={supplier}
        resend={sendResend}
        onSent={async () => {
          setNeedsResend(false);
          await updateStatus.mutateAsync({ id: po.id });
          // Synchronisation facturation.pro : non bloquante, n'empêche jamais l'envoi
          syncFacturation.mutate(po.id, {
            onSuccess: (res) => {
              if (res?.success === false) {
                toast.warning("Report du n° de PO sur facturation.pro impossible");
              }
            },
            onError: () => {
              toast.warning("Report du n° de PO sur facturation.pro impossible");
            },
          });
        }}
      />



      <CreatePurchaseDialog
        open={createPurchaseOpen}
        onOpenChange={setCreatePurchaseOpen}
        po={po}
        notice="Une fois l'achat créé, le statut du bon de commande est synchronisé avec celui renvoyé par facturation.pro."
        onCreated={async (status) => {
          // Le statut est déjà aligné côté serveur sur l'état facturation.pro.
          if (status === "cancelled") {
            toast.warning("L'achat est annulé sur facturation.pro : bon de commande passé en annulé");
            return;
          }
          if (status === "invoiced") {
            toast.success("Bon de commande marqué comme facturé");
            return;
          }
          try {
            await markInvoiced();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Action impossible");
          }
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
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
