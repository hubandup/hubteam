import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Folder, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KDriveFolderSelectorProps {
  clientId: string;
  clientName: string;
  onFolderConnected: () => void;
}

interface KDriveFolder {
  id: number;
  name: string;
  path: string;
}

export function KDriveFolderSelector({ clientId, clientName, onFolderConnected }: KDriveFolderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drives, setDrives] = useState<any[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<number | null>(null);
  const [folders, setFolders] = useState<KDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<KDriveFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const loadDrives = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: { action: 'list-drives' }
      });

      if (error) throw error;

      setDrives(data.data || []);
      if (data.data && data.data.length > 0) {
        setSelectedDrive(data.data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading drives:', error);
      toast.error('Erreur lors du chargement des drives');
    } finally {
      setLoading(false);
    }
  };

  const searchClientFolder = async (driveId: number) => {
    setLoading(true);
    try {
      // Search for CLIENTS folder
      const { data: clientsData, error: clientsError } = await supabase.functions.invoke('kdrive-api', {
        body: { 
          action: 'search-folder',
          driveId,
          folderPath: 'CLIENTS'
        }
      });

      if (clientsError) throw clientsError;

      // Search for client company folder
      const { data: companyData, error: companyError } = await supabase.functions.invoke('kdrive-api', {
        body: { 
          action: 'search-folder',
          driveId,
          folderPath: clientName
        }
      });

      if (companyError) throw companyError;

      const foundFolders: KDriveFolder[] = [];
      
      if (clientsData?.data) {
        foundFolders.push(...clientsData.data.map((f: any) => ({
          id: f.id,
          name: f.name,
          path: f.path
        })));
      }

      if (companyData?.data) {
        foundFolders.push(...companyData.data.map((f: any) => ({
          id: f.id,
          name: f.name,
          path: f.path
        })));
      }

      setFolders(foundFolders);
    } catch (error: any) {
      console.error('Error searching folders:', error);
      toast.error('Erreur lors de la recherche des dossiers');
    } finally {
      setLoading(false);
    }
  };

  const createClientFolder = async () => {
    if (!selectedDrive || !newFolderName) return;

    setCreatingFolder(true);
    try {
      // First, find or create CLIENTS folder
      const { data: clientsSearch } = await supabase.functions.invoke('kdrive-api', {
        body: { 
          action: 'search-folder',
          driveId: selectedDrive,
          folderPath: 'CLIENTS'
        }
      });

      let clientsFolderId;
      
      if (clientsSearch?.data && clientsSearch.data.length > 0) {
        clientsFolderId = clientsSearch.data[0].id;
      } else {
        // Get root folder info
        const { data: driveInfo } = await supabase.functions.invoke('kdrive-api', {
          body: { 
            action: 'list-files',
            driveId: selectedDrive,
            folderId: 1
          }
        });

        // Create CLIENTS folder
        const { data: clientsFolder, error: createError } = await supabase.functions.invoke('kdrive-api', {
          body: { 
            action: 'create-folder',
            driveId: selectedDrive,
            parentId: 1, // Root
            folderPath: 'CLIENTS'
          }
        });

        if (createError) throw createError;
        clientsFolderId = clientsFolder.data.id;
      }

      // Create company folder inside CLIENTS
      const { data: companyFolder, error: companyError } = await supabase.functions.invoke('kdrive-api', {
        body: { 
          action: 'create-folder',
          driveId: selectedDrive,
          parentId: clientsFolderId,
          folderPath: newFolderName
        }
      });

      if (companyError) throw companyError;

      // Update client in database
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          kdrive_drive_id: selectedDrive,
          kdrive_folder_id: companyFolder.data.id.toString(),
          kdrive_folder_path: `/CLIENTS/${newFolderName}`
        })
        .eq('id', clientId);

      if (updateError) throw updateError;

      toast.success('Dossier client créé et connecté !');
      setOpen(false);
      onFolderConnected();
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    } finally {
      setCreatingFolder(false);
    }
  };

  const connectExistingFolder = async () => {
    if (!selectedFolder || !selectedDrive) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          kdrive_drive_id: selectedDrive,
          kdrive_folder_id: selectedFolder.id.toString(),
          kdrive_folder_path: selectedFolder.path
        })
        .eq('id', clientId);

      if (error) throw error;

      toast.success('Dossier KDrive connecté !');
      setOpen(false);
      onFolderConnected();
    } catch (error: any) {
      console.error('Error connecting folder:', error);
      toast.error('Erreur lors de la connexion du dossier');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDrives();
    }
  }, [open]);

  useEffect(() => {
    if (selectedDrive) {
      searchClientFolder(selectedDrive);
    }
  }, [selectedDrive]);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <ExternalLink className="h-4 w-4 mr-2" />
        Connecter KDrive
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connecter un dossier KDrive</DialogTitle>
            <DialogDescription>
              Sélectionnez un dossier existant ou créez-en un nouveau pour {clientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Dossiers existants</Label>
                  <ScrollArea className="h-[200px] border rounded-md p-4 mt-2">
                    {folders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun dossier trouvé</p>
                    ) : (
                      <div className="space-y-2">
                        {folders.map((folder) => (
                          <div
                            key={folder.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                              selectedFolder?.id === folder.id ? 'bg-accent' : ''
                            }`}
                            onClick={() => setSelectedFolder(folder)}
                          >
                            <Folder className="h-4 w-4" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{folder.name}</p>
                              <p className="text-xs text-muted-foreground">{folder.path}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  {selectedFolder && (
                    <Button onClick={connectExistingFolder} className="mt-2">
                      Connecter ce dossier
                    </Button>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Label>Créer un nouveau dossier</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Nom du dossier (ex: BRISACH)"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                    />
                    <Button 
                      onClick={createClientFolder} 
                      disabled={!newFolderName || creatingFolder}
                    >
                      {creatingFolder ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Créer
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Le dossier sera créé dans : CLIENTS/{newFolderName}
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
