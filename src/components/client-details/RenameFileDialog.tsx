import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface RenameFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (newName: string) => Promise<void>;
}

export function RenameFileDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: RenameFileDialogProps) {
  const [newName, setNewName] = useState(currentName);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName === currentName) {
      return;
    }

    setIsRenaming(true);
    try {
      await onRename(newName);
      onOpenChange(false);
    } catch (error) {
      console.error('Rename failed:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer</DialogTitle>
          <DialogDescription>
            Modifier le nom du fichier ou dossier
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">Nouveau nom</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRenaming) {
                  handleRename();
                }
              }}
              disabled={isRenaming}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRenaming}
          >
            Annuler
          </Button>
          <Button
            onClick={handleRename}
            disabled={isRenaming || !newName.trim() || newName === currentName}
          >
            {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Renommer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
