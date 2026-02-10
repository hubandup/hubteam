import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MonthData {
  month: string;
  revenue: number | null;
  forecast?: number | null;
}

interface MonthlyComparisonTableProps {
  data: MonthData[];
}

export function MonthlyComparisonTable({ data }: MonthlyComparisonTableProps) {
  const months = data.filter(d => d.revenue !== null && d.revenue !== undefined);

  if (months.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparatif mensuel du CA</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">CA (€)</TableHead>
                <TableHead className="text-right">Variation</TableHead>
                <TableHead className="text-right">Variation (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((item, index) => {
                const prev = index > 0 ? months[index - 1].revenue! : null;
                const current = item.revenue!;
                const variation = prev !== null ? current - prev : null;
                const variationPercent = prev !== null && prev !== 0
                  ? ((current - prev) / prev) * 100
                  : null;

                return (
                  <TableRow key={item.month}>
                    <TableCell className="font-medium capitalize">{item.month}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {current.toLocaleString('fr-FR')} €
                    </TableCell>
                    <TableCell className="text-right">
                      {variation !== null ? (
                        <span className={`flex items-center justify-end gap-1 ${
                          variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          {variation > 0 ? <TrendingUp className="h-3 w-3" /> : variation < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {variation > 0 ? '+' : ''}{variation.toLocaleString('fr-FR')} €
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {variationPercent !== null ? (
                        <span className={`font-bold ${
                          variationPercent > 0 ? 'text-green-600' : variationPercent < 0 ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          {variationPercent > 0 ? '+' : ''}{variationPercent.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
