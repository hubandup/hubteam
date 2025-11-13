import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Download, Trash2, Upload, FileText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
  uploaded_by: string | null;
}

interface ProjectAttachmentsTabProps {
  projectId: string;
}

export function ProjectAttachmentsTab({ projectId }: ProjectAttachmentsTabProps) {
  const isMobile = useIsMobile();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAttachments();
  }, [projectId]);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('project_attachments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      toast.error('Erreur lors du chargement des pièces jointes');
    } finally {
      setLoading(false);
    }
  };

  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} dépasse la limite de 10MB`);
          continue;
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`Type de fichier non autorisé: ${file.name}`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}-${file.name}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('project-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Create record in database
        const { error: dbError } = await supabase
          .from('project_attachments')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;
      }

      toast.success('Fichier(s) uploadé(s) avec succès');
      fetchAttachments();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors de l\'upload du fichier');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const downloadFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      toast.success('Pièce jointe supprimée');
      fetchAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Pièces jointes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{attachment.file_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(attachment.file_size)} • {' '}
                      {formatDistanceToNow(new Date(attachment.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFile(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAttachment(attachment)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Aucune pièce jointe
          </p>
        )}
        
        <div className={isMobile ? 'border-t pt-4' : ''}>
          <Input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            multiple
            disabled={uploading}
          />
          <Button
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploading}
            size="sm"
            className={isMobile ? 'w-full' : ''}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Ajouter des fichiers
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
