import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { t } = useTranslation();

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="bg-destructive text-destructive-foreground text-center text-xs py-1.5 px-4 flex items-center justify-center gap-2"
    >
      <WifiOff className="h-3.5 w-3.5" />
      {t('common.offline', 'Vous êtes hors connexion. Certaines fonctionnalités peuvent être limitées.')}
    </div>
  );
}
