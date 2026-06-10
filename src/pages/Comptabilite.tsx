import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Upload,
  Landmark,
  FileSpreadsheet,
  Eye,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { format } from "date-fns";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
type InvoiceStatus = "À payer" | "Payé";

interface Invoice {
  id: string;
  supplier: string;
  invoiceNumber: string;
  amountHT: number;
  amountTTC: number;
  invoiceDate: string; // ISO
  dueDate: string; // ISO
  paymentTerms: string;
  status: InvoiceStatus;
  paymentDetail: string;
  fileUrl: string;
  remark: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────────────────────────────────────
const today = new Date();
const offsetDate = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv-001",
    supplier: "Imprimerie Dupont",
    invoiceNumber: "F2026-0142",
    amountHT: 1250,
    amountTTC: 1500,
    invoiceDate: offsetDate(-40),
    dueDate: offsetDate(-5),
    paymentTerms: "30 jours",
    status: "À payer",
    paymentDetail: "",
    fileUrl: "#",
    remark: "Relance envoyée",
  },
  {
    id: "inv-002",
    supplier: "Studio Création SA",
    invoiceNumber: "SC-2026-0058",
    amountHT: 4200,
    amountTTC: 5040,
    invoiceDate: offsetDate(-20),
    dueDate: offsetDate(3),
    paymentTerms: "30 jours",
    status: "À payer",
    paymentDetail: "",
    fileUrl: "#",
    remark: "",
  },
  {
    id: "inv-003",
    supplier: "Hosting Web Pro",
    invoiceNumber: "HWP-99821",
    amountHT: 89,
    amountTTC: 106.8,
    invoiceDate: offsetDate(-60),
    dueDate: offsetDate(-30),
    paymentTerms: "Comptant",
    status: "Payé",
    paymentDetail: "Virement SEPA 12/05",
    fileUrl: "#",
    remark: "Renouvellement annuel",
  },
  {
    id: "inv-004",
    supplier: "Agence Média Plus",
    invoiceNumber: "AMP-2026-0011",
    amountHT: 8500,
    amountTTC: 10200,
    invoiceDate: offsetDate(-5),
    dueDate: offsetDate(25),
    paymentTerms: "30 jours",
    status: "À payer",
    paymentDetail: "",
    fileUrl: "#",
    remark: "",
  },
  {
    id: "inv-005",
    supplier: "Coworking Lyon",
    invoiceNumber: "CWL-0307",
    amountHT: 450,
    amountTTC: 540,
    invoiceDate: offsetDate(-10),
    dueDate: offsetDate(10),
    paymentTerms: "20 jours",
    status: "À payer",
    paymentDetail: "",
    fileUrl: "#",
    remark: "Bureau juin",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);

const fmtDate = (iso: string) => format(new Date(iso), "dd/MM/yyyy");

const getDueDateColor = (dueDate: string, status: InvoiceStatus) => {
  if (status === "Payé") return "text-muted-foreground";
  const due = new Date(dueDate);
  const diffDays = Math.ceil(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return "text-red-600 font-semibold";
  if (diffDays < 7) return "text-orange-500 font-semibold";
  if (diffDays > 15) return "text-green-600 font-semibold";
  return "text-foreground";
};

// ──────────────────────────────────────────────────────────────────────────────
// API stubs — connect your backend here
// ──────────────────────────────────────────────────────────────────────────────

/** Read a File as base64 (without the data URL prefix). */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload invoice to kDrive + OCR extraction via Gemini.
 * Calls the `process-invoice-ocr` edge function.
 */
async function processInvoiceUpload(file: File): Promise<Invoice> {
  const base64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("process-invoice-ocr", {
    body: {
      fileName: file.name,
      fileContent: base64,
      mimeType: file.type || "application/pdf",
    },
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Échec du traitement");

  const e = data.extracted ?? {};
  const kdrive = data.kdrive;
  const fileUrl =
    kdrive?.publicUrl ||
    kdrive?.url ||
    (kdrive?.driveId && kdrive?.fileId
      ? `/functions/v1/kdrive-api?action=download&driveId=${kdrive.driveId}&fileId=${kdrive.fileId}`
      : "#");

  return {
    id: `inv-${Date.now()}`,
    supplier: e.supplier || "Fournisseur inconnu",
    invoiceNumber: e.invoiceNumber || `AUTO-${Date.now()}`,
    amountHT: Number(e.amountHT) || 0,
    amountTTC: Number(e.amountTTC) || 0,
    invoiceDate: e.invoiceDate || offsetDate(0),
    dueDate: e.dueDate || offsetDate(30),
    paymentTerms: e.paymentTerms || "30 jours",
    status: "À payer",
    paymentDetail: "",
    fileUrl,
    remark: `Fichier: ${file.name}`,
  };
}

/**
 * STUB: Bank statement matching.
 * Plug your backend logic here. The agreed matching key is:
 *   Supplier + Amount TTC + Invoice Number
 */
async function processBankStatement(
  _file: File,
  invoices: Invoice[],
): Promise<Invoice[]> {
  await new Promise((r) => setTimeout(r, 2000));
  // Mock: mark the first two unpaid invoices as paid
  let matched = 0;
  return invoices.map((inv) => {
    if (inv.status === "À payer" && matched < 2) {
      matched++;
      return {
        ...inv,
        status: "Payé" as const,
        paymentDetail: `Virement SEPA ${format(today, "dd/MM/yyyy")}`,
      };
    }
    return inv;
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
export default function Comptabilite() {
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false);
  const [bankUploadOpen, setBankUploadOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");

  const handleRemarkChange = (id: string, value: string) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, remark: value } : i)),
    );
    // TODO: persist remark via API onBlur
  };

  const handleInvoiceFile = async (file: File) => {
    setProcessing(true);
    setProcessingLabel("Extraction des données et envoi vers kDrive en cours…");
    try {
      const newInvoice = await processInvoiceUpload(file);
      setInvoices((prev) => [newInvoice, ...prev]);
      toast.success("Facture importée avec succès");
      setInvoiceUploadOpen(false);
    } catch {
      toast.error("Échec du traitement de la facture");
    } finally {
      setProcessing(false);
      setProcessingLabel("");
    }
  };

  const handleBankFile = async (file: File) => {
    setProcessing(true);
    setProcessingLabel("Rapprochement bancaire en cours…");
    try {
      const updated = await processBankStatement(file, invoices);
      setInvoices(updated);
      toast.success("Rapprochement bancaire terminé");
      setBankUploadOpen(false);
    } catch {
      toast.error("Échec du rapprochement");
    } finally {
      setProcessing(false);
      setProcessingLabel("");
    }
  };

  const handleExportExcel = () => {
    const rows = invoices.map((i) => ({
      Fournisseur: i.supplier,
      "N° Facture": i.invoiceNumber,
      "Montant HT": i.amountHT,
      "Montant TTC": i.amountTTC,
      "Date facture": fmtDate(i.invoiceDate),
      "Date échéance": fmtDate(i.dueDate),
      "Condition règlement": i.paymentTerms,
      Statut: i.status,
      "Détail paiement": i.paymentDetail,
      Remarque: i.remark,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Factures");
    XLSX.writeFile(wb, `factures-${format(today, "yyyy-MM-dd")}.xlsx`);
    toast.success("Export Excel généré");
  };

  const totals = useMemo(
    () => ({
      ht: invoices.reduce((s, i) => s + i.amountHT, 0),
      ttc: invoices.reduce((s, i) => s + i.amountTTC, 0),
      due: invoices.filter((i) => i.status === "À payer").length,
    }),
    [invoices],
  );

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factures</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {invoices.length} factures · {totals.due} à payer ·{" "}
            {eur(totals.ttc)} TTC
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setInvoiceUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Uploader une facture
          </Button>
          <Button variant="outline" onClick={() => setBankUploadOpen(true)}>
            <Landmark className="h-4 w-4" />
            Uploader un extrait de compte
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Exporter en Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>N° facture</TableHead>
              <TableHead className="text-right">HT (€)</TableHead>
              <TableHead className="text-right">TTC (€)</TableHead>
              <TableHead>Date facture</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Règlement</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Détail paiement</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead className="min-w-[180px]">Remarque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.supplier}</TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.invoiceNumber}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {eur(inv.amountHT)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {eur(inv.amountTTC)}
                </TableCell>
                <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>
                <TableCell className={getDueDateColor(inv.dueDate, inv.status)}>
                  {fmtDate(inv.dueDate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.paymentTerms}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={inv.status === "Payé" ? "success" : "warning"}
                  >
                    {inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {inv.paymentDetail || "—"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Voir la facture
                  </Button>
                </TableCell>
                <TableCell>
                  <input
                    defaultValue={inv.remark}
                    onBlur={(e) => handleRemarkChange(inv.id, e.target.value)}
                    placeholder="Ajouter une remarque…"
                    className="w-full bg-transparent border-0 outline-none text-sm focus:bg-muted/40 px-2 py-1 rounded"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Upload Invoice Dialog */}
      <Dialog open={invoiceUploadOpen} onOpenChange={setInvoiceUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uploader une facture</DialogTitle>
            <DialogDescription>
              Glissez votre facture (PDF, JPG, PNG). L'OCR extraira
              automatiquement les données.
            </DialogDescription>
          </DialogHeader>
          <DropZone
            processing={processing}
            processingLabel={processingLabel}
            onFile={handleInvoiceFile}
            accept="application/pdf,image/*"
          />
        </DialogContent>
      </Dialog>

      {/* Upload Bank Statement Dialog */}
      <Dialog open={bankUploadOpen} onOpenChange={setBankUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uploader un extrait de compte</DialogTitle>
            <DialogDescription>
              Le rapprochement bancaire s'effectue sur Fournisseur + Montant TTC
              + N° de facture.
            </DialogDescription>
          </DialogHeader>
          <DropZone
            processing={processing}
            processingLabel={processingLabel}
            onFile={handleBankFile}
            accept=".csv,.ofx,.qif,.pdf"
          />
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Sheet */}
      <Sheet
        open={!!selectedInvoice}
        onOpenChange={(o) => !o && setSelectedInvoice(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-none sm:w-1/2 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {selectedInvoice?.supplier} — {selectedInvoice?.invoiceNumber}
            </SheetTitle>
          </SheetHeader>
          {selectedInvoice && (
            <div className="space-y-6 mt-6">
              {/* PDF Preview placeholder */}
              <div className="aspect-[3/4] bg-muted/40 border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">Aperçu PDF de la facture</p>
                <p className="text-xs mt-1">
                  (À connecter au stockage kDrive)
                </p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <MetaRow label="Fournisseur" value={selectedInvoice.supplier} />
                <MetaRow
                  label="N° facture"
                  value={selectedInvoice.invoiceNumber}
                />
                <MetaRow
                  label="Montant HT"
                  value={eur(selectedInvoice.amountHT)}
                />
                <MetaRow
                  label="Montant TTC"
                  value={eur(selectedInvoice.amountTTC)}
                />
                <MetaRow
                  label="Date facture"
                  value={fmtDate(selectedInvoice.invoiceDate)}
                />
                <MetaRow
                  label="Échéance"
                  value={fmtDate(selectedInvoice.dueDate)}
                />
                <MetaRow
                  label="Règlement"
                  value={selectedInvoice.paymentTerms}
                />
                <MetaRow label="Statut" value={selectedInvoice.status} />
                {selectedInvoice.paymentDetail && (
                  <MetaRow
                    label="Détail paiement"
                    value={selectedInvoice.paymentDetail}
                  />
                )}
                {selectedInvoice.remark && (
                  <MetaRow
                    label="Remarque"
                    value={selectedInvoice.remark}
                    full
                  />
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MetaRow({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={cn(full && "col-span-2")}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground/70">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function DropZone({
  onFile,
  accept,
  processing,
  processingLabel,
}: {
  onFile: (f: File) => void;
  accept: string;
  processing: boolean;
  processingLabel: string;
}) {
  const [dragOver, setDragOver] = useState(false);

  if (processing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{processingLabel}</p>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed cursor-pointer transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-foreground/30",
      )}
    >
      <Upload className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium">
        Glissez votre fichier ici ou cliquez pour parcourir
      </p>
      <p className="text-xs text-muted-foreground mt-1">{accept}</p>
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
