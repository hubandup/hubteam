import { supabase } from "@/integrations/supabase/client";
import { Folder, Plus, Loader2, HardDrive } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Fixed kDrive configuration
const KDRIVE_DRIVE_ID = 6963095; // Hub & Up
const KDRIVE_ROOT_FOLDER_ID = "50121"; // CRM root folder

interface KDriveFile {
  id: string;
  name: string;
  type: string;
  path?: string;
}

interface KDriveFolderSelectorProps {
  clientId: string;
  clientName: string;
  onFolderConnected: () => void;
}

export function KDriveFolderSelector({
  clientId,
  clientName,
  onFolderConnected,
}: KDriveFolderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [folders, setFolders] = useState<KDriveFile[]>([]);
  const [newFolderName, setNewFolderName] = useState(clientName);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }

      // Pré-vérification des permissions du token kDrive
      const permCheck = await supabase.functions.invoke("kdrive-api", {
        body: { action: "check-permissions" },
      });

      const hasScopes = permCheck.data?.hasRequiredScopes;
      if (!hasScopes) {
        const details = permCheck.data?.errorDetails || permCheck.error?.message;
        console.error("Permissions kDrive insuffisantes:", details);
        toast.error(
          `Token kDrive invalide ou insuffisant${details ? `: ${details}` : ""}`
        );
        return;
      }

      const response = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "list-files",
          // Ne pas passer driveId, l'edge function le déduit du produit configuré
          folderId: KDRIVE_ROOT_FOLDER_ID,
          rootFolderId: KDRIVE_ROOT_FOLDER_ID,
        },
      });

      if (response.error) {
        console.error("Erreur lors du chargement des dossiers:", response.error);
        toast.error("Impossible de charger les dossiers kDrive");
        return;
      }

      const files = response.data?.data || [];
      const folderList = files.filter((file: KDriveFile) => file.type === "dir");
      setFolders(folderList);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Veuillez saisir un nom de dossier");
      return;
    }

    setIsCreatingFolder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }

      const response = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "create-folder",
          fileName: newFolderName,
          parentId: KDRIVE_ROOT_FOLDER_ID,
          rootFolderId: KDRIVE_ROOT_FOLDER_ID,
        },
      });

      if (response.error) {
        console.error("Erreur création dossier:", response.error);
        toast.error("Impossible de créer le dossier");
        return;
      }

      const newFolder = response.data?.data;
      toast.success(`Dossier "${newFolderName}" créé`);
      setNewFolderName("");
      
      // Auto-select the newly created folder
      if (newFolder?.id) {
        await selectFolder(newFolder);
      } else {
        loadFolders();
      }
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(error.message || "Erreur lors de la création");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const selectFolder = async (folder: KDriveFile) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          kdrive_folder_id: folder.id,
          kdrive_folder_path: `CRM/${folder.name}`,
          kdrive_drive_id: KDRIVE_DRIVE_ID,
        })
        .eq("id", clientId);

      if (error) throw error;

      toast.success(`Dossier "${folder.name}" associé au client`);
      setIsOpen(false);
      onFolderConnected();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'association du dossier");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <HardDrive className="h-4 w-4" />
        Connecter kDrive
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sélectionner un dossier kDrive</DialogTitle>
            <DialogDescription>
              Dossier racine : CRM (Hub & Up)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create new folder */}
            <div className="flex gap-2">
              <Input
                placeholder="Nom du dossier client..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
              />
              <Button
                onClick={createFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                size="sm"
              >
                {isCreatingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Separator />

            {/* Folder list */}
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : folders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun dossier disponible. Créez-en un nouveau ci-dessus.
                </div>
              ) : (
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant="ghost"
                      className="w-full justify-start gap-2"
                      onClick={() => selectFolder(folder)}
                    >
                      <Folder className="h-4 w-4" />
                      <span>{folder.name}</span>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
