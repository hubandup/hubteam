import { useState, useEffect, useRef } from 'react';
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
import { Progress } from '@/components/ui/progress';

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
  parent_id?: number | null;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

export function ProjectKDriveTab({ projectId }: ProjectKDriveTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<KDriveFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  const [driveId, setDriveId] = useState<number | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);

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

      // Always use client folder
      setCurrentFolder({
        id: client.kdrive_folder_id,
        name: client.company,
        path: client.kdrive_folder_path || ''
      });
      await loadFiles(client.kdrive_drive_id, client.kdrive_folder_id);
    } catch (error: any) {
      console.error('Error loading project folder:', error);
      toast.error('Erreur lors du chargement du dossier');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (driveId: number, folderId: string) => {
    try {
      // Simple single request - no pagination loop needed for direct folder listing
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'list-files',
          driveId,
          folderId,
          limit: 500,
          offset: 0,
        }
      });

      if (error) throw error;

      const arr = Array.isArray(data?.data) ? data.data : [];
      setFiles(arr);
    } catch (error: any) {
      console.error('Error loading files:', error);
      toast.error('Erreur lors du chargement des fichiers');
    }
  };

  const handleFileUploadFromFiles = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0 || !currentFolder || !driveId) return;

    const filesArray = Array.from(fileList);
    const initialQueue: UploadProgress[] = filesArray.map(f => ({
      fileName: f.name,
      progress: 0,
      status: 'pending' as const
    }));
    
    setUploadQueue(initialQueue);
    setUploading(true);

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      
      setUploadQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'uploading', progress: 10 } : item
      ));

      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 50);
              setUploadQueue(prev => prev.map((item, idx) => 
                idx === i ? { ...item, progress: percent } : item
              ));
            }
          };
          reader.readAsDataURL(file);
        });

        setUploadQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, progress: 60 } : item
        ));

        const { error } = await supabase.functions.invoke('kdrive-api', {
          body: {
            action: 'upload-file',
            driveId,
            folderId: currentFolder.id,
            fileName: file.name,
            fileContent: base64Data
          }
        });

        if (error) throw error;

        setUploadQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'done', progress: 100 } : item
        ));
      } catch (error: any) {
        console.error('Error uploading file:', error);
        setUploadQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'error', progress: 0 } : item
        ));
      }
    }

    const successCount = uploadQueue.filter(u => u.status === 'done').length || filesArray.length;
    toast.success(`${successCount} fichier(s) uploadé(s) avec succès !`);
    await loadFiles(driveId, currentFolder.id);
    
    setTimeout(() => {
      setUploadQueue([]);
      setUploading(false);
    }, 1500);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleFileUploadFromFiles(event.target.files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUploadFromFiles(e.dataTransfer.files);
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
    <div 
      className="space-y-4 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-12 w-12" />
            <p className="text-lg font-medium">Déposez vos fichiers ici</p>
          </div>
        </div>
      )}

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
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </Button>
        </div>
      </div>

      {/* Upload progress */}
      {uploadQueue.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Upload en cours...</p>
            {uploadQueue.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[200px]">{item.fileName}</span>
                  <span className={
                    item.status === 'done' ? 'text-success' : 
                    item.status === 'error' ? 'text-destructive' : 
                    'text-muted-foreground'
                  }>
                    {item.status === 'done' ? '✓' : 
                     item.status === 'error' ? '✗' : 
                     `${item.progress}%`}
                  </span>
                </div>
                <Progress value={item.progress} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
