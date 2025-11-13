import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface ClientInvoicesTabProps {
  clientId: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  title?: string;
  amount: number;
  status: string;
  invoice_date: string;
  facturation_pro_id?: string | null;
  facturation_pro_pdf_url?: string;
  created_at: string;
}

export function ClientInvoicesTab({ clientId }: ClientInvoicesTabProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, [clientId]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default">Payée</Badge>;
      case 'unpaid':
        return <Badge variant="destructive">Impayée</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSyncInvoices = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.functions.invoke('sync-facturation-pro-invoices');
      
      if (error) throw error;
      
      toast.success('Synchronisation des factures réussie');
      fetchInvoices();
    } catch (error) {
      console.error('Error syncing invoices:', error);
      toast.error('Erreur lors de la synchronisation des factures');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    // Open a blank tab immediately to avoid popup blockers
    const newTab = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-invoice-pdf?invoice_id=${invoiceId}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Téléchargement PDF échoué (${response.status})`);
      }

      // Create blob URL and open in the pre-opened tab
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      if (newTab) {
        newTab.location.href = url;
      } else {
        // Fallback: force download via a temporary link
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.download = `facture-${invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Clean up the blob URL (delay for Safari compatibility)
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (newTab) {
        newTab.close();
      }
      console.error('Error downloading PDF:', error);
      toast.error("Erreur lors de l'ouverture du PDF");
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Factures</h3>
        <Button onClick={handleSyncInvoices} variant="outline" size="sm">
          <Loader2 className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Synchroniser
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Aucune facture trouvée pour ce client
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">
                        Facture {invoice.invoice_number}
                      </CardTitle>
                      {invoice.title && (
                        <p className="text-sm font-medium mt-1">
                          {invoice.title}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {invoice.invoice_date
                          ? format(new Date(invoice.invoice_date), 'dd MMMM yyyy', {
                              locale: fr,
                            })
                          : format(new Date(invoice.created_at), 'dd MMMM yyyy', {
                              locale: fr,
                            })}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {invoice.amount.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </p>
                  </div>
                  {invoice.facturation_pro_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger le PDF
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
