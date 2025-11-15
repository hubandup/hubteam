import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Folder, Plus, ExternalLink, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [newFolderName, setNewFolderName] = useState(clientName);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'ok' | 'error' | null>(null);
  const [permissionMessage, setPermissionMessage] = useState('');

  const checkPermissions = async () => {
    setPermissionStatus('checking');
    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: { action: 'check-permissions' }
      });

      if (error) throw error;

      if (data.hasRequiredScopes) {
        setPermissionStatus('ok');
        setPermissionMessage('Token valide avec les permissions nécessaires');
      } else {
        setPermissionStatus('error');
        let errorMsg = data.message || 'Problème de permissions';
        if (data.errorDetails) {
          errorMsg += ` - ${data.errorDetails}`;
        }
        if (data.missingScopes && data.missingScopes.length > 0) {
          errorMsg += ` (scopes: ${data.missingScopes.join(', ')})`;
        }
        setPermissionMessage(errorMsg);
      }
    } catch (error: any) {
      setPermissionStatus('error');
      setPermissionMessage('Impossible de vérifier les permissions');
    }
  };

  const loadDrives = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('kdrive-api', {
        body: { action: 'list-drives' }
      });

      if (error) throw error;

      console.log('Drive loaded:', data);
      
      if (data.data && data.data.length > 0) {
        const fixedDrive = data.data[0]; // Always use the fixed Hub & Up drive
        setDrives([fixedDrive]);
        setSelectedDrive(fixedDrive.id);
        
        console.log('Using fixed kDrive:', fixedDrive);
      } else {
        toast.error('Aucun drive kDrive configuré');
      }
    } catch (error: any) {
      console.error('Error loading drive:', error);
      toast.error('Erreur lors du chargement du drive kDrive');
    } finally {
      setLoading(false);
    }
  };

  const searchClientFolder = async (driveId: number) => {
    setLoading(true);
    try {
      console.log('Searching for folders in drive:', driveId);
      
      // First, list files at root to find CLIENTS folder
      const { data: rootData, error: rootError } = await supabase.functions.invoke('kdrive-api', {
        body: { 
          action: 'list-files',
          driveId,
          folderId: 1 // Root folder
        }
      });

      if (rootError) {
        console.error('Root list error:', rootError);
        throw rootError;
      }

      console.log('Root files:', rootData);

      const foundFolders: KDriveFolder[] = [];
      
      // Find CLIENTS folder in root
      const clientsFolder = rootData?.data?.find((f: any) => 
        f.type === 'dir' && f.name.toUpperCase() === 'CLIENTS'
      );

      if (clientsFolder) {
        foundFolders.push({
          id: clientsFolder.id,
          name: clientsFolder.name,
          path: clientsFolder.path || `/${clientsFolder.name}`
        });

        // Now list inside CLIENTS folder to find company folders
        const { data: clientsData, error: clientsError } = await supabase.functions.invoke('kdrive-api', {
          body: { 
            action: 'list-files',
            driveId,
            folderId: clientsFolder.id
          }
        });

        if (!clientsError && clientsData?.data) {
          console.log('Folders inside CLIENTS:', clientsData.data);
          
          // Add all folders from CLIENTS directory
          const companyFolders = clientsData.data
            .filter((f: any) => f.type === 'dir')
            .map((f: any) => ({
              id: f.id,
              name: f.name,
              path: f.path || `/CLIENTS/${f.name}`
            }));
          
          foundFolders.push(...companyFolders);
        }
      }

      console.log('Found folders:', foundFolders);
      setFolders(foundFolders);
      
      if (foundFolders.length === 0) {
        toast.info('Aucun dossier trouvé. Créez-en un nouveau ci-dessous.');
      }
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
      console.log('Creating folder for client:', newFolderName);
      
      // First, check if CLIENTS folder exists
      const { data: rootData } = await supabase.functions.invoke('kdrive-api', {
        body: { 
          action: 'list-files',
          driveId: selectedDrive,
          folderId: 1
        }
      });

      let clientsFolderId = rootData?.data?.find((f: any) => 
        f.type === 'dir' && f.name.toUpperCase() === 'CLIENTS'
      )?.id;

      // Create CLIENTS folder if it doesn't exist
      if (!clientsFolderId) {
        const { data: newClientsFolder, error: createError } = await supabase.functions.invoke('kdrive-api', {
          body: { 
            action: 'create-folder',
            driveId: selectedDrive,
            parentId: 1,
            folderPath: 'CLIENTS'
          }
        });

        if (createError) throw createError;
        clientsFolderId = newClientsFolder.data.id;
        console.log('Created CLIENTS folder:', clientsFolderId);
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

      console.log('Created company folder:', companyFolder);

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
      checkPermissions();
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
            {/* Permission Status */}
            {permissionStatus === 'checking' && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Vérification des permissions...</AlertTitle>
              </Alert>
            )}
            
            {permissionStatus === 'ok' && (
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">Permissions OK</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  {permissionMessage}
                </AlertDescription>
              </Alert>
            )}
            
            {permissionStatus === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Problème de connexion</AlertTitle>
                <AlertDescription>
                  {permissionMessage}
                  <br />
                  <span className="text-sm mt-2 block">
                    Assurez-vous que le token a accès au produit kDrive "Hub & Up" (ID: 969307)
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Drive Info */}
            {drives.length === 0 && !loading && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Aucun drive trouvé</AlertTitle>
                <AlertDescription>
                  Le kDrive Hub & Up n'est pas accessible. Vérifiez la configuration du token.
                </AlertDescription>
              </Alert>
            )}
            
            {drives.length > 0 && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">Drive kDrive: {drives[0].name}</p>
                <p className="text-xs text-muted-foreground">ID: {drives[0].id}</p>
              </div>
            )}

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
                      placeholder="Nom du dossier"
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
