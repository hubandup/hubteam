import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Euro, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';

export default function Finances() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);
  const [validatedQuotes, setValidatedQuotes] = useState<any[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
      toast.error('Accès refusé : page réservée aux administrateurs');
      return;
    }
    
    if (isAdmin) {
      fetchFinancialData();
      fetchValidatedQuotes();
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    // Subscribe to realtime changes for clients and invoices
    const financialChannel = supabase
      .channel('finances-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchFinancialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchFinancialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(financialChannel);
    };
  }, [isAdmin]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);

      // Fetch clients revenue
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('revenue_current_year, company, first_name, last_name')
        .eq('active', true)
        .order('revenue_current_year', { ascending: false });
      
      if (clientsError) throw clientsError;

      const currentYearRevenue = clients?.reduce((sum, c) => sum + (c.revenue_current_year || 0), 0) || 0;
      setTotalRevenue(currentYearRevenue);

      // Top 5 clients
      setTopClients(clients?.slice(0, 5) || []);

      // Revenue evolution (last 6 months)
      const revenueByMonth: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const { data: monthInvoices, error: monthError } = await supabase
          .from('invoices')
          .select('amount')
          .gte('invoice_date', monthStart.toISOString())
          .lte('invoice_date', monthEnd.toISOString());

        if (monthError) throw monthError;

        const monthRevenue = monthInvoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
        
        revenueByMonth.push({
          month: format(monthDate, 'MMM', { locale: fr }),
          revenue: monthRevenue,
        });
      }

      setRevenueData(revenueByMonth);

      // Get last sync timestamp from clients
      const { data: lastSyncedClient } = await supabase
        .from('clients')
        .select('facturation_pro_synced_at')
        .not('facturation_pro_synced_at', 'is', null)
        .order('facturation_pro_synced_at', { ascending: false })
        .limit(1)
        .single();

      if (lastSyncedClient?.facturation_pro_synced_at) {
        setLastSyncTimestamp(lastSyncedClient.facturation_pro_synced_at);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast.error('Erreur lors du chargement des données financières');
      setLoading(false);
    }
  };

  const fetchValidatedQuotes = async () => {
    setIsLoadingQuotes(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-validated-quotes');
      
      if (error) {
        console.error('Error fetching validated quotes:', error);
        toast.error('Erreur lors du chargement des devis validés');
        return;
      }

      if (data?.quotes) {
        setValidatedQuotes(data.quotes);
      }
    } catch (error) {
      console.error('Error fetching validated quotes:', error);
      toast.error('Erreur lors du chargement des devis validés');
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    toast.info('Synchronisation Facturation.PRO en cours...');
    
    try {
      // Sync clients
      const { error: clientsError } = await supabase.functions.invoke('sync-facturation-pro-clients');
      if (clientsError) throw new Error(`Erreur clients: ${clientsError.message}`);
      
      // Sync invoices
      const { error: invoicesError } = await supabase.functions.invoke('sync-facturation-pro-invoices');
      if (invoicesError) throw new Error(`Erreur factures: ${invoicesError.message}`);
      
      toast.success('Synchronisation Facturation.PRO terminée avec succès');
      
      // Refresh financial data
      fetchFinancialData();
      fetchValidatedQuotes();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate average margin
  const averageMargin = validatedQuotes.length > 0
    ? validatedQuotes.reduce((sum, quote) => sum + quote.margePercent, 0) / validatedQuotes.length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finances</h1>
          <p className="text-muted-foreground">Vue d'ensemble financière</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronisation...' : 'Sync Facturation.PRO'}
          </Button>
          {lastSyncTimestamp && (
            <p className="text-xs text-muted-foreground">
              Dernière sync: {format(new Date(lastSyncTimestamp), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            </p>
          )}
        </div>
      </div>

      {/* Financial Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Année Fiscale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toLocaleString('fr-FR')} €</div>
            <p className="text-xs text-muted-foreground">
              Chiffre d'affaires de l'année fiscale en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge moyenne</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {validatedQuotes.length > 0 ? `${averageMargin.toFixed(1)}%` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Sur les 30 derniers projets validés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution du CA</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                formatter={(value: any) => [`${value.toLocaleString('fr-FR')} €`, 'CA']}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                name="Chiffre d'affaires"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 5 Clients */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun client actif
            </p>
          ) : (
            <div className="space-y-4">
              {topClients.map((client, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate uppercase">{client.company}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.first_name} {client.last_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-success">
                      {(client.revenue_current_year || 0).toLocaleString('fr-FR')} €
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 30 Derniers Projets Validés */}
      <Card>
        <CardHeader>
          <CardTitle>30 Derniers Projets Validés</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingQuotes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : validatedQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun projet validé trouvé
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead className="text-right">Montant HT</TableHead>
                    <TableHead className="text-right">Montant HA</TableHead>
                    <TableHead className="text-right">Marge (€)</TableHead>
                    <TableHead className="text-right">Marge (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedQuotes.map((quote, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{quote.client}</TableCell>
                      <TableCell>{quote.quoteRef}</TableCell>
                      <TableCell className="max-w-xs truncate">{quote.title}</TableCell>
                      <TableCell className="text-right">{quote.montantHT.toLocaleString('fr-FR')} €</TableCell>
                      <TableCell className="text-right">{quote.montantHA.toLocaleString('fr-FR')} €</TableCell>
                      <TableCell className="text-right font-medium">
                        {quote.margeEuro.toLocaleString('fr-FR')} €
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        <span className={quote.margePercent >= 30 ? 'text-success' : quote.margePercent >= 15 ? 'text-warning' : 'text-destructive'}>
                          {quote.margePercent.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
