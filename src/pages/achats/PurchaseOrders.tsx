import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, Toolbar } from "@/components/layout";
import { PillButton } from "@/components/ui/pill-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, ArrowUpDown, Settings2, Users, Loader2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { exportPurchaseOrdersToXlsx } from "@/lib/po-export";
import { PurchaseOrderFormDrawer } from "@/components/achats/PurchaseOrderFormDrawer";
import {
  usePurchaseOrders,
  fetchPurchaseOrdersForExport,
  type PoSortKey,
} from "@/hooks/usePurchaseOrders";
import { useSuppliers, usePurchaseCategories } from "@/hooks/usePurchasing";
import {
  formatEUR,
  formatDateFR,
  formatFrNumber,
  PO_STATUS_LABELS,
  PO_STATUS_BADGE,
} from "@/lib/purchasing";

const PAGE_SIZE = 25;
const ALL = "all";

const COLUMNS: Array<{ key: PoSortKey; label: string; align?: "right" }> = [
  { key: "po_number", label: "N° PO" },
  { key: "status", label: "Statut" },
  { key: "hubup_dossier_ref", label: "N° dossier H&U" },
  { key: "description", label: "Objet" },
  { key: "amount_ht", label: "Montant HT", align: "right" },
  { key: "vat_rate", label: "TVA", align: "right" },
  { key: "amount_ttc", label: "Montant TTC", align: "right" },
  { key: "validation_date", label: "Validation" },
  { key: "payment_date", label: "Règlement" },
];

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { data: suppliers = [] } = useSuppliers();
  const { data: categories = [] } = usePurchaseCategories();

  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [dossierRef, setDossierRef] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<PoSortKey>("validation_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      search,
      supplierId: supplierId === ALL ? undefined : supplierId,
      categoryId: categoryId === ALL ? undefined : categoryId,
      status: status === ALL ? undefined : status,
      dossierRef,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [search, supplierId, categoryId, status, dossierRef, dateFrom, dateTo],
  );

  const { data, isLoading, isFetching } = usePurchaseOrders({
    filters,
    sortKey,
    sortAsc,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const totalCount = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleSort = (key: PoSortKey) => {
    setPage(0);
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(0);
    setter(v);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportRows = await fetchPurchaseOrdersForExport(filters, sortKey, sortAsc);
      if (exportRows.length === 0) {
        toast.error("Aucune ligne à exporter");
        return;
      }
      exportPurchaseOrdersToXlsx(exportRows);
      toast.success(`${exportRows.length} bon(s) de commande exporté(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export impossible");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bons de commande"
        subtitle="Suivi des achats et engagements fournisseurs"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/achats/fournisseurs">
                <Users className="h-4 w-4 mr-2" /> Fournisseurs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/achats/parametres">
                <Settings2 className="h-4 w-4 mr-2" /> Paramètres
              </Link>
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exporter
            </Button>
            <PillButton onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau bon de commande
            </PillButton>
          </div>
        }
      />

      <Toolbar>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="N° PO, fournisseur, dossier, devis, objet…"
            className="pl-9"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
        </div>
        <Input
          placeholder="N° dossier"
          className="w-[140px]"
          value={dossierRef}
          onChange={(e) => resetPage(setDossierRef)(e.target.value)}
        />
        <Select value={supplierId} onValueChange={resetPage(setSupplierId)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Fournisseur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les fournisseurs</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={resetPage(setCategoryId)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={resetPage(setStatus)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les statuts</SelectItem>
            {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-[150px]"
            value={dateFrom}
            onChange={(e) => resetPage(setDateFrom)(e.target.value)}
          />
          <span className="text-muted-foreground text-sm">→</span>
          <Input
            type="date"
            className="w-[150px]"
            value={dateTo}
            onChange={(e) => resetPage(setDateTo)(e.target.value)}
          />
        </div>
      </Toolbar>

      <div className="rounded-3xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.slice(0, 2).map((col) => (
                  <TableHead key={col.key}>
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label} <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                ))}
                <TableHead>Fournisseur</TableHead>
                {COLUMNS.slice(2, 4).map((col) => (
                  <TableHead key={col.key}>
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label} <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                ))}
                <TableHead>Catégorie</TableHead>
                {COLUMNS.slice(4).map((col) => (
                  <TableHead key={col.key} className={col.align === "right" ? "text-right" : ""}>
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label} <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    Aucun bon de commande
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((po) => (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/achats/bons-de-commande/${po.id}`)}
                  >
                    <TableCell className="font-medium whitespace-nowrap">{po.po_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge className={PO_STATUS_BADGE[po.status]} variant="secondary">
                          {PO_STATUS_LABELS[po.status]}
                        </Badge>
                        {po.sync_status === "failed" && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 whitespace-nowrap"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" /> À reporter manuellement
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {po.suppliers?.company_name ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{po.hubup_dossier_ref}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{po.description ?? "—"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {po.purchase_categories?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatEUR(po.amount_ht, po.currency)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatFrNumber(Number(po.vat_rate))} %
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatEUR(po.amount_ttc, po.currency)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateFR(po.validation_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateFR(po.payment_date)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totals && (
          <div className="border-t bg-muted/40 px-4 py-3 text-sm space-y-1">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">
                {totals.count} bon{totals.count > 1 ? "s" : ""} de commande (hors annulés)
              </span>
              <span>
                Total HT <strong>{formatEUR(totals.ht)}</strong> · Total TTC{" "}
                <strong>{formatEUR(totals.ttc)}</strong>
              </span>
            </div>
            {totals.cancelledCount > 0 && (
              <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                <span>
                  {totals.cancelledCount} annulé{totals.cancelledCount > 1 ? "s" : ""}
                </span>
                <span>
                  Total HT {formatEUR(totals.cancelledHt)} · Total TTC{" "}
                  {formatEUR(totals.cancelledTtc)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} résultat{totalCount > 1 ? "s" : ""} · page {page + 1} / {pageCount}
          {isFetching && !isLoading ? " · actualisation…" : ""}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      </div>

      <PurchaseOrderFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={(po) => navigate(`/achats/bons-de-commande/${po.id}`)}
      />
    </div>
  );
}
