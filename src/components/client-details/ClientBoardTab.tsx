import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Trash2, RefreshCw, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';
import { useUserRole } from '@/hooks/useUserRole';

interface BudgetRow {
  month: string;
  sea: number;
  meta: number;
  tiktok: number;
  total: number;
  cumul: number;
}

interface ClientBoardTabProps {
  clientId: string;
  clientEmailDomain: string;
}

export function ClientBoardTab({ clientId, clientEmailDomain }: ClientBoardTabProps) {
  const [data, setData] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { role } = useUserRole();

  const domain = clientEmailDomain || 'groupeseb.com';
  const canManageBoard = role === 'admin' || role === 'team' || role === 'agency';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('client_budget_data')
      .select('month, sea, meta, tiktok, total, cumul')
      .eq('client_email_domain', domain)
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageBoard) {
      toast.error("Vous n’avez pas les droits pour modifier ce board");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      if (jsonData.length < 2) {
        toast.error('Le fichier ne contient pas assez de données');
        return;
      }

      // Parse rows (skip header row)
      const parsedRows: BudgetRow[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row[0]) continue;

        // Clean month name (remove parenthetical notes)
        const rawMonth = String(row[0]).trim();
        const month = rawMonth.replace(/\s*\(.*\)/, '');

        parsedRows.push({
          month,
          sea: Number(row[1]) || 0,
          meta: Number(row[2]) || 0,
          tiktok: Number(row[3]) || 0,
          total: Number(row[4]) || 0,
          cumul: Number(row[5]) || 0,
        });
      }

      if (parsedRows.length === 0) {
        toast.error('Aucune donnée valide trouvée dans le fichier');
        return;
      }

      // Delete existing data for this domain
      const { error: deleteError } = await supabase
        .from('client_budget_data')
        .delete()
        .eq('client_email_domain', domain);

      if (deleteError) throw deleteError;

      // Insert new data
      const { error: insertError } = await supabase
        .from('client_budget_data')
        .insert(parsedRows.map(r => ({
          client_email_domain: domain,
          month: r.month,
          sea: r.sea,
          meta: r.meta,
          tiktok: r.tiktok,
          total: r.total,
          cumul: r.cumul,
        })));

      if (insertError) throw insertError;

      toast.success(`${parsedRows.length} mois importés avec succès`);
      fetchData();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error("Erreur lors de l'import : " + (error.message || 'Erreur inconnue'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAll = async () => {
    if (!canManageBoard) {
      toast.error("Vous n’avez pas les droits pour modifier ce board");
      return;
    }

    try {
      const { error } = await supabase
        .from('client_budget_data')
        .delete()
        .eq('client_email_domain', domain);

      if (error) throw error;
      toast.success('Données supprimées');
      setData([]);
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatEuro = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const totalBudget = data.length > 0 ? data[data.length - 1].cumul : 0;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gestion du budget publicitaire</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing || !canManageBoard}
              className="gap-2"
            >
              {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {data.length > 0 ? 'Remplacer les données (Excel)' : 'Importer un fichier Excel'}
            </Button>

            {data.length > 0 && canManageBoard && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Supprimer les données
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer toutes les données budget ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera toutes les données du budget publicitaire pour ce client. Le graphique sur le board client sera également vide.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <p className="text-xs text-muted-foreground ml-auto">
              {canManageBoard
                ? 'Format attendu : Mois | SEA | Meta | TikTok | Total | Cumul'
                : 'Visualisation seule pour ce profil'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {data.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Aperçu — Budget total : {formatEuro(totalBudget)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatEuro(value), name]}
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
      )}

      {/* Data table */}
      {data.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Détail mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead className="text-right">SEA</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">TikTok</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Cumul</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right">{formatEuro(row.sea)}</TableCell>
                      <TableCell className="text-right">{formatEuro(row.meta)}</TableCell>
                      <TableCell className="text-right">{formatEuro(row.tiktok)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatEuro(row.total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatEuro(row.cumul)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune donnée budget importée</p>
            <p className="text-sm text-muted-foreground mt-1">
              Importez un fichier Excel pour alimenter le board client
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
