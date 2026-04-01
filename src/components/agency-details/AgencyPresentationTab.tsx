import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  agencyId: string;
}

export function AgencyPresentationTab({ agencyId }: Props) {
  const [presentation, setPresentation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPresentation();
  }, [agencyId]);

  const fetchPresentation = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_attestations')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('attestation_type', 'presentation')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPresentation(data);
    } catch (error) {
      console.error('Error fetching presentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!presentation) return;
    try {
      const { data, error } = await supabase.storage
        .from('agency-attestations')
        .download(presentation.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = presentation.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <FileText className="h-10 w-10" />
        <p className="text-sm">Aucune présentation disponible pour le moment.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-8 w-8 text-destructive flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{presentation.file_name}</p>
              <p className="text-xs text-muted-foreground">
                Mis à jour le {format(new Date(presentation.uploaded_at), 'dd MMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            Télécharger
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
