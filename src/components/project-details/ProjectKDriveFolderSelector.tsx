import { supabase } from "@/integrations/supabase/client";
import { Folder, Loader2, HardDrive, Search, ArrowUpDown, Plus } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KDRIVE_DRIVE_ID = "969307";
const KDRIVE_ROOT_FOLDER_ID = "50121";

interface KDriveFile {
  id: string;
  name: string;
  type: string;
  path?: string;
}

interface ProjectKDriveFolderSelectorProps {
  projectId: string;
  onFolderConnected: () => void;
}

export function ProjectKDriveFolderSelector({
  projectId,
  onFolderConnected,
}: ProjectKDriveFolderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializingLocation, setIsInitializingLocation] = useState(false);
  const [folders, setFolders] = useState<KDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState(KDRIVE_ROOT_FOLDER_ID);
  const [currentPath, setCurrentPath] = useState("Common documents");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: KDRIVE_ROOT_FOLDER_ID, name: "Common documents" }
  ]);
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc">("name-asc");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => {
    if (isOpen) {
      initializeLocation();
    }
  }, [isOpen, projectId]);

  useEffect(() => {
    if (isOpen && !isInitializingLocation) {
      loadFolders();
    }
  }, [isOpen, isInitializingLocation, currentFolderId, searchQuery]);

  const filteredFolders = useMemo(() => {
    return [...folders].sort((a, b) => {
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });
  }, [folders, sortBy]);

  const resetLocationToRoot = () => {
    setCurrentFolderId(KDRIVE_ROOT_FOLDER_ID);
    setCurrentPath("Common documents");
    setBreadcrumbs([{ id: KDRIVE_ROOT_FOLDER_ID, name: "Common documents" }]);
  };

  const initializeLocation = async () => {
    setIsInitializingLocation(true);
    setSearchQuery("");

    try {
      const { data: project, error } = await supabase
        .from("projects")
        .select(`
          kdrive_folder_id,
          kdrive_folder_path,
          project_clients(
            clients(company, kdrive_folder_id, kdrive_folder_path)
          )
        `)
        .eq("id", projectId)
        .single();

      if (error) throw error;

      const client = project.project_clients?.[0]?.clients;
      const initialFolderId = project.kdrive_folder_id || client?.kdrive_folder_id || KDRIVE_ROOT_FOLDER_ID;
      const initialPath = project.kdrive_folder_path || client?.kdrive_folder_path || "Common documents";

      if (initialFolderId === KDRIVE_ROOT_FOLDER_ID) {
        resetLocationToRoot();
        return;
      }

      const pathSegments = initialPath.split("/").filter(Boolean);
      const leafName = pathSegments[pathSegments.length - 1] || client?.company || "Dossier";

      setCurrentFolderId(initialFolderId);
      setCurrentPath(initialPath);
      setBreadcrumbs([
        { id: KDRIVE_ROOT_FOLDER_ID, name: "Common documents" },
        { id: initialFolderId, name: leafName },
      ]);
    } catch (error) {
      console.error("Erreur d'initialisation kDrive:", error);
      resetLocationToRoot();
    } finally {
      setIsInitializingLocation(false);
    }
  };

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expirée"); return; }

      const permCheck = await supabase.functions.invoke("kdrive-api", {
        body: { action: "check-permissions", rootFolderId: KDRIVE_ROOT_FOLDER_ID },
      });
      if (!permCheck.data?.hasRequiredScopes) {
        toast.error("Token kDrive invalide ou insuffisant");
        return;
      }

      let allFolders: KDriveFile[] = [];
      let offset = 0;
      let hasMore = true;
      const seenIds = new Set<string>();
      let iterations = 0;

      while (hasMore && iterations < 100) {
        iterations++;
        const response = await supabase.functions.invoke("kdrive-api", {
          body: {
            action: "list-files",
            folderId: currentFolderId,
            rootFolderId: KDRIVE_ROOT_FOLDER_ID,
            searchQuery: searchQuery.trim() || undefined,
            offset,
            limit: 200,
          },
        });
        if (response.error) { toast.error("Impossible de charger les dossiers kDrive"); return; }

        const files = response.data?.data || [];
        const dirs = files.filter((f: KDriveFile) => f.type === "dir");
        let newCount = 0;
        dirs.forEach((folder: KDriveFile) => {
          if (!seenIds.has(folder.id)) { seenIds.add(folder.id); allFolders.push(folder); newCount++; }
        });
        hasMore = response.data?.has_more === true && newCount > 0;
        offset += 200;
      }
      setFolders(allFolders);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setIsLoading(false);
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
      setCurrentFolderId(sliced[sliced.length - 1].id);
      setCurrentPath(sliced.map((x) => x.name).join("/"));
      return sliced;
    });
  };

  const selectFolder = async (folderId: string, folderPath: string) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          kdrive_folder_id: folderId,
          kdrive_folder_path: folderPath,
          kdrive_drive_id: Number(KDRIVE_DRIVE_ID),
        })
        .eq("id", projectId);
      if (error) throw error;
      toast.success(`Dossier "${folderPath}" associé au projet`);
      setIsOpen(false);
      onFolderConnected();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'association du dossier");
    }
  };

  const selectCurrentFolder = () => selectFolder(currentFolderId, currentPath);
  const selectSpecificFolder = (folder: KDriveFile) => selectFolder(folder.id, `${currentPath}/${folder.name}`);

  const createFolder = async (folderName: string) => {
    setIsCreatingFolder(true);
    try {
      const response = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "create-folder",
          driveId: KDRIVE_DRIVE_ID,
          parentId: currentFolderId || KDRIVE_ROOT_FOLDER_ID,
          rootFolderId: KDRIVE_ROOT_FOLDER_ID,
          folderName,
        },
      });
      if (response.error || response.data?.error) {
        toast.error(response.data?.error?.description || "Erreur lors de la création du dossier");
        return;
      }
      if (response.data?.data || response.data?.result === "success") {
        toast.success(`Dossier "${folderName}" créé avec succès`);
        setSearchQuery("");
        await loadFolders();
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création du dossier");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)} className="gap-2">
        <HardDrive className="h-4 w-4" />
        Connecter kDrive
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sélectionner un dossier kDrive pour ce projet</DialogTitle>
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

            <ScrollArea className="h-[400px] rounded-md border p-4">
              {isLoading || isInitializingLocation ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredFolders.length === 0 && !searchQuery.trim() ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun sous-dossier disponible. Créez-en un nouveau ou sélectionnez ce dossier.
                </div>
              ) : filteredFolders.length === 0 && searchQuery.trim() ? (
                <div className="text-center py-8 space-y-4">
                  <Folder className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Aucun dossier ne correspond à "{searchQuery}"</p>
                  <Button onClick={() => createFolder(searchQuery.trim())} disabled={isCreatingFolder} size="sm">
                    {isCreatingFolder ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création en cours...</>
                    ) : (
                      <><Plus className="h-4 w-4 mr-2" />Créer le dossier "{searchQuery.trim()}"</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFolders.map((folder) => (
                    <div key={folder.id} className="group flex items-center justify-between rounded-md hover:bg-accent">
                      <Button variant="ghost" className="flex-1 justify-start gap-2" onClick={() => navigateToFolder(folder)}>
                        <Folder className="h-4 w-4" />
                        <span>{folder.name}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="opacity-0 group-hover:opacity-100 transition-opacity mr-2"
                        onClick={(e) => { e.stopPropagation(); selectSpecificFolder(folder); }}
                      >
                        Sélectionner
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button onClick={selectCurrentFolder}>Sélectionner ce dossier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
