import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);
  const { isSupported, permission, requestPermission, subscription } = usePushNotifications();

  useEffect(() => {
    // Check if user has already been prompted or made a choice
    const prompted = localStorage.getItem('push_notifications_prompted');
    setHasPrompted(prompted === 'true');

    // Show prompt after a short delay if notifications are supported and not yet configured
    if (isSupported && permission === 'default' && !prompted && !subscription) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, subscription]);

  const handleEnable = async () => {
    try {
      const success = await requestPermission();
      if (success) {
        toast.success('Notifications push activées avec succès');
        localStorage.setItem('push_notifications_prompted', 'true');
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      toast.error('Erreur lors de l\'activation des notifications');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push_notifications_prompted', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || hasPrompted || !isSupported) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-5 duration-300">
      <Card className="shadow-lg border-border">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Notifications des messages</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Recevez des notifications instantanées pour les nouveaux messages
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={handleEnable} className="flex-1 gap-2">
            <Bell className="h-4 w-4" />
            Activer
          </Button>
          <Button onClick={handleDismiss} variant="outline" className="flex-1 gap-2">
            <BellOff className="h-4 w-4" />
            Plus tard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}