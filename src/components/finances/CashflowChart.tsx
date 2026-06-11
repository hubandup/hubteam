import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowDownUp } from 'lucide-react';

interface Props {
  periodMonths: number;
}

interface Row {
  month: string;
  encaissements: number;
  depenses: number;
  solde: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export function CashflowChart({ periodMonths }: Props) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const startDate = startOfMonth(subMonths(new Date(), periodMonths - 1));
      const endDate = endOfMonth(new Date());

      const [invRes, supRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('invoice_date, amount, amount_ht')
          .gte('invoice_date', startDate.toISOString())
          .lte('invoice_date', endDate.toISOString()),
        supabase
          .from('supplier_invoices')
          .select('invoice_date, amount_ht, amount_ttc')
          .gte('invoice_date', format(startDate, 'yyyy-MM-dd'))
          .lte('invoice_date', format(endDate, 'yyyy-MM-dd')),
      ]);

      const buckets: Record<string, { enc: number; dep: number }> = {};
      for (let i = periodMonths - 1; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        buckets[format(d, 'yyyy-MM')] = { enc: 0, dep: 0 };
      }

      (invRes.data || []).forEach((row: any) => {
        if (!row.invoice_date) return;
        const k = format(new Date(row.invoice_date), 'yyyy-MM');
        if (!buckets[k]) return;
        buckets[k].enc += Number(row.amount_ht ?? row.amount ?? 0);
      });

      (supRes.data || []).forEach((row: any) => {
        if (!row.invoice_date) return;
        const k = format(new Date(row.invoice_date), 'yyyy-MM');
        if (!buckets[k]) return;
        buckets[k].dep += Number(row.amount_ht ?? row.amount_ttc ?? 0);
      });

      const rows: Row[] = Object.entries(buckets).map(([key, { enc, dep }]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', { locale: fr }),
        encaissements: Math.round(enc),
        depenses: Math.round(dep),
        solde: Math.round(enc - dep),
      }));

      if (!cancelled) {
        setData(rows);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [periodMonths]);

  const totalEnc = data.reduce((s, r) => s + r.encaissements, 0);
  const totalDep = data.reduce((s, r) => s + r.depenses, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-primary" />
          Encaissements vs Dépenses
        </CardTitle>
        {!loading && (
          <p className="text-sm text-muted-foreground">
            Sur {periodMonths} mois — Encaissements&nbsp;: <span className="font-semibold text-emerald-600">{fmt(totalEnc)}</span>
            {' · '}Dépenses&nbsp;: <span className="font-semibold text-rose-600">{fmt(totalDep)}</span>
            {' · '}Solde&nbsp;: <span className={`font-semibold ${totalEnc - totalDep >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(totalEnc - totalDep)}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name]}
                  contentStyle={{
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--popover))',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="encaissements"
                  name="Encaissements (HT)"
                  stroke="hsl(152 70% 40%)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="depenses"
                  name="Dépenses (HT)"
                  stroke="hsl(0 75% 55%)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="solde"
                  name="Solde"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
