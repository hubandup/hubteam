import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Loader2 } from "lucide-react";

// Fiscal year (April 1 → March 31)
const computeFiscalYear = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  return `${start}/${start + 1}`;
};
const currentFY = computeFiscalYear(new Date().toISOString())!;
const fyStartDate = (fy: string) => new Date(`${fy.split("/")[0]}-04-01T00:00:00Z`);
const fyEndDate = (fy: string) => new Date(`${fy.split("/")[1]}-04-01T00:00:00Z`);

const MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_LABELS = ["Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc", "Jan", "Fév", "Mars"];

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

type SupplierInvoice = {
  supplier: string;
  amount_ht: number | null;
  amount_ttc: number | null;
  invoice_date: string | null;
  due_date: string | null;
  status: string;
  fiscal_year: string | null;
};

type RevenueInvoice = { invoice_date: string | null; amount: number };

export function ComptabiliteAnalytics() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierInvoice[]>([]);
  const [revenues, setRevenues] = useState<RevenueInvoice[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sup, rev] = await Promise.all([
        supabase
          .from("supplier_invoices")
          .select("supplier, amount_ht, amount_ttc, invoice_date, due_date, status, fiscal_year"),
        supabase
          .from("invoices")
          .select("invoice_date, amount")
          .gte("invoice_date", fyStartDate(currentFY).toISOString())
          .lt("invoice_date", fyEndDate(currentFY).toISOString()),
      ]);
      if (cancelled) return;
      setSuppliers((sup.data as SupplierInvoice[]) || []);
      setRevenues((rev.data as RevenueInvoice[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Monthly HT supplier vs Revenue HT (current FY) ----------
  const monthlyData = useMemo(() => {
    const supByMonth: Record<number, number> = {};
    const tvaByMonth: Record<number, number> = {};
    const revByMonth: Record<number, number> = {};

    suppliers.forEach((s) => {
      const fy = s.fiscal_year || computeFiscalYear(s.invoice_date);
      if (fy !== currentFY || !s.invoice_date) return;
      const m = new Date(s.invoice_date).getUTCMonth() + 1;
      const ht = Number(s.amount_ht || 0);
      const ttc = Number(s.amount_ttc || 0);
      supByMonth[m] = (supByMonth[m] || 0) + ht;
      tvaByMonth[m] = (tvaByMonth[m] || 0) + Math.max(0, ttc - ht);
    });

    revenues.forEach((r) => {
      if (!r.invoice_date) return;
      const m = new Date(r.invoice_date).getUTCMonth() + 1;
      revByMonth[m] = (revByMonth[m] || 0) + Number(r.amount || 0);
    });

    return MONTH_ORDER.map((m, i) => ({
      month: MONTH_LABELS[i],
      "Achats HT": Math.round(supByMonth[m] || 0),
      "CA HT": Math.round(revByMonth[m] || 0),
      "TVA collectée": Math.round(tvaByMonth[m] || 0),
    }));
  }, [suppliers, revenues]);

  // ---------- Spend per supplier per fiscal year ----------
  const spendByFY = useMemo(() => {
    const fyMap: Record<string, Record<string, number>> = {};
    const fySet = new Set<string>();
    const supplierSet = new Set<string>();
    suppliers.forEach((s) => {
      const fy = s.fiscal_year || computeFiscalYear(s.invoice_date);
      if (!fy) return;
      fySet.add(fy);
      const name = (s.supplier || "—").toUpperCase();
      supplierSet.add(name);
      fyMap[fy] = fyMap[fy] || {};
      fyMap[fy][name] = (fyMap[fy][name] || 0) + Number(s.amount_ht || 0);
    });
    const fys = Array.from(fySet).sort().reverse();
    const supplierList = Array.from(supplierSet).sort();
    return { fys, supplierList, fyMap };
  }, [suppliers]);

  // ---------- Top 10 suppliers (current FY, HT) ----------
  const topSuppliers = useMemo(() => {
    const map: Record<string, number> = {};
    suppliers.forEach((s) => {
      const fy = s.fiscal_year || computeFiscalYear(s.invoice_date);
      if (fy !== currentFY) return;
      const name = (s.supplier || "—").toUpperCase();
      map[name] = (map[name] || 0) + Number(s.amount_ht || 0);
    });
    return Object.entries(map)
      .map(([supplier, amount]) => ({ supplier, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [suppliers]);

  // ---------- Total late payments ----------
  const latePayments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const late = suppliers.filter((s) => {
      if (s.status === "Payé" || s.status === "paid") return false;
      if (!s.due_date) return false;
      return new Date(s.due_date) < today;
    });
    const total = late.reduce((sum, s) => sum + Number(s.amount_ttc || 0), 0);
    return { total, count: late.length };
  }, [suppliers]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI: Late payments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retards de paiement (fournisseurs)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{eur(latePayments.total)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {latePayments.count} facture{latePayments.count > 1 ? "s" : ""} en retard
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly comparison chart */}
      <Card>
        <CardHeader>
          <CardTitle>Achats HT vs CA HT — Exercice {currentFY}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Comparaison mensuelle des dépenses fournisseurs (HT) et du chiffre d'affaires (HT)
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => eur(v)} />
              <Legend />
              <Bar dataKey="CA HT" fill="#E8FF4C" />
              <Bar dataKey="Achats HT" fill="#000000" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly VAT */}
      <Card>
        <CardHeader>
          <CardTitle>TVA mois par mois — Exercice {currentFY}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            TVA déductible sur factures fournisseurs (TTC − HT)
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
              <Tooltip formatter={(v: number) => eur(v)} />
              <Bar dataKey="TVA collectée" fill="#E8FF4C" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 suppliers */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 fournisseurs — Exercice {currentFY}</CardTitle>
        </CardHeader>
        <CardContent>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSuppliers.map((s, i) => (
                  <TableRow key={s.supplier}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium uppercase">{s.supplier}</TableCell>
                    <TableCell className="text-right font-mono">{eur(s.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Spend by supplier per fiscal year */}
      <Card>
        <CardHeader>
          <CardTitle>Dépenses par fournisseur — par exercice fiscal</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Montants HT cumulés par exercice</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {spendByFY.supplierList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  {spendByFY.fys.map((fy) => (
                    <TableHead key={fy} className="text-right">
                      {fy}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spendByFY.supplierList
                  .map((sup) => {
                    const row = spendByFY.fys.map((fy) => spendByFY.fyMap[fy]?.[sup] || 0);
                    const total = row.reduce((s, v) => s + v, 0);
                    return { sup, row, total };
                  })
                  .sort((a, b) => b.total - a.total)
                  .map(({ sup, row, total }) => (
                    <TableRow key={sup}>
                      <TableCell className="font-medium uppercase">{sup}</TableCell>
                      {row.map((v, idx) => (
                        <TableCell key={idx} className="text-right font-mono">
                          {v > 0 ? eur(v) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono font-bold">{eur(total)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
