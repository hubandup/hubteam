import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Loader2, 
  FolderIcon, 
  FileIcon, 
  Upload, 
  FolderPlus, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive,
  Home,
  ChevronRight,
  Trash2,
  MoreVertical,
  Edit,
  Unlink,
  Eye
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AgencyKDriveFolderSelector } from './AgencyKDriveFolderSelector';
import { RenameFileDialog } from '../client-details/RenameFileDialog';
import { FilePreviewPane } from '../client-details/FilePreviewPane';
import { useUserRole } from '@/hooks/useUserRole';

interface KDriveFile {
  id: number;
  name: string;
  type: 'dir' | 'file';
  size?: number;
  created_at?: string;
  path: string;
}

interface AgencyKDriveTabProps {
  agencyId: string;
  agencyName: string;
}

export function AgencyKDriveTab({ agencyId, agencyName }: AgencyKDriveTabProps) {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<KDriveFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: number; path: string; parentId: number | null } | null>(null);
  const [driveId, setDriveId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [agency, setAgency] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: number; name: string; type: 'dir' | 'file' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: number; name: string; path: string }>>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDropZone, setShowDropZone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [rootFolderName, setRootFolderName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: 'dir' | 'file' } | null>(null);
  const [previewFile, setPreviewFile] = useState<KDriveFile | null>(null);

  useEffect(() => {
    loadAgencyFolder();
  }, [agencyId]);

  useEffect(() => {
    setSelectedIds([]);
  }, [currentFolder?.id]);

  const loadAgencyFolder = async () => {
    try {
      const { data: agencyData, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', agencyId)
        .single();

      if (error) throw error;

      setAgency(agencyData);

      if (agencyData?.kdrive_drive_id && agencyData?.kdrive_folder_id) {
        setDriveId(agencyData.kdrive_drive_id);
        const folderId = parseInt(agencyData.kdrive_folder_id);
        setCurrentFolder({
          id: folderId,
          path: agencyData.kdrive_folder_path || agencyData.name,
          parentId: null
        });
        setFolderPath(agencyData.kdrive_folder_path);
        setRootFolderName(agencyData.kdrive_folder_path || agencyData.name);
        
        setBreadcrumbs([{
          id: folderId,
          name: agencyData.kdrive_folder_path || agencyData.name,
          path: agencyData.kdrive_folder_path || agencyData.name
        }]);

        await loadFiles(agencyData.kdrive_drive_id, folderId.toString());
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading agency folder:', error);
      toast.error('Erreur lors du chargement du dossier');
      setLoading(false);
    }
  };

  const loadFiles = async (drive: number, folderId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'list-files',
          driveId: drive,
          folderId: folderId
        }
      });

      if (error) throw error;
      
      let filesData = data?.data || [];
      
      // Sort files
      filesData.sort((a: KDriveFile, b: KDriveFile) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      });
      
      setFiles(filesData);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Erreur lors du chargement des fichiers');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length || !driveId || !currentFolder) return;

    try {
      setUploading(true);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { data, error } = await supabase.functions.invoke('kdrive-api', {
          body: {
            action: 'upload-file',
            driveId: driveId,
            parentId: currentFolder.id.toString(),
            fileName: file.name,
            fileContent: await file.arrayBuffer(),
            fileSize: file.size
          }
        });

        if (error) throw error;
      }

      toast.success(`${files.length} fichier(s) uploadé(s) avec succès`);
      await loadFiles(driveId, currentFolder.id.toString());
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors de l\'upload du fichier');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setShowDropZone(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setShowDropZone(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setShowDropZone(false);
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    if (!driveId) return;

    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'download-file',
          driveId: driveId,
          fileId: fileId.toString()
        }
      });

      if (error) throw error;

      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Téléchargement démarré');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleFolderClick = async (file: KDriveFile) => {
    if (!driveId || !currentFolder) return;
    
    const newFolder = {
      id: file.id,
      path: file.path,
      parentId: currentFolder.id
    };
    
    setCurrentFolder(newFolder);
    setBreadcrumbs([...breadcrumbs, { id: file.id, name: file.name, path: file.path }]);
    await loadFiles(driveId, file.id.toString());
  };

  const handleBreadcrumbClick = async (index: number) => {
    if (!driveId) return;
    
    const crumb = breadcrumbs[index];
    setCurrentFolder({
      id: crumb.id,
      path: crumb.path,
      parentId: index > 0 ? breadcrumbs[index - 1].id : null
    });
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    await loadFiles(driveId, crumb.id.toString());
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !driveId || !currentFolder) return;

    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'create-folder',
          driveId: driveId,
          parentId: currentFolder.id.toString(),
          fileName: newFolderName
        }
      });

      if (error) throw error;

      toast.success('Dossier créé avec succès');
      setNewFolderName('');
      setShowCreateFolder(false);
      await loadFiles(driveId, currentFolder.id.toString());
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !driveId || !currentFolder) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'delete-files',
          driveId: driveId,
          fileIds: [deleteItem.id.toString()]
        }
      });

      if (error) throw error;

      toast.success(`${deleteItem.type === 'dir' ? 'Dossier' : 'Fichier'} supprimé avec succès`);
      await loadFiles(driveId, currentFolder.id.toString());
      setDeleteItem(null);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteMultiple = async () => {
    if (!driveId || !currentFolder || selectedIds.length === 0) return;

    try {
      setIsDeletingMultiple(true);
      const { error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'delete-files',
          driveId: driveId,
          fileIds: selectedIds.map(id => id.toString())
        }
      });

      if (error) throw error;

      toast.success(`${selectedIds.length} élément(s) supprimé(s) avec succès`);
      setSelectedIds([]);
      await loadFiles(driveId, currentFolder.id.toString());
      setShowDeleteMultipleConfirm(false);
    } catch (error) {
      console.error('Error deleting multiple:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameItem || !driveId || !currentFolder) return;

    try {
      const { error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'rename-file',
          driveId: driveId,
          fileId: renameItem.id.toString(),
          newName: newName
        }
      });

      if (error) throw error;

      toast.success('Renommé avec succès');
      await loadFiles(driveId, currentFolder.id.toString());
      setRenameItem(null);
    } catch (error) {
      console.error('Error renaming:', error);
      toast.error('Erreur lors du renommage');
    }
  };

  const handleRevoke = async () => {
    try {
      setIsRevoking(true);
      
      const { error } = await supabase
        .from('agencies')
        .update({
          kdrive_drive_id: null,
          kdrive_folder_id: null,
          kdrive_folder_path: null
        })
        .eq('id', agencyId);

      if (error) throw error;

      toast.success('Connexion KDrive révoquée');
      setIsRevokeOpen(false);
      await loadAgencyFolder();
    } catch (error) {
      console.error('Error revoking KDrive:', error);
      toast.error('Erreur lors de la révocation');
    } finally {
      setIsRevoking(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map(f => f.id));
    }
  };

  const getFileIcon = (file: KDriveFile) => {
    if (file.type === 'dir') {
      return <FolderIcon className="h-5 w-5 text-primary" />;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    if (['mp4', 'avi', 'mov', 'mkv'].includes(extension || '')) {
      return <Video className="h-5 w-5 text-purple-500" />;
    }
    if (['mp3', 'wav', 'flac', 'aac'].includes(extension || '')) {
      return <Music className="h-5 w-5 text-green-500" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '')) {
      return <Archive className="h-5 w-5 text-orange-500" />;
    }
    if (['pdf'].includes(extension || '')) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <FileIcon className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
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

  if (!driveId || !currentFolder) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <FolderIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">
              Aucun dossier KDrive n'est configuré pour cette agence.
            </p>
            <p className="text-sm text-muted-foreground">
              Connectez un dossier depuis Hub & Up {'>'} Agences
            </p>
          </div>
          <AgencyKDriveFolderSelector
            agencyId={agencyId}
            agencyName={agencyName}
            currentDriveId={driveId}
            currentFolderId={currentFolder?.id.toString() || null}
            currentFolderPath={folderPath}
            onFolderConnected={loadAgencyFolder}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div 
      className="space-y-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {showDropZone && (
        <div className="fixed inset-0 bg-primary/10 border-4 border-dashed border-primary z-50 flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-16 w-16 mx-auto mb-4 text-primary" />
            <p className="text-xl font-semibold">Déposez vos fichiers ici</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto">
              <Home className="h-4 w-4 flex-shrink-0" />
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className="hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>
            
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRevokeOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Unlink className="h-4 w-4 mr-2" />
                Révoquer
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2">
              {files.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.length === files.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label className="text-sm text-muted-foreground cursor-pointer" onClick={toggleSelectAll}>
                    {selectedIds.length > 0 ? `${selectedIds.length} sélectionné(s)` : 'Tout sélectionner'}
                  </Label>
                </div>
              )}
              
              {selectedIds.length > 0 && isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteMultipleConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer ({selectedIds.length})
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nouveau dossier
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un nouveau dossier</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Nom du dossier"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                        Annuler
                      </Button>
                      <Button onClick={createFolder} disabled={!newFolderName.trim()}>
                        Créer
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Uploader
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                disabled={uploading}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Ce dossier est vide</p>
              <p className="text-sm mt-2">Uploadez des fichiers ou créez un nouveau dossier</p>
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors group"
                >
                  <Checkbox
                    checked={selectedIds.includes(file.id)}
                    onCheckedChange={() => toggleSelection(file.id)}
                  />
                  
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      {file.type === 'file' && file.size && (
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.type === 'dir' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFolderClick(file)}
                      >
                        Ouvrir
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewFile(file)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(file.id, file.name)}
                        >
                          <Upload className="h-4 w-4 rotate-180" />
                        </Button>
                      </>
                    )}
                    
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setRenameItem(file)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteItem(file)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{deleteItem?.name}" ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
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

      {/* Delete multiple confirmation */}
      <AlertDialog open={showDeleteMultipleConfirm} onOpenChange={setShowDeleteMultipleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression multiple</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedIds.length} élément(s) ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMultiple} disabled={isDeletingMultiple}>
              {isDeletingMultiple ? (
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

      {/* Revoke confirmation */}
      <AlertDialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer la connexion KDrive</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir déconnecter ce dossier KDrive ? Vous devrez le reconnecter pour y accéder à nouveau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} disabled={isRevoking}>
              {isRevoking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Révocation...
                </>
              ) : (
                'Révoquer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      {renameItem && (
        <RenameFileDialog
          currentName={renameItem.name}
          open={!!renameItem}
          onOpenChange={(open) => !open && setRenameItem(null)}
          onRename={handleRename}
        />
      )}

      {/* Preview pane */}
      {previewFile && driveId && (
        <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{previewFile.name}</DialogTitle>
              <DialogDescription>
                {previewFile.size && formatFileSize(previewFile.size)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center items-center min-h-[400px]">
              <div className="text-center">
                <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Prévisualisation non disponible</p>
                <Button 
                  className="mt-4"
                  onClick={() => handleDownload(previewFile.id, previewFile.name)}
                >
                  <Upload className="h-4 w-4 mr-2 rotate-180" />
                  Télécharger
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
