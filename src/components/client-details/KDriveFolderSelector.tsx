import { supabase } from "@/integrations/supabase/client";
import { Folder, Plus, Loader2, HardDrive, Search, ArrowUpDown } from "lucide-react";
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

// Fixed kDrive configuration
const KDRIVE_DRIVE_ID = 969307; // Hub & Up (product id)
const KDRIVE_ROOT_FOLDER_ID = "50121"; // Common documents root folder (kDrive folder id)
const DEBUG_NO_FILTER = false; // Set to true to disable server-side filtering

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
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(KDRIVE_ROOT_FOLDER_ID);
  const [currentPath, setCurrentPath] = useState("Common documents");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: KDRIVE_ROOT_FOLDER_ID, name: "Common documents" }
  ]);
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc">("name-asc");

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, currentFolderId, searchQuery]);

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

  const exactMatch = useMemo(() => {
    return folders.some(folder => 
      folder.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );
  }, [folders, searchQuery]);

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
        body: { action: "check-permissions", rootFolderId: KDRIVE_ROOT_FOLDER_ID },
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

      // Load all folders with pagination and duplicate detection
      let allFolders: KDriveFile[] = [];
      let offset = 0;
      let hasMore = true;
      const seenIds = new Set<string>();
      const maxIterations = 100; // Safety limit
      let iterationCount = 0;

      console.log("[KDrive] Starting folder load - currentFolderId:", currentFolderId, "searchQuery:", searchQuery);

      while (hasMore && iterationCount < maxIterations) {
        iterationCount++;
        
        console.log(`[KDrive] Iteration ${iterationCount} - offset: ${offset}, seenIds: ${seenIds.size}`);
        
        const response = await supabase.functions.invoke("kdrive-api", {
          body: {
            action: "list-files",
            folderId: currentFolderId,
            rootFolderId: KDRIVE_ROOT_FOLDER_ID,
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
        
        console.log(`[KDrive] Received ${folders.length} folders, has_more: ${response.data?.has_more}`);
        
        // Check for new unique folders
        let newFoldersCount = 0;
        folders.forEach((folder: KDriveFile) => {
          if (!seenIds.has(folder.id)) {
            seenIds.add(folder.id);
            allFolders.push(folder);
            newFoldersCount++;
          }
        });

        console.log(`[KDrive] Added ${newFoldersCount} new unique folders (total: ${allFolders.length})`);

        // Stop if no new folders or API says no more
        hasMore = response.data?.has_more === true && newFoldersCount > 0;
        offset += 50;
      }

      console.log(`[KDrive] Finished loading - total folders: ${allFolders.length}`);
      setFolders(allFolders);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async (folderName?: string) => {
    const nameToCreate = folderName || newFolderName;
    if (!nameToCreate.trim()) {
      toast.error("Veuillez saisir un nom ou chemin de dossier");
      return;
    }

    const segments = nameToCreate.split("/").map(s => s.trim()).filter(Boolean);
    if (segments.length > 1) {
      await createFolderPath(segments);
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
          parentId: currentFolderId,
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
      
      // Navigate to the newly created folder
      if (newFolder?.id) {
        navigateToFolder(newFolder);
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

  // Create nested folders from segments relative to currentFolderId
  const createFolderPath = async (segments: string[]) => {
    setIsCreatingFolder(true);
    try {
      let parentId: string | number = currentFolderId;
      let pathParts = [...breadcrumbs.map(b => b.name)];

      for (const seg of segments) {
        // Try to find existing folder in current parent via search
        const search = await supabase.functions.invoke("kdrive-api", {
          body: { action: "search-folder", folderPath: seg }
        });
        let existing = (search.data?.data || []).find((f: any) => f.type === "dir" && String(f.parent_id) === String(parentId) && f.name === seg);

        if (!existing) {
          const created = await supabase.functions.invoke("kdrive-api", {
            body: { action: "create-folder", fileName: seg, parentId, rootFolderId: KDRIVE_ROOT_FOLDER_ID }
          });
          if (created.error) throw created.error;
          existing = created.data?.data;
        }

        if (!existing?.id) throw new Error("Création/repérage du dossier échoué");

        // Advance
        parentId = existing.id;
        pathParts.push(seg);
      }

      setNewFolderName("");
      setCurrentFolderId(String(parentId));
      setBreadcrumbs(prev => {
        const root = prev[0];
        const tail = segments.map((s, i) => ({ id: i === segments.length - 1 ? String(parentId) : `${root.id}-${i}`, name: s }));
        return [root, ...tail];
      });
      setCurrentPath(pathParts.join("/"));
      await loadFolders();
      toast.success("Chemin créé avec succès");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Échec de la création du chemin");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const navigateToFolder = (folder: KDriveFile) => {
    if (folder.id === currentFolderId) return;
    setCurrentFolderId(folder.id);
    setCurrentPath((p) => `${p}/${folder.name}`);
    setBreadcrumbs((b) => [...b, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumbs((b) => {
      const sliced = b.slice(0, index + 1);
      const targetId = sliced[sliced.length - 1].id;
      const newPath = sliced.map((x) => x.name).join("/");
      setCurrentFolderId(targetId);
      setCurrentPath(newPath);
      return sliced;
    });
  };

  const selectCurrentFolder = async () => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          kdrive_folder_id: currentFolderId,
          kdrive_folder_path: currentPath,
          // kdrive_drive_id intentionally omitted; resolved server-side
        })
        .eq("id", clientId);

      if (error) throw error;

      toast.success(`Dossier "${currentPath}" associé au client`);
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
              <div className="flex items-center gap-1 flex-wrap">
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.id}-${index}`} className="flex items-center gap-1">
                    <button
                      onClick={() => navigateToBreadcrumb(index)}
                      className="hover:underline"
                      disabled={index === breadcrumbs.length - 1}
                    >
                      {crumb.name}
                    </button>
                    {index < breadcrumbs.length - 1 && <span>/</span>}
                  </span>
                ))}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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

            {/* Create new folder */}
            <div className="flex gap-2">
              <Input
                placeholder="Créer un dossier (ex: CLIENTS/NouveauClient)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
              />
              <Button
                onClick={() => createFolder()}
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
              ) : filteredFolders.length === 0 && !searchQuery.trim() ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun sous-dossier disponible. Créez-en un nouveau ci-dessus ou sélectionnez ce dossier.
                </div>
              ) : filteredFolders.length === 0 && searchQuery.trim() ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">
                    Aucun dossier ne correspond à "{searchQuery}"
                  </p>
                  {!exactMatch && (
                    <Button
                      onClick={() => createFolder(searchQuery)}
                      disabled={isCreatingFolder}
                      variant="outline"
                      className="gap-2"
                    >
                      {isCreatingFolder ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Créer le dossier "{searchQuery}"
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFolders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant="ghost"
                      className="w-full justify-start gap-2"
                      onClick={() => navigateToFolder(folder)}
                    >
                      <Folder className="h-4 w-4" />
                      <span>{folder.name}</span>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button onClick={selectCurrentFolder}>
              Sélectionner ce dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
