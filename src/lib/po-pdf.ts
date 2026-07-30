import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatEUR, formatDateFR } from "@/lib/purchasing";
import type { CompanySettings, Supplier } from "@/hooks/usePurchasing";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";

interface BuildPoPdfArgs {
  po: PurchaseOrder;
  supplier: Supplier | null | undefined;
  company: CompanySettings | null | undefined;
  categoryName?: string | null;
}

const line = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : null);

/** Génère le PDF du bon de commande (les notes internes ne sont jamais imprimées). */
export function buildPurchaseOrderPdf({ po, supplier, company, categoryName }: BuildPoPdfArgs): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 16;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BON DE COMMANDE", marginX, y);

  doc.setFontSize(12);
  doc.text(po.po_number, 194, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Date de validation : ${formatDateFR(po.validation_date)}`, 194, y, { align: "right" });
  y += 10;

  // Émetteur / Fournisseur
  const emitter = [
    line(company?.legal_name) ?? "Hub & Up",
    line(company?.address_1),
    line(company?.address_2),
    [line(company?.postal_code), line(company?.city)].filter(Boolean).join(" "),
    line(company?.country),
    company?.siret ? `SIRET : ${company.siret}` : null,
    company?.vat_number ? `TVA : ${company.vat_number}` : null,
    line(company?.phone),
    line(company?.accounting_email),
  ].filter(Boolean) as string[];

  const supplierBlock = [
    line(supplier?.company_name) ?? "—",
    [line(supplier?.first_name), line(supplier?.last_name)].filter(Boolean).join(" ") || null,
    line(supplier?.address_1),
    line(supplier?.address_2),
    [line(supplier?.postal_code), line(supplier?.city)].filter(Boolean).join(" "),
    line(supplier?.country),
    supplier?.vat_number ? `TVA : ${supplier.vat_number}` : null,
    line(supplier?.email),
    line(supplier?.phone),
  ].filter(Boolean) as string[];

  const blockTop = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ÉMETTEUR", marginX, y);
  doc.text("FOURNISSEUR", 110, y);
  doc.setFont("helvetica", "normal");
  y += 5;

  const maxLines = Math.max(emitter.length, supplierBlock.length);
  for (let i = 0; i < maxLines; i++) {
    if (emitter[i]) doc.text(emitter[i], marginX, y + i * 4.5);
    if (supplierBlock[i]) doc.text(supplierBlock[i], 110, y + i * 4.5);
  }
  y = blockTop + 5 + maxLines * 4.5 + 8;

  // Références
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    head: [["N° dossier Hub & Up", "N° devis fournisseur", "Catégorie d'achat"]],
    body: [[po.hubup_dossier_ref || "—", po.supplier_quote_ref || "—", categoryName || "—"]],
    margin: { left: marginX, right: marginX },
  });
  // @ts-expect-error lastAutoTable is injected by jspdf-autotable
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Descriptif + montants
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    head: [["Descriptif", "Montant HT"]],
    body: [[po.description || "—", formatEUR(po.amount_ht, po.currency)]],
    margin: { left: marginX, right: marginX },
  });
  // @ts-expect-error lastAutoTable is injected by jspdf-autotable
  y = (doc.lastAutoTable?.finalY ?? y) + 4;

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { halign: "right", cellWidth: 120 },
      1: { halign: "right", fontStyle: "bold" },
    },
    body: [
      ["Total HT", formatEUR(po.amount_ht, po.currency)],
      [`TVA (${Number(po.vat_rate).toFixed(2).replace(".", ",")} %)`, formatEUR(po.amount_vat, po.currency)],
      ["Total TTC", formatEUR(po.amount_ttc, po.currency)],
    ],
    margin: { left: marginX, right: marginX },
  });
  // @ts-expect-error lastAutoTable is injected by jspdf-autotable
  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  doc.setFontSize(9);
  doc.text(`Date de règlement prévue : ${formatDateFR(po.payment_date)}`, marginX, y);
  y += 6;
  if (supplier?.iban) {
    doc.text(`IBAN : ${supplier.iban}${supplier.bic ? ` — BIC : ${supplier.bic}` : ""}`, marginX, y);
    y += 6;
  }

  if (po.status === "cancelled") {
    doc.setTextColor(190, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BON DE COMMANDE ANNULÉ", marginX, y + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${po.po_number} — document généré le ${formatDateFR(new Date())}`,
    marginX,
    287,
  );

  return doc;
}

export const purchaseOrderPdfPath = (po: { id: string; po_number: string }) =>
  `${po.id}/${po.po_number}.pdf`;
