import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Upload,
  FolderIcon,
  FileIcon,
  FolderPlus,
  Home,
  ChevronRight,
  Trash2,
  MoreVertical,
  Edit,
} from "lucide-react";
import { Unlink, Eye } from "lucide-react";
import { toast } from "sonner";
import { KDriveFolderSelector } from "./KDriveFolderSelector";
import { useUserRole } from "@/hooks/useUserRole";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameFileDialog } from "./RenameFileDialog";
import { FilePreviewPane } from "./FilePreviewPane";
import { Progress } from "@/components/ui/progress";

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface ClientKDriveTabProps {
  clientId: string;
}

interface KDriveFile {
  id: number;
  name: string;
  type: "dir" | "file";
  size?: number;
  created_at?: string;
  path: string;
  parent_id?: number | null;
}

export function ClientKDriveTab({ clientId }: ClientKDriveTabProps) {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<KDriveFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: number; path: string; parentId: number | null } | null>(
    null,
  );
  const [client, setClient] = useState<any>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: number; name: string; type: "dir" | "file" } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: number; name: string; path: string }>>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showDropZone, setShowDropZone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [rootFolderName, setRootFolderName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: "dir" | "file" } | null>(null);
  const [previewFile, setPreviewFile] = useState<KDriveFile | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);

  useEffect(() => {
    loadClientFolder();
  }, [clientId]);

  useEffect(() => {
    // Reset selection when changing folders
    setSelectedIds([]);
  }, [currentFolder?.id]);

  const loadClientFolder = async () => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      if (clientData.kdrive_folder_id && clientData.kdrive_drive_id) {
        setCurrentFolder({
          id: parseInt(clientData.kdrive_folder_id),
          path: clientData.kdrive_folder_path || "/",
          parentId: null,
        });
        
        // Fetch root folder name from kDrive API
        await fetchRootFolderName(clientData.kdrive_drive_id, clientData.kdrive_folder_id);
        
        setBreadcrumbs([
          {
            id: parseInt(clientData.kdrive_folder_id),
            name: rootFolderName || clientData.company,
            path: clientData.kdrive_folder_path || "/",
          },
        ]);
        await loadFiles(clientData.kdrive_drive_id, clientData.kdrive_folder_id);
      } else if (clientData.kdrive_folder_id && !clientData.kdrive_drive_id) {
        // Folder is selected but drive is missing: backend will use default drive
        setCurrentFolder({
          id: parseInt(clientData.kdrive_folder_id),
          path: clientData.kdrive_folder_path || "/",
          parentId: null,
        });
        
        // Fetch root folder name from kDrive API (backend will infer drive)
        await fetchRootFolderName(undefined, clientData.kdrive_folder_id);
        
        setBreadcrumbs([
          {
            id: parseInt(clientData.kdrive_folder_id),
            name: rootFolderName || clientData.company,
            path: clientData.kdrive_folder_path || "/",
          },
        ]);
        
        // Let the backend infer the drive (uses KDRIVE_PRODUCT_ID)
        await loadFiles(undefined, clientData.kdrive_folder_id);
      }
    } catch (error) {
      console.error("Error loading client folder:", error);
      toast.error("Erreur lors du chargement du dossier");
    } finally {
      setLoading(false);
    }
  };

  const fetchRootFolderName = async (driveId: number, folderId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "get-folder-info",
          driveId,
          folderId,
        },
      });

      if (error) throw error;
      if (data?.data?.name) {
        setRootFolderName(data.data.name);
      }
    } catch (error) {
      console.error("Error fetching root folder name:", error);
    }
  };

  const loadFiles = async (driveId: number | undefined, folderId: string, append = false, customOffset?: number) => {
    try {
      const effectiveDriveId = (driveId as any) ?? undefined;

      // Simple single request - no pagination loop
      const { data, error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "list-files",
          driveId: effectiveDriveId,
          folderId,
          limit: 500,
          offset: 0,
        },
      });

      if (error) throw error;

      const arr = Array.isArray(data?.data) ? data.data : [];

      // Get parent_id from first entry if available
      const parentId = arr?.[0]?.parent_id ?? null;
      if (currentFolder) {
        setCurrentFolder((prev) => (prev ? { ...prev, parentId } : null));
      }

      setHasMore(false);
      setOffset(arr.length);
      setFiles(arr);
    } catch (error) {
      console.error("Error loading files:", error);
      toast.error("Erreur lors du chargement des fichiers");
    }
  };

  const handleFileUpload = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0 || !client || !currentFolder) return;

    const filesArray = Array.from(fileList);
    const initialQueue: UploadProgress[] = filesArray.map(f => ({
      fileName: f.name,
      progress: 0,
      status: 'pending' as const
    }));
    
    setUploadQueue(initialQueue);
    setUploading(true);

    let successCount = 0;

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

        const { error } = await supabase.functions.invoke("kdrive-api", {
          body: {
            action: "upload-file",
            driveId: client.kdrive_drive_id,
            folderId: currentFolder.id.toString(),
            fileName: file.name,
            fileContent: base64Data,
          },
        });

        if (error) throw error;

        successCount++;
        setUploadQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'done', progress: 100 } : item
        ));
      } catch (error) {
        console.error("Error uploading file:", error);
        setUploadQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'error', progress: 0 } : item
        ));
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} fichier(s) téléversé(s) avec succès`);
    }
    await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
    
    setTimeout(() => {
      setUploadQueue([]);
      setUploading(false);
    }, 1500);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    if (!client) return;

    try {
      const { data, error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "download-file",
          driveId: client.kdrive_drive_id,
          fileId: fileId.toString(),
        },
      });

      if (error) throw error;

      const base64 = (data as any)?.data as string;
      if (!base64) throw new Error("Contenu manquant");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Fichier téléchargé");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleViewPdf = async (fileId: number, fileName: string) => {
    if (!client) return;

    try {
      const { data, error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "download-file",
          driveId: client.kdrive_drive_id,
          fileId: fileId.toString(),
        },
      });

      if (error) throw error;

      const base64 = (data as any)?.data as string;
      if (!base64) throw new Error("Contenu manquant");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfFileName(fileName);
      setIsPdfOpen(true);
    } catch (error) {
      console.error("Error viewing PDF:", error);
      toast.error("Erreur lors de l'ouverture du PDF");
    }
  };

  const handleFolderClick = async (
    folderId: number,
    folderName: string,
    folderPath: string,
    parentId: number | null = null,
  ) => {
    if (!client) return;
    setCurrentFolder({ id: folderId, path: folderPath, parentId });
    setFiles([]);
    setOffset(0);
    setHasMore(false);

    // Update breadcrumbs
    const existingIndex = breadcrumbs.findIndex((b) => b.id === folderId);
    if (existingIndex >= 0) {
      setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
    } else {
      setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName, path: folderPath }]);
    }

    await loadFiles(client.kdrive_drive_id, folderId.toString(), false, 0);
  };

  const handleGoToRoot = async () => {
    if (!client) return;
    setCurrentFolder({
      id: parseInt(client.kdrive_folder_id),
      path: client.kdrive_folder_path || "/",
      parentId: null,
    });
    setFiles([]);
    setOffset(0);
    setHasMore(false);
    setBreadcrumbs([
      { id: parseInt(client.kdrive_folder_id), name: rootFolderName || client.company, path: client.kdrive_folder_path || "/" },
    ]);
    await loadFiles(client.kdrive_drive_id, client.kdrive_folder_id, false, 0);
  };

  const handleGoToParent = async () => {
    if (!currentFolder?.parentId || !client) return;

    try {
      setCurrentFolder({
        id: currentFolder.parentId,
        path: "/",
        parentId: null,
      });
      setFiles([]);
      setOffset(0);
      setHasMore(false);

      if (breadcrumbs.length > 1) {
        setBreadcrumbs(breadcrumbs.slice(0, -1));
      }

      await loadFiles(client.kdrive_drive_id, currentFolder.parentId.toString(), false, 0);
    } catch (error) {
      console.error("Error navigating to parent:", error);
      toast.error("Erreur lors de la navigation");
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !client || !currentFolder) return;

    setIsCreatingFolder(true);
    try {
      const { error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "create-folder",
          driveId: client.kdrive_drive_id,
          parentId: currentFolder.id.toString(),
          folderName: newFolderName,
        },
      });

      if (error) throw error;

      toast.success("Dossier créé avec succès");
      setIsCreateFolderOpen(false);
      setNewFolderName("");
      await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Erreur lors de la création du dossier");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRevokeConnection = async () => {
    if (!client) return;

    setIsRevoking(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          kdrive_drive_id: null,
          kdrive_folder_id: null,
          kdrive_folder_path: null,
        })
        .eq("id", clientId);

      if (error) throw error;

      toast.success("Connexion kDrive révoquée avec succès");
      setIsRevokeOpen(false);
      setClient({ ...client, kdrive_drive_id: null, kdrive_folder_id: null, kdrive_folder_path: null });
      setCurrentFolder(null);
      setFiles([]);
      setBreadcrumbs([]);
      setRootFolderName(null);
    } catch (error) {
      console.error("Error revoking connection:", error);
      toast.error("Erreur lors de la révocation");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !client || !currentFolder) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: deleteItem.type === "dir" ? "delete-folder" : "delete-file",
          driveId: client.kdrive_drive_id,
          fileId: deleteItem.id.toString(),
        },
      });

      if (error) throw error;

      toast.success(`${deleteItem.type === "dir" ? "Dossier" : "Fichier"} supprimé avec succès`);
      setDeleteItem(null);
      await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.length === 0 || !client || !currentFolder) return;

    setIsDeletingMultiple(true);
    try {
      const { error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "delete-files",
          driveId: client.kdrive_drive_id,
          fileIds: selectedIds,
        },
      });

      if (error) throw error;

      toast.success(`${selectedIds.length} élément(s) supprimé(s) avec succès`);
      setSelectedIds([]);
      setShowDeleteMultipleConfirm(false);
      await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
    } catch (error) {
      console.error("Error deleting multiple:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map(f => f.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBreadcrumbClick = async (breadcrumb: { id: number; name: string; path: string }) => {
    if (!client) return;
    setCurrentFolder({ id: breadcrumb.id, path: breadcrumb.path, parentId: null });
    setFiles([]);
    setOffset(0);
    setHasMore(false);

    const index = breadcrumbs.findIndex((b) => b.id === breadcrumb.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));

    await loadFiles(client.kdrive_drive_id, breadcrumb.id.toString(), false, 0);
  };

  const handleRename = async (newName: string) => {
    if (!renameItem || !client || !currentFolder) return;

    try {
      const { data, error } = await supabase.functions.invoke("kdrive-api", {
        body: {
          action: "rename",
          driveId: client.kdrive_drive_id,
          fileId: renameItem.id,
          newName,
        },
      });

      if (error) throw error;

      toast.success(`${renameItem.type === "dir" ? "Dossier" : "Fichier"} renommé avec succès`);
      setRenameItem(null);
      await loadFiles(client.kdrive_drive_id, currentFolder.id.toString());
    } catch (error) {
      console.error("Error renaming:", error);
      toast.error("Erreur lors du renommage");
      throw error;
    }
  };

  const handleGetFileUrl = async (fileId: number): Promise<{ url: string; mimeType?: string }> => {
    if (!client) throw new Error("Client not loaded");

    const { data, error } = await supabase.functions.invoke("kdrive-api", {
      body: {
        action: "get-file-url",
        // Fallback to Hub & Up drive id to avoid undefined in URL
        driveId: client.kdrive_drive_id ?? 969307,
        fileId,
      },
    });

    if (error) throw error;
    if (!data?.data?.url) throw new Error("No URL returned");

    return { url: data.data.url, mimeType: data.data.mimeType };
  };

  const handleFileClick = (file: KDriveFile) => {
    if (file.type === "file") {
      setPreviewFile(file);
    } else {
      handleFolderClick(
        file.id,
        file.name,
        (file as any).path || `${currentFolder?.path || ""}/${file.name}`,
        currentFolder?.id || null,
      );
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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
      handleFileUpload(e.dataTransfer.files);
      setShowDropZone(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    const sizes = ["B", "KB", "MB", "GB"];
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
    <div 
      className="space-y-4 relative"
      onDragEnter={currentFolder ? handleDragEnter : undefined}
      onDragLeave={currentFolder ? handleDragLeave : undefined}
      onDragOver={currentFolder ? handleDragOver : undefined}
      onDrop={currentFolder ? handleDrop : undefined}
    >
      {/* Drag overlay */}
      {isDragging && currentFolder && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-12 w-12" />
            <p className="text-lg font-medium">Déposez vos fichiers ici</p>
          </div>
        </div>
      )}

      {!client?.kdrive_folder_id && (
        <div className="rounded-md border border-warning/50 bg-warning/20 p-3 text-sm flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Le drive kDrive n'est pas attribué pour ce dossier.</span>
          {isAdmin && (
            <KDriveFolderSelector
              clientId={clientId}
              clientName={client?.company || "Client"}
              onFolderConnected={loadClientFolder}
            />
          )}
        </div>
      )}


      {client?.kdrive_folder_id && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-1">
              <button onClick={() => handleBreadcrumbClick(crumb)} className="hover:text-primary transition-colors">
                {crumb.name}
              </button>
              {index < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4" />}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoToRoot}
            title="Retour à la racine"
            disabled={!currentFolder}
          >
            <Home className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCreateFolderOpen(true)}
            disabled={!currentFolder}
            title="Nouveau dossier"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={uploading || !currentFolder}
            onClick={() => {
              
              setShowDropZone(!showDropZone);
            }}
            title="Téléverser des fichiers"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          {client?.kdrive_folder_id && isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsRevokeOpen(true)}
              title="Révoquer la connexion kDrive"
              className="text-destructive hover:text-destructive"
            >
              <Unlink className="h-4 w-4" />
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        >
          A↔Z {sortOrder === "asc" ? "↓" : "↑"}
        </Button>
      </div>

      {showDropZone && (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="rounded-lg border-2 border-dashed border-primary bg-primary/5 p-8 text-center cursor-pointer transition-all"
          onClick={(e) => {
            e.stopPropagation();
            
            fileInputRef.current?.click();
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-primary">Glissez-déposez un fichier ici ou cliquez pour sélectionner</p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploadQueue.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <div className="p-4 space-y-3">
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
          </div>
        </Card>
      )}

      <div className="space-y-2">

        {files.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg mb-2">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.length === files.length && files.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">
                {selectedIds.length > 0 ? `${selectedIds.length} sélectionné(s)` : "Tout sélectionner"}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteMultipleConfirm(true)}
                disabled={isDeletingMultiple}
              >
                {isDeletingMultiple ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Supprimer {selectedIds.length} élément(s)
              </Button>
            )}
          </div>
        )}

        {files.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun fichier ou dossier</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {[...files].sort((a, b) => {
              const compareResult = a.name.localeCompare(b.name);
              return sortOrder === "asc" ? compareResult : -compareResult;
            }).map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedIds.includes(file.id)}
                    onCheckedChange={() => toggleSelect(file.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {file.type === "dir" ? (
                    <FolderIcon className="h-5 w-5 text-primary flex-shrink-0" />
                  ) : (
                    <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleFileClick(file)}>
                    <p className="font-medium truncate hover:text-primary transition-colors">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {file.type === "dir" ? "Dossier" : formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setRenameItem({ id: file.id, name: file.name, type: file.type })}>
                          <Edit className="h-4 w-4 mr-2" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteItem({ id: file.id, name: file.name, type: file.type })}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => client && loadFiles(client.kdrive_drive_id, (currentFolder?.id || 0).toString(), true)}
          >
            Charger plus
          </Button>
        </div>
      )}

      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau dossier</DialogTitle>
            <DialogDescription>Créer un nouveau dossier dans {currentFolder?.path || "/"}</DialogDescription>
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
                setNewFolderName("");
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
                "Créer"
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
              Êtes-vous sûr de vouloir supprimer {deleteItem?.type === "dir" ? "le dossier" : "le fichier"}{" "}
              <strong>{deleteItem?.name}</strong> ?
              {deleteItem?.type === "dir" && " Tout son contenu sera également supprimé."}
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
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteMultipleConfirm} onOpenChange={setShowDeleteMultipleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression multiple</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{selectedIds.length} élément(s)</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMultiple}
              disabled={isDeletingMultiple}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingMultiple ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer la connexion kDrive</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir révoquer la connexion kDrive pour ce client ?
              Les fichiers resteront dans kDrive mais ne seront plus accessibles depuis cette interface.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConnection}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Révocation...
                </>
              ) : (
                "Révoquer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPdfOpen} onOpenChange={(open) => {
        setIsPdfOpen(open);
        if (!open && pdfUrl) {
          window.URL.revokeObjectURL(pdfUrl);
          setPdfUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{pdfFileName}</DialogTitle>
            <DialogDescription>
              Visualisation du fichier PDF
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-full rounded-md border"
                title={pdfFileName}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (pdfUrl) {
                  const a = document.createElement("a");
                  a.href = pdfUrl;
                  a.download = pdfFileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  toast.success("Téléchargement démarré");
                }
              }}
            >
              Télécharger
            </Button>
            <Button onClick={() => setIsPdfOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RenameFileDialog
        open={!!renameItem}
        onOpenChange={(open) => !open && setRenameItem(null)}
        currentName={renameItem?.name || ""}
        onRename={handleRename}
      />

      <FilePreviewPane
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onGetFileUrl={handleGetFileUrl}
      />
    </div>
  );
}
