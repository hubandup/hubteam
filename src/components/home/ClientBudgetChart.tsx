import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface BudgetRow {
  month: string;
  sea: number;
  meta: number;
  tiktok: number;
  total: number;
  cumul: number;
}

const ALLOWED_DOMAINS = ['groupeseb.com', 'hubandup.com'];

export function ClientBudgetChart() {
  const { user } = useAuth();
  const [data, setData] = useState<BudgetRow[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    const domain = user.email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      setVisible(false);
      setLoading(false);
      return;
    }

    setVisible(true);
    fetchBudgetData();
  }, [user]);

  const fetchBudgetData = async () => {
    const { data: rows, error } = await supabase
      .from('client_budget_data')
      .select('month, sea, meta, tiktok, total, cumul')
      .order('created_at', { ascending: true });

    if (!error && rows) {
      setData(rows.map(r => ({
        month: r.month,
        sea: Number(r.sea),
        meta: Number(r.meta),
        tiktok: Number(r.tiktok),
        total: Number(r.total),
        cumul: Number(r.cumul),
      })));
    }
    setLoading(false);
  };

  if (!visible || loading || data.length === 0) return null;

  const formatEuro = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const totalBudget = data[data.length - 1]?.cumul || 0;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Budget Publicitaire — Répartition mensuelle
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Budget total : {formatEuro(totalBudget)} • Répartition SEA (40%) / Meta (39%) / TikTok (21%)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatEuro(value), name]}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--popover))',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend />
              <Bar dataKey="sea" name="SEA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="meta" name="Meta" fill="hsl(210 80% 55%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tiktok" name="TikTok" fill="hsl(340 75% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
