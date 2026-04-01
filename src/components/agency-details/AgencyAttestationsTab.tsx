import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, AlertTriangle, CheckCircle, Clock, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, addMonths, isPast, isBefore, addWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AttestationType {
  key: string;
  label: string;
  validityMonths: number;
}

const ATTESTATION_TYPES: AttestationType[] = [
  { key: 'presentation', label: 'Présentation de l\'entreprise', validityMonths: 12 },
  { key: 'urssaf', label: 'Attestation de vigilance URSSAF', validityMonths: 3 },
  { key: 'non_dependance', label: 'Attestation de non dépendance financière Hub & Up', validityMonths: 12 },
  { key: 'nda', label: 'NDA Hub & Up', validityMonths: 12 },
  { key: 'kbis', label: 'KBIS', validityMonths: 12 },
  { key: 'rc_pro', label: 'Assurance RC Pro', validityMonths: 12 },
];

interface Attestation {
  id: string;
  attestation_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  expires_at: string;
}

interface Props {
  agencyId: string;
  canEdit: boolean;
}

export function AgencyAttestationsTab({ agencyId, canEdit }: Props) {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchAttestations();
  }, [agencyId]);

  const fetchAttestations = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_attestations')
        .select('*')
        .eq('agency_id', agencyId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setAttestations(data || []);
    } catch (error) {
      console.error('Error fetching attestations:', error);
      toast.error('Erreur lors du chargement des attestations');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (type: AttestationType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
        toast.error('Seuls les fichiers PDF sont acceptés');
        return;
      }

      setUploading(type.key);
      try {
        const filePath = `${agencyId}/${type.key}_${Date.now()}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from('agency-attestations')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const expiresAt = addMonths(new Date(), type.validityMonths);
        const userId = (await supabase.auth.getUser()).data.user?.id;

        const { data: insertedData, error: insertError } = await supabase
          .from('agency_attestations')
          .insert({
            agency_id: agencyId,
            attestation_type: type.key,
            file_name: file.name,
            file_path: filePath,
            expires_at: expiresAt.toISOString(),
            uploaded_by: userId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Update state immediately with the new attestation
        if (insertedData) {
          setAttestations(prev => [insertedData, ...prev]);
        }

        toast.success('Document uploadé avec succès');
      } catch (error) {
        console.error('Upload error:', error);
        toast.error("Erreur lors de l'upload du document");
      } finally {
        setUploading(null);
      }
    };
    input.click();
  };

  const handleDelete = async (attestation: Attestation) => {
    if (!confirm('Supprimer ce document ?')) return;

    try {
      await supabase.storage
        .from('agency-attestations')
        .remove([attestation.file_path]);

      const { error } = await supabase
        .from('agency_attestations')
        .delete()
        .eq('id', attestation.id);

      if (error) throw error;

      setAttestations(prev => prev.filter(a => a.id !== attestation.id));
      toast.success('Document supprimé');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDownload = async (attestation: Attestation) => {
    try {
      const { data, error } = await supabase.storage
        .from('agency-attestations')
        .download(attestation.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attestation.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const getStatusBadge = (expiresAt: string) => {
    const expDate = new Date(expiresAt);
    if (isPast(expDate)) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expiré
        </Badge>
      );
    }
    if (isBefore(expDate, addWeeks(new Date(), 3))) {
      return (
        <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600 bg-orange-50">
          <Clock className="h-3 w-3" />
          Expire bientôt
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-green-300 text-green-600 bg-green-50">
        <CheckCircle className="h-3 w-3" />
        Valide
      </Badge>
    );
  };

  const getLatestForType = (typeKey: string) => {
    return attestations.find(a => a.attestation_type === typeKey);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ATTESTATION_TYPES.map((type) => {
        const latest = getLatestForType(type.key);

        return (
          <Card key={type.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{type.label}</CardTitle>
                <span className="text-xs text-muted-foreground">
                  Validité : {type.validityMonths} mois
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {latest ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{latest.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploadé le {format(new Date(latest.uploaded_at), 'dd MMM yyyy', { locale: fr })}
                        {' · '}
                        Expire le {format(new Date(latest.expires_at), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(latest.expires_at)}
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(latest)} title="Télécharger">
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(latest)}
                          title="Supprimer"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpload(type)}
                          disabled={uploading === type.key}
                        >
                          {uploading === type.key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1" />
                          )}
                          Remplacer
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground italic">Aucun document uploadé</p>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpload(type)}
                      disabled={uploading === type.key}
                    >
                      {uploading === type.key ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      Uploader
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
