import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check for existing subscription
      navigator.serviceWorker.ready.then(async (registration) => {
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          setSubscription(existingSubscription);
          console.log('Found existing push subscription');
        }
      });
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Les notifications push ne sont pas supportées sur cet appareil');
      return false;
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
      console.log('Service Worker is ready:', registration);
      
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID_PUBLIC_KEY non configurée');
      }

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
        console.log('New push subscription created');
      } else {
        console.log('Already subscribed to push notifications');
      }

      setSubscription(subscription);

      // Save subscription to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const subscriptionData = subscription.toJSON();
        // @ts-ignore - Types will be regenerated automatically
        const { error } = await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subscriptionData.endpoint,
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
        }, {
          onConflict: 'user_id,endpoint'
        });
        
        if (error) {
          console.error('Error saving subscription:', error);
          throw error;
        }
        
        console.log('Subscription saved to database');
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
