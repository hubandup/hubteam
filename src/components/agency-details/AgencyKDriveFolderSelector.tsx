import { supabase } from "@/integrations/supabase/client";
import { Folder, Plus, Loader2, Search, ArrowUpDown } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Fixed kDrive configuration for agencies
const KDRIVE_DRIVE_ID = 969307; // Hub & Up (product id)
const AGENCIES_FOLDER_ID = "50123"; // Hub & Up > Agences folder ID
const DEBUG_NO_FILTER = true; // Set to true to disable server-side filtering

interface KDriveFile {
  id: string;
  name: string;
  type: string;
  path?: string;
}

interface AgencyKDriveFolderSelectorProps {
  agencyId: string;
  agencyName: string;
  currentDriveId?: number | null;
  currentFolderId?: string | null;
  currentFolderPath?: string | null;
  onFolderConnected: () => void;
}

export function AgencyKDriveFolderSelector({
  agencyId,
  agencyName,
  currentDriveId,
  currentFolderId,
  currentFolderPath,
  onFolderConnected,
}: AgencyKDriveFolderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [folders, setFolders] = useState<KDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId_state, setCurrentFolderId] = useState(AGENCIES_FOLDER_ID);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: AGENCIES_FOLDER_ID, name: "Agences" }
  ]);
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc">("name-asc");

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, currentFolderId_state, searchQuery]);

  const filteredFolders = useMemo(() => {
    // Server-side filtering is already applied, just sort
    let result = folders;
    
    // Apply sorting
    return result.sort((a, b) => {
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      } else {
        return b.name.localeCompare(a.name);
      }
    });
  }, [folders, sortBy]);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      // Load all folders with pagination and duplicate detection
      let allFolders: KDriveFile[] = [];
      let offset = 0;
      let hasMore = true;
      const seenIds = new Set<string>();
      const maxIterations = 100; // Safety limit
      let iterationCount = 0;

      console.log("[KDrive Agency] Starting folder load - currentFolderId:", currentFolderId_state, "searchQuery:", searchQuery);

      while (hasMore && iterationCount < maxIterations) {
        iterationCount++;
        
        console.log(`[KDrive Agency] Iteration ${iterationCount} - offset: ${offset}, seenIds: ${seenIds.size}`);
        
        const response = await supabase.functions.invoke("kdrive-api", {
          body: {
            action: "list-files",
            folderId: currentFolderId_state,
            rootFolderId: AGENCIES_FOLDER_ID,
            debugNoFilter: DEBUG_NO_FILTER,
            searchQuery: searchQuery.trim() || undefined,
            offset,
            limit: 50,
          },
        });

        if (response.error) {
          console.error("Erreur lors du chargement des dossiers:", response.error);
          toast.error("Impossible de charger les dossiers kDrive");
          return;
        }

        const files = response.data?.data || [];
        const folders = files.filter((file: KDriveFile) => file.type === "dir");
        
        console.log(`[KDrive Agency] Received ${folders.length} folders, has_more: ${response.data?.has_more}`);
        
        // Check for new unique folders
        let newFoldersCount = 0;
        folders.forEach((folder: KDriveFile) => {
          if (!seenIds.has(folder.id)) {
            seenIds.add(folder.id);
            allFolders.push(folder);
            newFoldersCount++;
          }
        });

        console.log(`[KDrive Agency] Added ${newFoldersCount} new unique folders (total: ${allFolders.length})`);

        // Stop if no new folders or API says no more
        hasMore = response.data?.has_more === true && newFoldersCount > 0;
        offset += 50;
      }

      console.log(`[KDrive Agency] Finished loading - total folders: ${allFolders.length}`);
      setFolders(allFolders);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  };


  const navigateToFolder = (folder: KDriveFile) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const targetBreadcrumb = breadcrumbs[index];
    setCurrentFolderId(targetBreadcrumb.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const connectFolder = async (folderId: string, folderName: string) => {
    try {
      const fullPath = breadcrumbs.map(b => b.name).join(" > ") + " > " + folderName;
      
      const { error } = await supabase
        .from('agencies')
        .update({
          kdrive_drive_id: KDRIVE_DRIVE_ID,
          kdrive_folder_id: folderId,
          kdrive_folder_path: fullPath
        })
        .eq('id', agencyId);

      if (error) throw error;

      toast.success("Dossier kDrive connecté avec succès");
      setIsOpen(false);
      onFolderConnected();
    } catch (error: any) {
      console.error("Erreur lors de la connexion du dossier:", error);
      toast.error("Erreur lors de la connexion du dossier");
    }
  };

  const disconnectFolder = async () => {
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          kdrive_drive_id: null,
          kdrive_folder_id: null,
          kdrive_folder_path: null
        })
        .eq('id', agencyId);

      if (error) throw error;

      toast.success("Dossier kDrive déconnecté");
      onFolderConnected();
    } catch (error: any) {
      console.error("Erreur lors de la déconnexion:", error);
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <>
      <div className="space-y-3">
        {currentFolderId && currentFolderPath ? (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Folder className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Dossier connecté</p>
                  <p className="text-sm text-muted-foreground">{currentFolderPath}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={disconnectFolder}
              >
                Déconnecter
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center p-6 border-2 border-dashed rounded-lg">
            <Folder className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Aucun dossier kDrive connecté
            </p>
            <Button onClick={() => setIsOpen(true)}>
              <Folder className="h-4 w-4 mr-2" />
              Connecter un dossier
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Sélectionner un dossier kDrive</DialogTitle>
            <DialogDescription>
              Parcourez et sélectionnez le dossier de l'agence dans Hub & Up {'>'} Agences
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center gap-2">
                  {index > 0 && <span>/</span>}
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>

            <Separator />

            {/* Search and Sort */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un dossier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nom A → Z</SelectItem>
                  <SelectItem value="name-desc">Nom Z → A</SelectItem>
                </SelectContent>
              </Select>
            </div>


            {/* Folders list */}
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Aucun dossier trouvé</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-3 hover:bg-muted rounded-lg group"
                    >
                      <button
                        onClick={() => navigateToFolder(folder)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <Folder className="h-5 w-5 text-primary" />
                        <span className="font-medium">{folder.name}</span>
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => connectFolder(folder.id, folder.name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Sélectionner
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
