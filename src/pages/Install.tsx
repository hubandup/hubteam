import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, Smartphone, Zap, Wifi, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Install() {
  const { isInstallable, promptInstall } = usePWAInstall();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-3">
            <Smartphone className="h-8 w-8 text-primary" />
            Installer HubTeam
          </CardTitle>
          <CardDescription>
            Installez l'application sur votre appareil pour une meilleure expérience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Accès rapide</h3>
                <p className="text-sm text-muted-foreground">
                  Lancez l'application directement depuis votre écran d'accueil
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Wifi className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Mode hors ligne</h3>
                <p className="text-sm text-muted-foreground">
                  Consultez vos données même sans connexion internet
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Notifications push avec badge</h3>
                <p className="text-sm text-muted-foreground">
                  Recevez des alertes en temps réel avec le nombre de notifications non lues affiché directement sur l'icône de l'app
                </p>
              </div>
            </div>
          </div>

          {isInstallable ? (
            <Button onClick={promptInstall} className="w-full" size="lg">
              <Download className="h-5 w-5 mr-2" />
              Installer l'application
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Sur iPhone/iPad :</strong> Appuyez sur le bouton de partage{' '}
                  <span className="inline-block">📤</span> puis "Sur l'écran d'accueil"
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Sur Android :</strong> Ouvrez le menu du navigateur (⋮) puis 
                  "Installer l'application" ou "Ajouter à l'écran d'accueil"
                </p>
              </div>
            </div>
          )}

          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')} 
            className="w-full"
          >
            Continuer dans le navigateur
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
