import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Upload, Download, FolderIcon, FileIcon, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { KDriveFolderSelector } from './KDriveFolderSelector';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClientKDriveTabProps {
  clientId: string;
}

interface KDriveFile {
  id: number;
  name: string;
  type: 'dir' | 'file';
  size?: number;
  created_at?: string;
  path: string;
}

export function ClientKDriveTab({ clientId }: ClientKDriveTabProps) {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<KDriveFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: number; path: string } | null>(null);
  const [client, setClient] = useState<any>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => {
    loadClientFolder();
  }, [clientId]);

  const loadClientFolder = async () => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      if (clientData.kdrive_folder_id && clientData.kdrive_drive_id) {
        setCurrentFolder({
          id: parseInt(clientData.kdrive_folder_id),
          path: clientData.kdrive_folder_path || '/'
        });
        await loadFiles(clientData.kdrive_drive_id, clientData.kdrive_folder_id);
      }
    } catch (error) {
      console.error('Error loading client folder:', error);
      toast.error('Erreur lors du chargement du dossier');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (driveId: number, folderId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'list-files',
          driveId,
          folderId,
        },
      });

      if (error) throw error;
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Erreur lors du chargement des fichiers');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !client || !currentFolder) return;

    const file = event.target.files[0];
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result?.toString().split(',')[1];
        
        const { error } = await supabase.functions.invoke('kdrive-api', {
          body: {
            action: 'upload-file',
            driveId: client.kdrive_drive_id,
            folderId: currentFolder.id.toString(),
            fileName: file.name,
            fileContent: base64,
          },
        });

        if (error) throw error;
        
        toast.success('Fichier téléversé avec succès');
        await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors du téléversement du fichier');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    if (!client) return;

    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'download-file',
          driveId: client.kdrive_drive_id,
          fileId: fileId.toString(),
        },
      });

      if (error) throw error;

      const blob = new Blob([Uint8Array.from(atob(data.content), c => c.charCodeAt(0))]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Fichier téléchargé');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleFolderClick = async (folderId: number, folderPath: string) => {
    if (!client) return;
    setCurrentFolder({ id: folderId, path: folderPath });
    await loadFiles(client.kdrive_drive_id, folderId.toString());
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !client || !currentFolder) return;

    setIsCreatingFolder(true);
    try {
      const { error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'create-folder',
          driveId: client.kdrive_drive_id,
          parentFolderId: currentFolder.id.toString(),
          folderName: newFolderName,
        },
      });

      if (error) throw error;

      toast.success('Dossier créé avec succès');
      setIsCreateFolderOpen(false);
      setNewFolderName('');
      await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client?.kdrive_folder_id) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-muted-foreground text-center">
          {isAdmin 
            ? "Ce client n'est pas encore connecté à un dossier kDrive"
            : "Contactez votre administrateur pour associer le dossier kDrive à ce client"}
        </p>
        {isAdmin && (
          <KDriveFolderSelector
            clientId={clientId}
            clientName={client?.company || 'Client'}
            onFolderConnected={loadClientFolder}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderIcon className="h-4 w-4" />
          <span>{currentFolder?.path || '/'}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateFolderOpen(true)}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Nouveau dossier
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Téléverser
          </Button>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <div className="grid gap-2">
        {files.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Aucun fichier ou dossier
          </p>
        ) : (
          files.map((file) => (
            <Card key={file.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {file.type === 'dir' ? (
                    <FolderIcon className="h-5 w-5 text-primary" />
                  ) : (
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {file.type === 'dir' ? 'Dossier' : formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {file.type === 'dir' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFolderClick(file.id, file.path)}
                    >
                      Ouvrir
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file.id, file.name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau dossier</DialogTitle>
            <DialogDescription>
              Créer un nouveau dossier dans {currentFolder?.path || '/'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nom du dossier</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nouveau dossier"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateFolderOpen(false);
                setNewFolderName('');
              }}
            >
              Annuler
            </Button>
            <Button onClick={createFolder} disabled={isCreatingFolder || !newFolderName.trim()}>
              {isCreatingFolder ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
