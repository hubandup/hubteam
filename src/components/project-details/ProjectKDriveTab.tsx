import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Download, Folder, File, Plus, Loader2, Trash2, FolderPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface ProjectKDriveTabProps {
  projectId: string;
}

interface KDriveFile {
  id: number;
  name: string;
  type: 'file' | 'dir';
  size?: number;
  created_at: number;
  path: string;
}

export function ProjectKDriveTab({ projectId }: ProjectKDriveTabProps) {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<KDriveFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  const [driveId, setDriveId] = useState<number | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    loadProjectFolder();
  }, [projectId]);

  const loadProjectFolder = async () => {
    setLoading(true);
    try {
      // Get project with client info
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          project_clients(
            client_id,
            clients(kdrive_drive_id, kdrive_folder_id, kdrive_folder_path, company)
          )
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      const client = project.project_clients?.[0]?.clients;
      
      if (!client?.kdrive_drive_id || !client?.kdrive_folder_id) {
        toast.error('Le client n\'a pas de dossier KDrive connecté');
        setLoading(false);
        return;
      }

      setDriveId(client.kdrive_drive_id);

      // Check if project has its own folder
      if (project.kdrive_folder_id) {
        setCurrentFolder({
          id: project.kdrive_folder_id,
          name: project.name,
          path: project.kdrive_folder_path || ''
        });
        await loadFiles(client.kdrive_drive_id, project.kdrive_folder_id);
      } else {
        // Use client folder
        setCurrentFolder({
          id: client.kdrive_folder_id,
          name: client.company,
          path: client.kdrive_folder_path || ''
        });
        await loadFiles(client.kdrive_drive_id, client.kdrive_folder_id);
      }
    } catch (error: any) {
      console.error('Error loading project folder:', error);
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
          folderId
        }
      });

      if (error) throw error;

      setFiles(data.data || []);
    } catch (error: any) {
      console.error('Error loading files:', error);
      toast.error('Erreur lors du chargement des fichiers');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !currentFolder || !driveId) return;

    const file = event.target.files[0];
    setUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target?.result as string;
        const base64Data = base64Content.split(',')[1];

        const { data, error } = await supabase.functions.invoke('kdrive-api', {
          body: {
            action: 'upload-file',
            driveId,
            folderId: currentFolder.id,
            fileName: file.name,
            fileContent: base64Data
          }
        });

        if (error) throw error;

        toast.success('Fichier uploadé avec succès !');
        await loadFiles(driveId, currentFolder.id);
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors de l\'upload du fichier');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: KDriveFile) => {
    if (!driveId) return;

    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'download-file',
          driveId,
          folderId: file.id.toString()
        }
      });

      if (error) throw error;

      // Create blob and download
      const binaryData = atob(data.content);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Fichier téléchargé !');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleFolderClick = async (folder: KDriveFile) => {
    if (!driveId) return;
    setCurrentFolder({
      id: folder.id.toString(),
      name: folder.name,
      path: folder.path
    });
    await loadFiles(driveId, folder.id.toString());
  };

  const createFolder = async () => {
    if (!newFolderName || !currentFolder || !driveId) return;

    setCreatingFolder(true);
    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'create-folder',
          driveId,
          parentId: currentFolder.id,
          folderPath: newFolderName
        }
      });

      if (error) throw error;

      toast.success('Dossier créé !');
      setCreateFolderOpen(false);
      setNewFolderName('');
      await loadFiles(driveId, currentFolder.id);
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    } finally {
      setCreatingFolder(false);
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentFolder) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Aucun dossier KDrive connecté</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Documents KDrive</h3>
          <p className="text-sm text-muted-foreground">{currentFolder.path}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateFolderOpen(true)} variant="outline">
            <FolderPlus className="h-4 w-4 mr-2" />
            Nouveau dossier
          </Button>
          <Button asChild disabled={uploading}>
            <label>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Uploader
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {files.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Aucun fichier dans ce dossier</p>
            </CardContent>
          </Card>
        ) : (
          files.map((file) => (
            <Card key={file.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1">
                  {file.type === 'dir' ? (
                    <Folder className="h-5 w-5 text-primary" />
                  ) : (
                    <File className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    {file.type === 'dir' ? (
                      <button
                        onClick={() => handleFolderClick(file)}
                        className="text-sm font-medium hover:underline text-left"
                      >
                        {file.name}
                      </button>
                    ) : (
                      <p className="text-sm font-medium">{file.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {formatDistanceToNow(file.created_at * 1000, { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
                {file.type === 'file' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un dossier</DialogTitle>
            <DialogDescription>
              Créer un nouveau dossier dans {currentFolder.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du dossier</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nom du dossier"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Annuler
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName || creatingFolder}>
              {creatingFolder ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
