import { MessageSquare } from 'lucide-react';
import { ChatRoomList } from '@/components/messages/ChatRoomList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';

export default function Messages() {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { canRead, loading } = usePermissions();

  // Check permission
  if (!loading && !canRead('messages')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Messagerie</h1>
            <p className="text-sm text-muted-foreground">
              Conversations d'équipe et messages directs
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <ChatRoomList
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
        />
        <ChatWindow roomId={selectedRoomId} />
      </div>
    </div>
  );
}
