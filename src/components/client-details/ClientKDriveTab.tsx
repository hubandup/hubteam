import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Upload, Download, FolderIcon, FileIcon, FolderPlus, Trash2, ArrowUp, Home } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [currentFolder, setCurrentFolder] = useState<{ id: number; path: string; parentId: number | null } | null>(null);
  const [client, setClient] = useState<any>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: number; name: string; type: 'dir' | 'file' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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
          path: clientData.kdrive_folder_path || '/',
          parentId: null
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

  const loadFiles = async (driveId: number | undefined, folderId: string, append = false, customOffset?: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'list-files',
          driveId,
          folderId,
          limit,
          offset: typeof customOffset === 'number' ? customOffset : offset,
        },
      });

      if (error) throw error;
      
      // Extract array and pagination
      const arr = Array.isArray(data?.data) ? data.data : [];
      setHasMore(Boolean((data as any)?.has_more));
      const newOffset = (typeof customOffset === 'number' ? customOffset : offset) + arr.length;
      setOffset(newOffset);

      // Get parent_id from first entry if available
      const parentId = arr?.[0]?.parent_id ?? null;
      if (currentFolder) {
        setCurrentFolder(prev => prev ? { ...prev, parentId } : null);
      }
      
      setFiles(prev => append ? [...prev, ...arr] : arr);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Erreur lors du chargement des fichiers');
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0 || !client || !currentFolder) return;

    const file = files[0];
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

      const base64 = (data as any)?.data as string;
      if (!base64) throw new Error('Contenu manquant');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes]);
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

  const handleFolderClick = async (folderId: number, folderPath: string, parentId: number | null = null) => {
    if (!client) return;
    setCurrentFolder({ id: folderId, path: folderPath, parentId });
    setFiles([]);
    setOffset(0);
    setHasMore(false);
    await loadFiles(client.kdrive_drive_id, folderId.toString(), false, 0);
  };

  const handleGoToRoot = async () => {
    if (!client) return;
    setCurrentFolder({
      id: parseInt(client.kdrive_folder_id),
      path: client.kdrive_folder_path || '/',
      parentId: null
    });
    setFiles([]);
    setOffset(0);
    setHasMore(false);
    await loadFiles(client.kdrive_drive_id, client.kdrive_folder_id, false, 0);
  };

  const handleGoToParent = async () => {
    if (!client || !currentFolder?.parentId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'get-file-details',
          driveId: client.kdrive_drive_id,
          fileId: currentFolder.parentId.toString(),
        },
      });

      if (error) throw error;
      
      const parentPath = (data as any)?.file?.path || '/';
      const grandParentId = (data as any)?.file?.parent_id || null;
      
      setCurrentFolder({ 
        id: currentFolder.parentId, 
        path: parentPath,
        parentId: grandParentId
      });
      setFiles([]);
      setOffset(0);
      setHasMore(false);
      await loadFiles(client.kdrive_drive_id, currentFolder.parentId.toString(), false, 0);
    } catch (error) {
      console.error('Error navigating to parent:', error);
      toast.error('Erreur lors de la navigation');
    }
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

  const handleDelete = async () => {
    if (!deleteItem || !client || !currentFolder) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: deleteItem.type === 'dir' ? 'delete-folder' : 'delete-file',
          driveId: client.kdrive_drive_id,
          fileId: deleteItem.id.toString(),
        },
      });

      if (error) throw error;

      toast.success(`${deleteItem.type === 'dir' ? 'Dossier' : 'Fichier'} supprimé avec succès`);
      setDeleteItem(null);
      await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
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

  return (
    <div className="space-y-4">
      {!client?.kdrive_folder_id && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Dossier non connecté pour ce client. Navigation autorisée.</span>
          {isAdmin && (
            <KDriveFolderSelector
              clientId={clientId}
              clientName={client?.company || 'Client'}
              onFolderConnected={loadClientFolder}
            />
          )}
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoToRoot}
              title="Retour à la racine"
            >
              <Home className="h-4 w-4" />
            </Button>
            {currentFolder?.parentId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoToParent}
                title="Dossier parent"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
            <FolderIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{currentFolder?.path || '/'}</span>
          </div>
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
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Téléverser
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
        </div>
      </div>

      <div 
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed transition-colors ${
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border bg-muted/20'
        } p-8 text-center`}
      >
        {isDragging ? (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-primary">Déposez le fichier ici</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Glissez-déposez un fichier ici ou cliquez sur Téléverser
            </p>
          </div>
        )}
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
                      onClick={() => handleFolderClick(
                        file.id,
                        (file as any).path || `${currentFolder?.path || ''}/${file.name}`,
                        currentFolder?.id || null
                      )}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteItem({ id: file.id, name: file.name, type: file.type })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => client && loadFiles(client.kdrive_drive_id, (currentFolder?.id || 0).toString(), true)}>
            Charger plus
          </Button>
        </div>
      )}

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

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {deleteItem?.type === 'dir' ? 'le dossier' : 'le fichier'}{' '}
              <strong>{deleteItem?.name}</strong> ?
              {deleteItem?.type === 'dir' && ' Tout son contenu sera également supprimé.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
