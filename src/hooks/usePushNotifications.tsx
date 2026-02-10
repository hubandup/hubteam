import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Check if app is running as PWA
function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isPWAMode, setIsPWAMode] = useState(false);

  useEffect(() => {
    const pwaMode = isPWA();
    setIsPWAMode(pwaMode);
    
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check for existing subscription
      navigator.serviceWorker.ready.then(async (registration) => {
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          setSubscription(existingSubscription);
        }
      });
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Les notifications push ne sont pas supportées sur cet appareil');
      return false;
    }

    // Warn if not in PWA mode
    if (!isPWAMode) {
      toast.info('Pour une meilleure expérience, installez l\'application sur votre écran d\'accueil');
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        await subscribeToPush();
        toast.success('Notifications activées avec succès');
        return true;
      } else {
        toast.error('Permission refusée pour les notifications');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Erreur lors de l\'activation des notifications');
      return false;
    }
  };

  const subscribeToPush = async () => {
    try {
      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      
      let vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VITE_VAPID_PUBLIC_KEY manquante, tentative de récupération depuis le backend...');
        const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
        if (error || !data?.publicKey) {
          throw new Error('Clé VAPID non configurée. Ajoutez VITE_VAPID_PUBLIC_KEY ou exposez-la via la fonction get-vapid-public-key.');
        }
        vapidPublicKey = data.publicKey as string;
      }

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      setSubscription(subscription);

      // Save subscription via API endpoint
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const subscriptionData = subscription.toJSON();
        
        const { error } = await supabase.functions.invoke('push-subscribe', {
          body: {
            subscription: {
              endpoint: subscriptionData.endpoint,
              keys: {
                p256dh: subscriptionData.keys?.p256dh || '',
                auth: subscriptionData.keys?.auth || '',
              }
            }
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (error) {
          console.error('Error saving subscription:', error);
          throw error;
        }
      }

      return subscription;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      throw error;
    }
  };

  const unsubscribe = async () => {
    if (subscription) {
      try {
        await subscription.unsubscribe();
        setSubscription(null);
        toast.success('Notifications désactivées');
      } catch (error) {
        console.error('Error unsubscribing:', error);
        toast.error('Erreur lors de la désactivation');
      }
    }
  };

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    unsubscribe,
    isPWAMode,
  };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
