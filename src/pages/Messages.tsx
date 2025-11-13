import { MessageSquare } from 'lucide-react';
import { ChatRoomList } from '@/components/messages/ChatRoomList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { PushNotificationPrompt } from '@/components/messages/PushNotificationPrompt';
import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Messages() {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { canRead, loading } = usePermissions();
  const isMobile = useIsMobile();

  // Check permission
  if (!loading && !canRead('messages')) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <div className="h-screen flex flex-col">
        {!isMobile && (
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
        )}

        <div className="flex-1 flex overflow-hidden">
          {isMobile ? (
            selectedRoomId ? (
              <div className="flex-1 flex flex-col">
                <ChatWindow roomId={selectedRoomId} onBack={() => setSelectedRoomId(null)} />
              </div>
            ) : (
              <div className="flex-1">
                <ChatRoomList
                  selectedRoomId={selectedRoomId}
                  onSelectRoom={setSelectedRoomId}
                />
              </div>
            )
          ) : (
            <>
              <ChatRoomList
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
              />
              <ChatWindow roomId={selectedRoomId} />
            </>
          )}
        </div>
      </div>
      
      <PushNotificationPrompt />
    </>
  );
}
