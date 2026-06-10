import { useState, useMemo, useEffect } from "react";
import { Navigate } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  fiscalYear: string | null;
  kdriveFolder: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Date helpers
// ──────────────────────────────────────────────────────────────────────────────
const today = new Date();
const offsetDate = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ──────────────────────────────────────────────────────────────────────────────
// DB <-> UI mapping
// ──────────────────────────────────────────────────────────────────────────────
type DbInvoice = {
  id: string;
  supplier: string;
  invoice_number: string;
  amount_ht: number | string | null;
  amount_ttc: number | string | null;
  invoice_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  status: string | null;
  payment_detail: string | null;
  file_url: string | null;
  remark: string | null;
  fiscal_year?: string | null;
  kdrive_folder?: string | null;
};

// Compute fiscal year label (April 1 → March 31). Returns e.g. "2024/2025".
const computeFiscalYear = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  return `${start}/${start + 1}`;
};

const currentFiscalYear = (): string => computeFiscalYear(new Date().toISOString())!;

const fromDb = (r: DbInvoice): Invoice => ({
  id: r.id,
  supplier: r.supplier,
  invoiceNumber: r.invoice_number,
  amountHT: Number(r.amount_ht ?? 0),
  amountTTC: Number(r.amount_ttc ?? 0),
  invoiceDate: r.invoice_date ?? offsetDate(0),
  dueDate: r.due_date ?? offsetDate(30),
  paymentTerms: r.payment_terms ?? "30 jours",
  status: (r.status as InvoiceStatus) ?? "À payer",
  paymentDetail: r.payment_detail ?? "",
  fileUrl: r.file_url || "#",
  remark: r.remark ?? "",
  fiscalYear: r.fiscal_year ?? computeFiscalYear(r.invoice_date),
  kdriveFolder: r.kdrive_folder ?? null,
});

const toDbInsert = (i: Invoice) => ({
  supplier: i.supplier,
  invoice_number: i.invoiceNumber,
  amount_ht: i.amountHT,
  amount_ttc: i.amountTTC,
  invoice_date: i.invoiceDate,
  due_date: i.dueDate,
  payment_terms: i.paymentTerms,
  status: i.status,
  payment_detail: i.paymentDetail,
  file_url: i.fileUrl === "#" ? "" : i.fileUrl,
  remark: i.remark,
  fiscal_year: i.fiscalYear,
  kdrive_folder: i.kdriveFolder,
});

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
    fiscalYear: computeFiscalYear(e.invoiceDate || offsetDate(0)),
    kdriveFolder: null,
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
const ALLOWED_EMAILS = ["compta@hubandup.com", "charles@hubandup.com"];

export default function Comptabilite() {
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.toLowerCase() ?? "";
      setAllowed(ALLOWED_EMAILS.includes(email));
      setAuthChecked(true);
    });
  }, []);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false);
  const [bankUploadOpen, setBankUploadOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activeFY, setActiveFY] = useState<string>(currentFiscalYear());

  // Load invoices from DB
  const loadInvoices = async () => {
    const { data, error } = await supabase
      .from("supplier_invoices")
      .select("*")
      .order("invoice_date", { ascending: false, nullsFirst: false });
    if (error) {
      toast.error("Impossible de charger les factures");
    } else {
      setInvoices((data as DbInvoice[]).map(fromDb));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!allowed) return;
    loadInvoices();
  }, [allowed]);

  const handleSyncKDrive = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-kdrive-supplier-invoices",
        { body: {} },
      );
      if (error) throw error;
      const count = data?.processed_count ?? 0;
      toast.success(
        count > 0
          ? `${count} nouvelle(s) facture(s) synchronisée(s) depuis kDrive`
          : "Aucune nouvelle facture trouvée dans kDrive",
      );
      await loadInvoices();
    } catch (e: any) {
      console.error(e);
      toast.error(`Sync kDrive échouée : ${e?.message ?? e}`);
    } finally {
      setSyncing(false);
    }
  };


  const handleRemarkChange = async (id: string, value: string) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, remark: value } : i)),
    );
    const { error } = await supabase
      .from("supplier_invoices")
      .update({ remark: value })
      .eq("id", id);
    if (error) toast.error("Échec de la sauvegarde de la remarque");
  };

  const handleInvoiceFile = async (file: File) => {
    setProcessing(true);
    setProcessingLabel("Extraction des données et envoi vers kDrive en cours…");
    try {
      const extracted = await processInvoiceUpload(file);
      const { data, error } = await supabase
        .from("supplier_invoices")
        .insert(toDbInsert(extracted))
        .select()
        .single();
      if (error) throw error;
      setInvoices((prev) => [fromDb(data as DbInvoice), ...prev]);
      toast.success("Facture importée avec succès");
      setInvoiceUploadOpen(false);
    } catch (err) {
      console.error(err);
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
      // Persist only the rows whose status flipped to "Payé"
      const changes = updated.filter((u) => {
        const prev = invoices.find((i) => i.id === u.id);
        return prev && prev.status !== u.status;
      });
      if (changes.length) {
        await Promise.all(
          changes.map((c) =>
            supabase
              .from("supplier_invoices")
              .update({
                status: c.status,
                payment_detail: c.paymentDetail,
              })
              .eq("id", c.id),
          ),
        );
      }
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
    const wb = XLSX.utils.book_new();
    fiscalYears.forEach((fy) => {
      const rows = invoices
        .filter((i) => (i.fiscalYear || computeFiscalYear(i.invoiceDate)) === fy)
        .map((i) => ({
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
      XLSX.utils.book_append_sheet(wb, ws, `Exercice ${fy.replace("/", "-")}`);
    });
    XLSX.writeFile(wb, `factures-${format(today, "yyyy-MM-dd")}.xlsx`);
    toast.success("Export Excel généré");
  };

  // Group invoices by fiscal year (current FY tab + one tab per past FY found in data)
  const fiscalYears = useMemo(() => {
    const set = new Set<string>([currentFiscalYear()]);
    invoices.forEach((i) => {
      const fy = i.fiscalYear || computeFiscalYear(i.invoiceDate);
      if (fy) set.add(fy);
    });
    // Sort descending (current FY first, then older)
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const displayedInvoices = useMemo(
    () =>
      invoices.filter((i) => {
        const fy = i.fiscalYear || computeFiscalYear(i.invoiceDate);
        return fy === activeFY;
      }),
    [invoices, activeFY],
  );

  const totals = useMemo(
    () => ({
      ht: displayedInvoices.reduce((s, i) => s + i.amountHT, 0),
      ttc: displayedInvoices.reduce((s, i) => s + i.amountTTC, 0),
      due: displayedInvoices.filter((i) => i.status === "À payer").length,
    }),
    [displayedInvoices],
  );

  if (!authChecked) {
    return (
      <div className="container mx-auto py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factures</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exercice {activeFY} · {displayedInvoices.length} factures ·{" "}
            {totals.due} à payer · {eur(totals.ttc)} TTC
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
          <Button variant="outline" onClick={handleSyncKDrive} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {syncing ? "Synchronisation…" : "Synchroniser kDrive"}
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Exporter en Excel
          </Button>
        </div>
      </div>

      {/* Fiscal year tabs */}
      <Tabs value={activeFY} onValueChange={setActiveFY}>
        <TabsList className="flex flex-wrap h-auto">
          {fiscalYears.map((fy) => (
            <TabsTrigger key={fy} value={fy}>
              Exercice {fy}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
              <TableHead>Statut</TableHead>
              <TableHead>Détail paiement</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead className="min-w-[180px]">Remarque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedInvoices.map((inv) => (
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
            {!loading && displayedInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  Aucune facture pour l'exercice {activeFY}.
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Chargement…
                </TableCell>
              </TableRow>
            )}
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
              {/* PDF Preview */}
              {selectedInvoice.fileUrl && selectedInvoice.fileUrl !== "#" ? (
                <div className="space-y-3">
                  <div className="aspect-[3/4] bg-muted/40 border border-border overflow-hidden">
                    <iframe
                      src={selectedInvoice.fileUrl}
                      title="Aperçu de la facture"
                      className="w-full h-full"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => window.open(selectedInvoice.fileUrl, "_blank")}
                  >
                    <Eye className="h-4 w-4" />
                    Ouvrir dans un nouvel onglet
                  </Button>
                </div>
              ) : (
                <div className="aspect-[3/4] bg-muted/40 border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">Aucun PDF disponible</p>
                  <p className="text-xs mt-1">
                    Uploader une facture pour voir l&apos;aperçu
                  </p>
                </div>
              )}

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
