import { Badge, Bell, Smartphone } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function AppBadgeInfo() {
  const isSupported = 'setAppBadge' in navigator;
  
  if (!isSupported) {
    return (
      <Alert className="mb-4">
        <Smartphone className="h-4 w-4" />
        <AlertTitle>Badge de notification</AlertTitle>
        <AlertDescription>
          Les badges de notification sur l'icône de l'app ne sont pas supportés sur cet appareil.
          <br />
          <span className="text-xs text-muted-foreground mt-2 block">
            Supporté sur : Chrome/Edge sur Android et desktop
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4">
      <Badge className="h-4 w-4" />
      <AlertTitle>Badge de notification activé</AlertTitle>
      <AlertDescription>
        Le nombre de notifications non lues s'affichera sur l'icône de l'application installée.
        <br />
        <span className="text-xs text-muted-foreground mt-2 block">
          Assurez-vous d'avoir installé l'app sur votre appareil et d'avoir activé les notifications push.
        </span>
      </AlertDescription>
    </Alert>
  );
}
