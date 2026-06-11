import { useState, useMemo, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { format } from "date-fns";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  kdriveFileId: string | null;
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
  kdrive_file_id?: string | null;
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
  kdriveFileId: r.kdrive_file_id ?? null,
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
  kdrive_file_id: i.kdriveFileId,
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
  if (!kdrive?.driveId || !kdrive?.fileId) {
    throw new Error("La facture n'a pas été déposée sur kDrive");
  }
  const fileUrl =
    kdrive?.publicUrl ||
    kdrive?.url ||
    `/functions/v1/kdrive-api?action=download&driveId=${kdrive.driveId}&fileId=${kdrive.fileId}`;

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
    remark: "",
    fiscalYear: computeFiscalYear(e.invoiceDate || offsetDate(0)),
    kdriveFolder: "_NEW",
    kdriveFileId: String(kdrive.fileId),
  };
}

/**
 * Bank statement matching.
 * Parse the uploaded Excel, focus on the sheet "Cpt 07255 00020692502",
 * and match each line against unpaid invoices using:
 *   - Amount TTC (exact match within 0.01)
 *   - Invoice number found in the line text, OR
 *   - Supplier name token found in the line text
 * Matched invoices are flipped to "Payé".
 */
const TARGET_SHEET_NAME = "Cpt 07255 00020692502";

const normalizeText = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const findTargetSheet = (wb: XLSX.WorkBook): string => {
  const target = normalizeText(TARGET_SHEET_NAME);
  const exact = wb.SheetNames.find((n) => normalizeText(n) === target);
  if (exact) return exact;
  const partial = wb.SheetNames.find((n) => normalizeText(n).includes("07255"));
  return partial || wb.SheetNames[0];
};

const parseRowDate = (row: unknown[]): string | null => {
  for (const cell of row) {
    if (cell instanceof Date) return format(cell, "dd/MM/yyyy");
    if (typeof cell === "number" && cell > 30000 && cell < 60000 && Number.isInteger(cell)) {
      const d = XLSX.SSF.parse_date_code(cell);
      if (d) return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
    }
    if (typeof cell === "string") {
      const m = cell.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3].length === 2 ? "20" + m[3] : m[3]}`;
    }
  }
  return null;
};

const rowAmounts = (row: unknown[]): number[] => {
  const out: number[] = [];
  for (const cell of row) {
    if (typeof cell === "number" && Number.isFinite(cell) && Math.abs(cell) > 0.001 && Math.abs(cell) < 1e7) {
      if (cell > 30000 && cell < 60000 && Number.isInteger(cell)) continue; // skip date serials
      out.push(Math.abs(cell));
    } else if (typeof cell === "string" && /\d/.test(cell)) {
      const cleaned = cell.replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
      const n = parseFloat(cleaned);
      if (Number.isFinite(n) && Math.abs(n) > 0.001) out.push(Math.abs(n));
    }
  }
  return out;
};

async function processBankStatement(
  file: File,
  invoices: Invoice[],
): Promise<Invoice[]> {
  let rows: unknown[][] = [];
  let sheetUsed = "";
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    sheetUsed = findTargetSheet(wb);
    const ws = wb.Sheets[sheetUsed];
    rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  } catch (e) {
    console.error("Bank statement parse failed", e);
    toast.error("Impossible de lire le fichier Excel");
    return invoices;
  }

  const indexed = rows.map((r) => ({
    text: normalizeText(r.map((c) => (c instanceof Date ? "" : String(c ?? ""))).join(" ")),
    amounts: rowAmounts(r),
    date: parseRowDate(r),
  }));

  const used = new Set<number>();
  let matchedCount = 0;
  const updated = invoices.map((inv) => {
    if (inv.status !== "À payer") return inv;
    const ttc = Number(inv.amountTTC);
    if (!Number.isFinite(ttc) || ttc <= 0) return inv;
    const invNum = normalizeText(inv.invoiceNumber);
    const supplierTokens = normalizeText(inv.supplier).split(" ").filter((t) => t.length >= 4);

    for (let i = 0; i < indexed.length; i++) {
      if (used.has(i)) continue;
      const row = indexed[i];
      const amountMatch = row.amounts.some((a) => Math.abs(a - ttc) < 0.01);
      if (!amountMatch) continue;
      const numMatch = invNum.length >= 3 && row.text.includes(invNum);
      const supplierMatch = supplierTokens.some((t) => row.text.includes(t));
      if (numMatch || supplierMatch) {
        used.add(i);
        matchedCount++;
        const dateLabel = row.date || format(today, "dd/MM/yyyy");
        return {
          ...inv,
          status: "Payé" as const,
          paymentDetail: `Rapprochement bancaire ${dateLabel}`,
        };
      }
    }
    return inv;
  });

  if (matchedCount === 0) {
    toast.info(`Aucune correspondance trouvée dans l'onglet "${sheetUsed}"`);
  } else {
    toast.success(`${matchedCount} facture(s) marquée(s) comme payée(s)`);
  }
  return updated;
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
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewPageCount, setPreviewPageCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewWidth, setPreviewWidth] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  type SortKey = "supplier" | "invoiceNumber" | "amountHT" | "amountTTC" | "invoiceDate" | "dueDate" | "status";
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  // Resolve kDrive file_url -> authenticated blob URL for iframe preview
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setPreviewPage(1);
    setPreviewPageCount(0);
    const run = async () => {
      if (!selectedInvoice || !selectedInvoice.fileUrl || selectedInvoice.fileUrl === "#") {
        setPreviewBlobUrl(null);
        setPreviewMimeType(null);
        return;
      }
      const raw = selectedInvoice.fileUrl;
      const isKdrive = raw.includes("kdrive-api");
      if (!isKdrive) {
        setPreviewBlobUrl(raw);
        setPreviewMimeType(raw.toLowerCase().endsWith(".pdf") ? "application/pdf" : null);
        return;
      }
      try {
        setPreviewLoading(true);
        // Build absolute URL (raw may be relative like "/functions/v1/kdrive-api?...")
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
        const base = raw.startsWith("http")
          ? raw
          : `${supabaseUrl?.replace(/\/$/, "") || ""}${raw.startsWith("/") ? "" : "/"}${raw}`;
        const u = new URL(base);
        const driveId = u.searchParams.get("driveId");
        const fileId = u.searchParams.get("fileId");
        if (!driveId || !fileId) throw new Error("Paramètres manquants");
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const apikey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
        const resp = await fetch(u.toString(), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(apikey ? { apikey } : {}),
          },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setPreviewMimeType(blob.type || "application/pdf");
        setPreviewBlobUrl(createdUrl);
      } catch (e) {
        console.error("Preview load failed", e);
        if (!cancelled) {
          setPreviewBlobUrl(null);
          toast.error("Impossible de charger l'aperçu de la facture");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [selectedInvoice]);

  useEffect(() => {
    const updateWidth = () => {
      if (previewContainerRef.current) {
        setPreviewWidth(Math.max(240, previewContainerRef.current.clientWidth - 32));
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [selectedInvoice, previewBlobUrl]);

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


  const handleFieldUpdate = async (
    id: string,
    field: keyof Invoice,
    dbField: string,
    value: string | number,
  ) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    );
    const { error } = await supabase
      .from("supplier_invoices")
      .update({ [dbField]: value })
      .eq("id", id);
    if (error) toast.error("Échec de la sauvegarde");
    else await loadInvoices();
  };

  const handleRemarkChange = async (id: string, value: string) => {
    await handleFieldUpdate(id, "remark", "remark", value);
  };

  const handleInvoiceFile = async (file: File) => {
    setProcessing(true);
    setProcessingLabel("Extraction des données et envoi vers kDrive en cours…");
    try {
      const extracted = await processInvoiceUpload(file);
      const { error } = await supabase
        .from("supplier_invoices")
        .insert(toDbInsert(extracted))
        .select()
        .single();
      if (error) throw error;
      await loadInvoices();
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
      // Persist the uploaded statement in storage
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const storagePath = `${ts}__${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("bank-statements")
        .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) console.error("Bank statement upload failed", upErr);

      const updated = await processBankStatement(file, invoices);
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
      await loadInvoices();
      toast.success("Rapprochement bancaire terminé");
      await loadBankStatements();
      setBankUploadOpen(false);
    } catch {
      toast.error("Échec du rapprochement");
    } finally {
      setProcessing(false);
      setProcessingLabel("");
    }
  };

  // ── Bank statements history ────────────────────────────────────────────────
  type BankStatementEntry = { name: string; createdAt: string };
  const [bankStatements, setBankStatements] = useState<BankStatementEntry[]>([]);
  const [loadingStatements, setLoadingStatements] = useState(false);

  const loadBankStatements = async () => {
    setLoadingStatements(true);
    try {
      const { data, error } = await supabase.storage
        .from("bank-statements")
        .list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      setBankStatements(
        (data || [])
          .filter((f) => f.name && !f.name.startsWith("."))
          .map((f) => ({
            name: f.name,
            createdAt: (f as any).created_at || (f as any).updated_at || "",
          })),
      );
    } catch (e) {
      console.error("Failed to list bank statements", e);
    } finally {
      setLoadingStatements(false);
    }
  };

  useEffect(() => {
    if (bankUploadOpen) loadBankStatements();
  }, [bankUploadOpen]);

  const handleDownloadStatement = async (entry: BankStatementEntry) => {
    try {
      const { data, error } = await supabase.storage
        .from("bank-statements")
        .download(entry.name);
      if (error || !data) throw error;
      const originalName = entry.name.replace(/^[^_]*__/, "");
      const ext = originalName.split(".").pop()?.toLowerCase() || "";
      const baseName = originalName.replace(/\.[^.]+$/, "");

      if (ext === "csv" || ext === "tsv" || ext === "txt") {
        const text = await data.text();
        const wb = XLSX.read(text, { type: "string" });
        XLSX.writeFile(wb, `${baseName}.xlsx`);
      } else if (ext === "xls" || ext === "xlsx") {
        const buf = await data.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        XLSX.writeFile(wb, `${baseName}.xlsx`);
      } else {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      toast.error("Échec du téléchargement");
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = displayedInvoices.map((i) => ({
      Fournisseur: i.supplier,
      "N° Facture": i.invoiceNumber,
      "Montant HT": i.amountHT,
      "Montant TVA": i.amountTTC - i.amountHT,
      "Montant TTC": i.amountTTC,
      "Date facture": fmtDate(i.invoiceDate),
      "Date échéance": fmtDate(i.dueDate),
      "Condition règlement": i.paymentTerms,
      Statut: i.status,
      "Détail paiement": i.paymentDetail,
      Remarque: i.remark,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `Exercice ${activeFY.replace("/", "-")}`);
    XLSX.writeFile(wb, `factures-${activeFY.replace("/", "-")}-${format(today, "yyyy-MM-dd")}.xlsx`);
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

  const displayedInvoices = useMemo(() => {
    let list = invoices.filter((i) => {
      const fy = i.fiscalYear || computeFiscalYear(i.invoiceDate);
      return fy === activeFY;
    });

    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        [i.supplier, i.invoiceNumber, i.remark, i.paymentDetail]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)) ||
        String(i.amountTTC).includes(q) ||
        String(i.amountHT).includes(q) ||
        fmtDate(i.invoiceDate).includes(q) ||
        fmtDate(i.dueDate).includes(q)
      );
    }

    // Sorting
    if (sortConfig) {
      const { key, dir } = sortConfig;
      list = [...list].sort((a, b) => {
        let cmp = 0;
        switch (key) {
          case "supplier":
            cmp = a.supplier.localeCompare(b.supplier);
            break;
          case "invoiceNumber":
            cmp = a.invoiceNumber.localeCompare(b.invoiceNumber);
            break;
          case "amountHT":
            cmp = a.amountHT - b.amountHT;
            break;
          case "amountTTC":
            cmp = a.amountTTC - b.amountTTC;
            break;
          case "invoiceDate":
            cmp = new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
            break;
          case "dueDate":
            cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            break;
          case "status":
            cmp = a.status.localeCompare(b.status);
            break;
        }
        return dir === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [invoices, activeFY, searchQuery, sortConfig]);

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
          <Button
            size="icon"
            variant="outline"
            onClick={() => setInvoiceUploadOpen(true)}
            title="Uploader une facture"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setBankUploadOpen(true)}
            title="Uploader un extrait de compte"
          >
            <Landmark className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleSyncKDrive}
            disabled={syncing}
            title="Synchroniser kDrive"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleExportExcel}
            title="Exporter le tableau au format Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
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
              <TableHead className="text-right">TVA (€)</TableHead>
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
            {displayedInvoices.map((inv) => {
              const editCls =
                "w-full bg-transparent border-0 outline-none text-sm focus:bg-muted/40 hover:bg-muted/20 px-2 py-1 rounded-none transition-colors";
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium p-0">
                    <input
                      key={`s-${inv.supplier}`}
                      defaultValue={inv.supplier}
                      onBlur={(e) =>
                        e.target.value !== inv.supplier &&
                        handleFieldUpdate(inv.id, "supplier", "supplier", e.target.value)
                      }
                      className={cn(editCls, "font-medium")}
                      style={{ textTransform: "uppercase" }}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground p-0">
                    <input
                      key={`n-${inv.invoiceNumber}`}
                      defaultValue={inv.invoiceNumber}
                      onBlur={(e) =>
                        e.target.value !== inv.invoiceNumber &&
                        handleFieldUpdate(inv.id, "invoiceNumber", "invoice_number", e.target.value)
                      }
                      className={editCls}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums p-0">
                    <input
                      key={`ht-${inv.amountHT}`}
                      type="number"
                      step="0.01"
                      defaultValue={inv.amountHT}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v !== inv.amountHT)
                          handleFieldUpdate(inv.id, "amountHT", "amount_ht", v);
                      }}
                      className={cn(editCls, "text-right")}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {eur(inv.amountTTC - inv.amountHT)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium p-0">
                    <input
                      key={`ttc-${inv.amountTTC}`}
                      type="number"
                      step="0.01"
                      defaultValue={inv.amountTTC}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v !== inv.amountTTC)
                          handleFieldUpdate(inv.id, "amountTTC", "amount_ttc", v);
                      }}
                      className={cn(editCls, "text-right font-medium")}
                    />
                  </TableCell>
                  <TableCell className="p-0">
                    <input
                      key={`d-${inv.invoiceDate}`}
                      type="date"
                      defaultValue={inv.invoiceDate}
                      onBlur={(e) =>
                        e.target.value !== inv.invoiceDate &&
                        handleFieldUpdate(inv.id, "invoiceDate", "invoice_date", e.target.value)
                      }
                      className={editCls}
                    />
                  </TableCell>
                  <TableCell className={cn("p-0", getDueDateColor(inv.dueDate, inv.status))}>
                    <input
                      key={`dd-${inv.dueDate}`}
                      type="date"
                      defaultValue={inv.dueDate}
                      onBlur={(e) =>
                        e.target.value !== inv.dueDate &&
                        handleFieldUpdate(inv.id, "dueDate", "due_date", e.target.value)
                      }
                      className={cn(editCls, getDueDateColor(inv.dueDate, inv.status))}
                    />
                  </TableCell>
                  <TableCell className="p-0">
                    <select
                      value={inv.status}
                      onChange={(e) =>
                        handleFieldUpdate(inv.id, "status", "status", e.target.value)
                      }
                      className={cn(
                        editCls,
                        "cursor-pointer font-medium",
                        inv.status === "Payé" ? "text-green-700" : "text-amber-700",
                      )}
                    >
                      <option value="À payer">À payer</option>
                      <option value="Payé">Payé</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs p-0">
                    <input
                      key={`pd-${inv.paymentDetail}`}
                      defaultValue={inv.paymentDetail}
                      placeholder="—"
                      onBlur={(e) =>
                        e.target.value !== inv.paymentDetail &&
                        handleFieldUpdate(inv.id, "paymentDetail", "payment_detail", e.target.value)
                      }
                      className={cn(editCls, "text-xs")}
                    />
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
                  <TableCell className="p-0">
                    <input
                      defaultValue={inv.remark}
                      onBlur={(e) => handleRemarkChange(inv.id, e.target.value)}
                      placeholder="Ajouter une remarque…"
                      className={editCls}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && displayedInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                  Aucune facture pour l'exercice {activeFY}.
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
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

          <div className="mt-4 border-t border-border pt-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Derniers extraits uploadés
            </div>
            {loadingStatements ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
              </div>
            ) : bankStatements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun extrait pour le moment.</p>
            ) : (
              <ul className="max-h-60 overflow-auto divide-y divide-border">
                {bankStatements.map((s) => {
                  const originalName = s.name.replace(/^[^_]*__/, "");
                  const date = s.createdAt ? format(new Date(s.createdAt), "dd/MM/yyyy HH:mm") : "";
                  return (
                    <li key={s.name}>
                      <button
                        type="button"
                        onClick={() => handleDownloadStatement(s)}
                        className="w-full flex items-center justify-between gap-3 py-2 px-1 text-left hover:bg-muted/50 transition"
                        title="Télécharger au format XLS"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">{originalName}</span>
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">{date}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
                  <div className="aspect-[3/4] bg-muted/40 border border-border overflow-hidden flex items-center justify-center">
                    {previewLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : previewBlobUrl ? (
                      previewMimeType?.includes("pdf") ? (
                        <div ref={previewContainerRef} className="h-full w-full overflow-auto bg-muted/20 p-4">
                          <Document
                            file={previewBlobUrl}
                            onLoadSuccess={({ numPages }) => setPreviewPageCount(numPages)}
                            loading={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mt-8" />}
                            error={<p className="text-sm text-muted-foreground text-center mt-8">Aperçu indisponible</p>}
                            className="flex justify-center"
                          >
                            {previewWidth > 0 && (
                              <Page
                                pageNumber={previewPage}
                                width={previewWidth}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                            )}
                          </Document>
                        </div>
                      ) : (
                        <img src={previewBlobUrl} alt="Aperçu de la facture" className="h-full w-full object-contain" />
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">Aperçu indisponible</p>
                    )}
                  </div>
                  {previewPageCount > 1 && (
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="outline" size="icon" onClick={() => setPreviewPage((p) => Math.max(1, p - 1))} disabled={previewPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {previewPage} / {previewPageCount}</span>
                      <Button variant="outline" size="icon" onClick={() => setPreviewPage((p) => Math.min(previewPageCount, p + 1))} disabled={previewPage >= previewPageCount}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    disabled={!previewBlobUrl}
                    onClick={() => previewBlobUrl && window.open(previewBlobUrl, "_blank")}
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
                  label="Montant TVA"
                  value={eur(selectedInvoice.amountTTC - selectedInvoice.amountHT)}
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
