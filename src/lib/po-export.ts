import * as XLSX from "xlsx";
import { PO_STATUS_LABELS } from "@/lib/purchasing";
import type { PurchaseOrderExportRow } from "@/hooks/usePurchaseOrders";

const HEADERS = [
  "N° PO",
  "Statut",
  "Date de validation",
  "Fournisseur",
  "N° TVA intracommunautaire",
  "N° dossier H&U",
  "N° devis fournisseur",
  "Objet",
  "Catégorie",
  "Montant HT",
  "Taux TVA",
  "Montant TVA",
  "Montant TTC",
  "Date de règlement",
  "Date d'envoi",
  "Créé par",
  "Motif d'annulation",
] as const;

const COLUMN_WIDTHS = [18, 12, 16, 28, 22, 18, 20, 46, 20, 14, 10, 14, 14, 16, 16, 24, 34];
const CURRENCY_FMT = '#,##0.00\\ "€"';
const PERCENT_FMT = '0.00\\ "%"';

const toDate = (value: string | null | undefined) => (value ? new Date(value) : "");

export function exportPurchaseOrdersToXlsx(rows: PurchaseOrderExportRow[]) {
  const data = rows.map((po) => [
    po.po_number,
    PO_STATUS_LABELS[po.status] ?? po.status,
    toDate(po.validation_date),
    po.supplier_name ?? "",
    po.supplier_vat_number ?? "",
    po.hubup_dossier_ref ?? "",
    po.supplier_quote_ref ?? "",
    po.description ?? "",
    po.category_name ?? "",
    Number(po.amount_ht ?? 0),
    Number(po.vat_rate ?? 0),
    Number(po.amount_vat ?? 0),
    Number(po.amount_ttc ?? 0),
    toDate(po.payment_date),
    toDate(po.sent_at),
    po.created_by_name ?? "",
    po.cancellation_reason ?? "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([[...HEADERS], ...data], { cellDates: true });
  sheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));
  sheet["!freeze"] = { xSplit: "0", ySplit: "1", topLeftCell: "A2", activePane: "bottomLeft" };
  // En-têtes figés (lecture par Excel et LibreOffice)
  (sheet as unknown as { "!autofilter"?: { ref: string } })["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: HEADERS.length - 1, r: Math.max(data.length, 1) },
    }),
  };

  data.forEach((_row, index) => {
    const r = index + 1;
    for (const c of [9, 11, 12]) {
      const cell = sheet[XLSX.utils.encode_cell({ c, r })];
      if (cell) cell.z = CURRENCY_FMT;
    }
    const vatCell = sheet[XLSX.utils.encode_cell({ c: 10, r })];
    if (vatCell) vatCell.z = PERCENT_FMT;
    for (const c of [2, 13, 14]) {
      const cell = sheet[XLSX.utils.encode_cell({ c, r })];
      if (cell && cell.t === "d") cell.z = "dd/mm/yyyy";
    }
  });

  const book = XLSX.utils.book_new();
  book.Workbook = { Views: [{ RTL: false }] };
  XLSX.utils.book_append_sheet(book, sheet, "Bons de commande");

  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  XLSX.writeFile(book, `bons-de-commande_${stamp}.xlsx`, { compression: true });
}
