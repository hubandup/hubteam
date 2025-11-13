import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Euro, Calendar, Loader2, Upload, ExternalLink, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

interface ClientQuotesInvoicesTabProps {
  clientId: string;
}

export function ClientQuotesInvoicesTab({ clientId }: ClientQuotesInvoicesTabProps) {
  const { isAdmin } = useUserRole();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    try {
      const [quotesResult, invoicesResult] = await Promise.all([
        supabase
          .from('quotes')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ]);

      if (quotesResult.error) throw quotesResult.error;
      if (invoicesResult.error) throw invoicesResult.error;

      setQuotes(quotesResult.data || []);
      setInvoices(invoicesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleFileUpload = async (file: File, id: string, type: 'quote' | 'invoice') => {
    if (!file.type.includes('pdf')) {
      toast.error('Seuls les fichiers PDF sont acceptés');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 10 MB');
      return;
    }

    setUploadingId(id);
    try {
      const fileExt = 'pdf';
      const fileName = `${type}_${id}_${Date.now()}.${fileExt}`;
      const filePath = `${clientId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('invoices-quotes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('invoices-quotes')
        .getPublicUrl(filePath);

      const table = type === 'quote' ? 'quotes' : 'invoices';
      const { error: updateError } = await supabase
        .from(table)
        .update({ pdf_url: filePath })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('PDF ajouté avec succès');
      fetchData();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors de l\'ajout du PDF');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeletePdf = async (id: string, pdfUrl: string, type: 'quote' | 'invoice') => {
    try {
      const { error: deleteStorageError } = await supabase.storage
        .from('invoices-quotes')
        .remove([pdfUrl]);

      if (deleteStorageError) throw deleteStorageError;

      const table = type === 'quote' ? 'quotes' : 'invoices';
      const { error: updateError } = await supabase
        .from(table)
        .update({ pdf_url: null })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('PDF supprimé');
      fetchData();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Erreur lors de la suppression du PDF');
    }
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, id: string, type: 'quote' | 'invoice') => {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file, id, type);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      accepted: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      paid: 'default',
      unpaid: 'destructive',
    };
    const labels: Record<string, string> = {
      accepted: 'Accepté',
      pending: 'En attente',
      rejected: 'Refusé',
      paid: 'Payée',
      unpaid: 'Impayée',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const renderPdfSection = (item: any, type: 'quote' | 'invoice') => {
    if (!isAdmin) {
      if (item.pdf_url) {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const { data } = supabase.storage.from('invoices-quotes').getPublicUrl(item.pdf_url);
              window.open(data.publicUrl, '_blank');
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Voir le PDF
          </Button>
        );
      }
      return null;
    }

    if (item.pdf_url) {
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const { data } = supabase.storage.from('invoices-quotes').getPublicUrl(item.pdf_url);
              window.open(data.publicUrl, '_blank');
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Voir le PDF
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDeletePdf(item.id, item.pdf_url, type)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    const isDragging = dragOverId === item.id;
    const isUploading = uploadingId === item.id;

    return (
      <div
        onDragOver={(e) => handleDragOver(e, item.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, item.id, type)}
        className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Ajout en cours...</span>
          </div>
        ) : (
          <>
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground mb-2">
              Glissez-déposez un PDF ici
            </p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, item.id, type);
              }}
              className="hidden"
              id={`file-${item.id}`}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById(`file-${item.id}`)?.click()}
            >
              Parcourir
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Devis ({quotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun devis pour le moment
            </p>
          ) : (
            <div className="space-y-4">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{quote.quote_number}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(quote.created_at), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    {getStatusBadge(quote.status)}
                  </div>
                  <div className="flex items-center gap-1 text-lg font-bold text-primary">
                    <Euro className="h-4 w-4" />
                    {quote.amount.toLocaleString('fr-FR')} €
                  </div>
                  {renderPdfSection(quote, 'quote')}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Factures ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune facture pour le moment
            </p>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <div className="flex items-center gap-1 text-lg font-bold text-primary">
                    <Euro className="h-4 w-4" />
                    {invoice.amount.toLocaleString('fr-FR')} €
                  </div>
                  {renderPdfSection(invoice, 'invoice')}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
