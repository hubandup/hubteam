import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InvoiceStatus = "À payer" | "Payé";

interface Invoice {
  id: string;
  supplier: string;
  invoiceNumber: string;
  amountHT: number;
  amountTTC: number;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  status: InvoiceStatus;
  paymentDetail: string;
  fileUrl: string;
  remark: string;
  fiscalYear: string | null;
  kdriveFolder: string | null;
  kdriveFileId: string | null;
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

// Extract payment date from `paymentDetail` strings like
// "Rapprochement bancaire 12/03/2025"
const parsePaymentDate = (detail: string): Date | null => {
  if (!detail) return null;
  const m = detail.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  return isNaN(d.getTime()) ? null : d;
};

const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

interface Props {
  invoices: Invoice[];
  fiscalYear: string;
}

export function SupplierStats({ invoices, fiscalYear }: Props) {
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const totalTTC = invoices.reduce((s, i) => s + i.amountTTC, 0);
    const totalHT = invoices.reduce((s, i) => s + i.amountHT, 0);
    const paid = invoices.filter((i) => i.status === "Payé");
    const unpaid = invoices.filter((i) => i.status === "À payer");
    const totalUnpaidTTC = unpaid.reduce((s, i) => s + i.amountTTC, 0);

    // Group by supplier
    const bySupplier = new Map<string, { count: number; ttc: number; ht: number }>();
    invoices.forEach((i) => {
      const key = (i.supplier || "—").trim().toUpperCase();
      const cur = bySupplier.get(key) || { count: 0, ttc: 0, ht: 0 };
      cur.count += 1;
      cur.ttc += i.amountTTC;
      cur.ht += i.amountHT;
      bySupplier.set(key, cur);
    });
    const suppliers = Array.from(bySupplier.entries()).map(([name, v]) => ({
      name,
      ...v,
    }));
    const topByValue = [...suppliers].sort((a, b) => b.ttc - a.ttc).slice(0, 5);
    const topByCount = [...suppliers].sort((a, b) => b.count - a.count).slice(0, 5);

    // Payment delay: paid invoices with parseable payment date
    const delays: number[] = [];
    const lateCount: number[] = [];
    paid.forEach((i) => {
      const pay = parsePaymentDate(i.paymentDetail);
      if (!pay) return;
      const inv = new Date(i.invoiceDate);
      const due = new Date(i.dueDate);
      if (!isNaN(inv.getTime())) delays.push(Math.max(0, daysBetween(inv, pay)));
      if (!isNaN(due.getTime())) lateCount.push(daysBetween(due, pay));
    });
    const avgPaymentDelay = delays.length
      ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
      : null;
    const onTime = lateCount.filter((d) => d <= 0).length;
    const onTimeRatio = lateCount.length
      ? Math.round((onTime / lateCount.length) * 100)
      : null;

    // Overdue unpaid
    const today = new Date();
    const overdue = unpaid.filter((i) => new Date(i.dueDate) < today);
    const overdueTTC = overdue.reduce((s, i) => s + i.amountTTC, 0);

    const avgInvoiceTTC = totalCount ? totalTTC / totalCount : 0;

    // Monthly spend: bucket by YYYY-MM of invoice date
    const byMonth = new Map<string, { ttc: number; ht: number; count: number }>();
    invoices.forEach((i) => {
      const d = new Date(i.invoiceDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = byMonth.get(key) || { ttc: 0, ht: 0, count: 0 };
      cur.ttc += i.amountTTC;
      cur.ht += i.amountHT;
      cur.count += 1;
      byMonth.set(key, cur);
    });
    const monthsWithActivity = byMonth.size;
    const avgMonthlyTTC = monthsWithActivity ? totalTTC / monthsWithActivity : 0;
    const avgMonthlyHT = monthsWithActivity ? totalHT / monthsWithActivity : 0;
    const monthlySpend = Array.from(byMonth.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // All suppliers (sorted by TTC desc)
    const allSuppliers = [...suppliers].sort((a, b) => b.ttc - a.ttc);

    return {
      totalCount,
      totalTTC,
      totalHT,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      totalUnpaidTTC,
      suppliersCount: suppliers.length,
      topByValue,
      topByCount,
      allSuppliers,
      avgPaymentDelay,
      onTimeRatio,
      overdueCount: overdue.length,
      overdueTTC,
      avgInvoiceTTC,
      avgMonthlyTTC,
      avgMonthlyHT,
      monthsWithActivity,
      monthlySpend,
    };
  }, [invoices]);

  if (invoices.length === 0) {
    return (
      <div className="border border-border bg-card p-12 text-center text-muted-foreground">
        Aucune donnée statistique pour l'exercice {fiscalYear}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Factures" value={stats.totalCount.toString()} sub={`${stats.suppliersCount} fournisseurs`} />
        <KpiCard label="Total TTC" value={eur(stats.totalTTC)} sub={`${eur(stats.totalHT)} HT`} />
        <KpiCard
          label="Payées / À payer"
          value={`${stats.paidCount} / ${stats.unpaidCount}`}
          sub={`${eur(stats.totalUnpaidTTC)} restant`}
        />
        <KpiCard label="Montant moyen" value={eur(stats.avgInvoiceTTC)} sub="TTC par facture" />
        <KpiCard
          label="Dépense mensuelle moyenne"
          value={eur(stats.avgMonthlyTTC)}
          sub={
            stats.monthsWithActivity > 0
              ? `${eur(stats.avgMonthlyHT)} HT · sur ${stats.monthsWithActivity} mois`
              : "—"
          }
        />
        <KpiCard
          label="Délai moyen paiement"
          value={stats.avgPaymentDelay !== null ? `${stats.avgPaymentDelay} j` : "—"}
          sub={stats.avgPaymentDelay !== null ? "facture → règlement" : "données insuffisantes"}
        />
        <KpiCard
          label="Payées dans les délais"
          value={stats.onTimeRatio !== null ? `${stats.onTimeRatio}%` : "—"}
          sub={stats.onTimeRatio !== null ? "vs échéance" : "données insuffisantes"}
        />
        <KpiCard
          label="En retard"
          value={stats.overdueCount.toString()}
          sub={`${eur(stats.overdueTTC)} TTC`}
          tone={stats.overdueCount > 0 ? "warn" : "default"}
        />
      </div>

      {/* Top suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 fournisseurs (en valeur TTC)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Factures</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead className="text-right">Part</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topByValue.map((s) => {
                  const share = stats.totalTTC > 0 ? (s.ttc / stats.totalTTC) * 100 : 0;
                  return (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {eur(s.ttc)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {share.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 fournisseurs (en nombre de factures)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Factures</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead className="text-right">Part</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topByCount.map((s) => {
                  const share = stats.totalCount > 0 ? (s.count / stats.totalCount) * 100 : 0;
                  return (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{s.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(s.ttc)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {share.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Statistiques calculées sur l'exercice {fiscalYear}. Le délai moyen de paiement est
        estimé à partir de la date de rapprochement bancaire (champ « Détail paiement »).
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 text-xl font-semibold tabular-nums " +
          (tone === "warn" ? "text-orange-600" : "text-foreground")
        }
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
