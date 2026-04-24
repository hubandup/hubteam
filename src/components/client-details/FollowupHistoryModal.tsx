import { History } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { FollowupHistoryList } from './FollowupHistoryList';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trackingId: string;
}

export function FollowupHistoryModal({ open, onOpenChange, trackingId }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 display">
            <History className="h-5 w-5" style={{ color: '#0f1422' }} />
            Historique des excuses générées
          </DialogTitle>
          <DialogDescription>
            Toutes les excuses de relance produites pour ce client.
          </DialogDescription>
        </DialogHeader>
        <FollowupHistoryList trackingId={trackingId} />
      </DialogContent>
    </Dialog>
  );
}
