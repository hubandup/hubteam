import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';

const BANNER_DISMISSED_KEY = 'pwa-install-banner-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PWAInstallBanner() {
  const { isInstallable, promptInstall } = usePWAInstall();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone;
    
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Check iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOSDevice(isIOS);

    // Check if banner was dismissed recently
    const dismissedAt = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        return;
      }
    }

    // Show banner on mobile (either installable or iOS)
    if (isMobile && (isInstallable || isIOS)) {
      // Delay showing banner for better UX
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, isInstallable]);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, Date.now().toString());
    setIsVisible(false);
  };

  const handleInstall = async () => {
    if (isInstallable) {
      await promptInstall();
      setIsVisible(false);
    } else if (isIOSDevice) {
      // Can't programmatically install on iOS, show instructions
      window.location.href = '/install';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground rounded-xl p-4 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-foreground/20 rounded-lg shrink-0">
            <Smartphone className="h-6 w-6" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Installer Hub & Up</h3>
            <p className="text-xs opacity-90 mt-0.5">
              {isIOSDevice 
                ? "Ajoutez l'app sur votre écran d'accueil"
                : "Accédez rapidement depuis votre écran d'accueil"
              }
            </p>
          </div>
          
          <Button
            onClick={handleInstall}
            size="sm"
            variant="secondary"
            className="shrink-0"
          >
            <Download className="h-4 w-4 mr-1" />
            {isIOSDevice ? "Voir" : "Installer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
