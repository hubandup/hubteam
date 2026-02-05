import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface SwissTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SWISSTRANSFER_URL = 'https://www.swisstransfer.com';

export function SwissTransferDialog({ open, onOpenChange }: SwissTransferDialogProps) {
  const [iframeError, setIframeError] = useState(false);

  const handleOpenExternal = () => {
    window.open(SWISSTRANSFER_URL, '_blank', 'noopener,noreferrer');
  };

  const handleIframeError = () => {
    setIframeError(true);
  };

  // Reset error state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIframeError(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-[90vw] max-h-[95vh] md:max-h-[90vh] w-full h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 md:px-6 md:py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-base md:text-lg font-semibold">
              SwissTransfer
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenExternal}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Ouvrir dans un nouvel onglet</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {iframeError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
              <p className="text-muted-foreground">
                SwissTransfer ne peut pas être affiché dans l'application.
              </p>
              <Button onClick={handleOpenExternal} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ouvrir SwissTransfer.com
              </Button>
            </div>
          ) : (
            <iframe
              src={SWISSTRANSFER_URL}
              className="w-full h-full border-none"
              allow="clipboard-write"
              title="SwissTransfer"
              onError={handleIframeError}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
