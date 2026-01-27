import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationSettings, NOTIFICATION_TYPES, NotificationType } from '@/hooks/useNotificationSettings';
import { toast } from 'sonner';
import { Loader2, Bell, Smartphone, BellRing, Mail, Lock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AdminNotificationSettings } from './AdminNotificationSettings';

export function NotificationPreferencesTab() {
  const { user } = useAuth();
  const [testingSending, setTestingSending] = useState(false);

  const { 
    isSupported, 
    permission, 
    subscription, 
    requestPermission, 
    unsubscribe,
    isPWAMode 
  } = usePushNotifications();

  const {
    userPreferences,
    loading,
    saving,
    updateUserPreference,
    isNotificationEnabled,
    isForceEmail,
    isAdmin,
    userRole,
  } = useNotificationSettings();

  const handlePushToggle = async () => {
    if (subscription) {
      await unsubscribe();
    } else {
      await requestPermission();
    }
  };

  const testPushNotification = async () => {
    setTestingSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      const { error } = await supabase.functions.invoke('push-test', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      toast.success('Notification de test envoyée');
    } catch (error) {
      console.error('Error testing push:', error);
      toast.error('Erreur lors du test');
    } finally {
      setTestingSending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Check if user is a client (limited notifications)
  const isClient = userRole === 'client';

  return (
    <div className="space-y-6">
      {/* Admin Governance Section */}
      {isAdmin && <AdminNotificationSettings />}

      {/* Push Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Notifications Push (PWA)
          </CardTitle>
          <CardDescription>
            Recevez des notifications instantanées sur votre appareil, même lorsque l'application est fermée
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <div className="p-4 rounded-lg border bg-muted/50 text-muted-foreground">
              <p className="text-sm">
                Les notifications push ne sont pas supportées sur ce navigateur.
                Pour les activer, installez l'application sur votre écran d'accueil.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border bg-card">
                <div className="flex items-start gap-3 flex-1">
                  <BellRing className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">
                      Notifications push
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {permission === 'denied' 
                        ? 'Permission refusée. Modifiez les paramètres de votre navigateur.'
                        : subscription 
                          ? 'Notifications activées sur cet appareil'
                          : 'Activez pour recevoir des notifications instantanées'}
                    </p>
                    {!isPWAMode && permission !== 'denied' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Pour une meilleure expérience, installez l'app sur votre écran d'accueil
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={!!subscription}
                  onCheckedChange={handlePushToggle}
                  disabled={permission === 'denied'}
                />
              </div>

              {subscription && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testPushNotification}
                  disabled={testingSending}
                  className="w-full"
                >
                  {testingSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4 mr-2" />
                  )}
                  Envoyer une notification de test
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Client Role Notice */}
      {isClient && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Notifications limitées
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                En tant que client, vous recevez uniquement les notifications pour les projets qui vous sont attribués et les messages directs.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Notification Preferences Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Préférences de notifications
          </CardTitle>
          <CardDescription>
            Personnalisez vos notifications par type et par canal (push/email)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIFICATION_TYPES.map(({ type, label, description }) => {
            const enabled = isNotificationEnabled(type);
            const forceEmail = isForceEmail(type);
            const prefs = userPreferences[type] || { push: true, email: false };
            const isMessage = type === 'message';
            
            // Don't show disabled notifications for clients
            if (isClient && !enabled) return null;
            
            return (
              <div 
                key={type}
                className={`p-4 rounded-lg border bg-card ${!enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">{label}</Label>
                      {!enabled && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Désactivé
                        </Badge>
                      )}
                      {forceEmail && (
                        <Badge variant="default" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          Email obligatoire
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  
                  {enabled && (
                    <div className="flex items-center gap-4">
                      {/* Push toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={prefs.push}
                          onCheckedChange={(checked) => 
                            updateUserPreference(type as NotificationType, 'push', checked)
                          }
                          disabled={saving || isMessage}
                        />
                        <span className="text-xs text-muted-foreground">Push</span>
                      </div>
                      
                      {/* Email toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={prefs.email || forceEmail}
                          onCheckedChange={(checked) => 
                            updateUserPreference(type as NotificationType, 'email', checked)
                          }
                          disabled={saving || forceEmail}
                        />
                        <span className="text-xs text-muted-foreground">Email</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
