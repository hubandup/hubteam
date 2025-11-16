import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Folder, File, Download, Upload, FolderPlus, FileText, Image, Video, Music, Archive } from 'lucide-react';
import { AgencyKDriveFolderSelector } from './AgencyKDriveFolderSelector';

interface KDriveFile {
  id: string;
  name: string;
  type: 'dir' | 'file';
  size?: number;
  created_at: number;
  path: string;
}

interface AgencyKDriveTabProps {
  agencyId: string;
  agencyName: string;
}

export function AgencyKDriveTab({ agencyId, agencyName }: AgencyKDriveTabProps) {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<KDriveFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [driveId, setDriveId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadAgencyFolder();
  }, [agencyId]);

  const loadAgencyFolder = async () => {
    try {
      const { data: agency, error } = await supabase
        .from('agencies')
        .select('kdrive_drive_id, kdrive_folder_id, kdrive_folder_path')
        .eq('id', agencyId)
        .maybeSingle();

      if (error) throw error;

      if (agency?.kdrive_drive_id && agency?.kdrive_folder_id) {
        setDriveId(agency.kdrive_drive_id);
        setCurrentFolder(agency.kdrive_folder_id);
        setFolderPath(agency.kdrive_folder_path);
        await loadFiles(agency.kdrive_drive_id, agency.kdrive_folder_id);
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
          action: 'list',
          driveId: drive,
          parentId: folderId
        }
      });

      if (error) throw error;
      setFiles(data?.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Erreur lors du chargement des fichiers');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !driveId || !currentFolder) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'upload',
          driveId: driveId,
          parentId: currentFolder,
          fileName: file.name,
          file: await file.arrayBuffer()
        }
      });

      if (error) throw error;

      toast.success('Fichier uploadé avec succès');
      await loadFiles(driveId, currentFolder);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors de l\'upload du fichier');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    if (!driveId) return;

    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'download',
          driveId: driveId,
          fileId: fileId
        }
      });

      if (error) throw error;

      // Create download link
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

  const handleFolderClick = async (folderId: string) => {
    if (!driveId) return;
    setCurrentFolder(folderId);
    await loadFiles(driveId, folderId);
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !driveId || !currentFolder) return;

    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: {
          action: 'createFolder',
          driveId: driveId,
          parentId: currentFolder,
          folderName: newFolderName
        }
      });

      if (error) throw error;

      toast.success('Dossier créé avec succès');
      setNewFolderName('');
      setShowCreateFolder(false);
      await loadFiles(driveId, currentFolder);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    }
  };

  const getFileIcon = (file: KDriveFile) => {
    if (file.type === 'dir') {
      return <Folder className="h-5 w-5 text-primary" />;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '')) {
      return <Image className="h-5 w-5 text-blue-500" />;
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
    return <FileText className="h-5 w-5 text-muted-foreground" />;
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
            <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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
            currentFolderId={currentFolder}
            currentFolderPath={folderPath}
            onFolderConnected={loadAgencyFolder}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Documents KDrive</CardTitle>
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
          
          <Button size="sm" disabled={uploading} asChild>
            <label className="cursor-pointer">
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Ce dossier est vide</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors group"
              >
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
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.type === 'dir' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleFolderClick(file.id)}
                    >
                      Ouvrir
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(file.id, file.name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
