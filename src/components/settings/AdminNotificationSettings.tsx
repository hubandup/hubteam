import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useNotificationSettings, NOTIFICATION_TYPES, ROLES, AppRole, NotificationType, CLIENT_ALLOWED_TYPES } from '@/hooks/useNotificationSettings';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AdminNotificationSettings() {
  const {
    globalPreferences,
    loading,
    saving,
    updateGlobalPreference,
    getGlobalPreference,
  } = useNotificationSettings();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Gouvernance des notifications
        </CardTitle>
        <CardDescription>
          Configurez les notifications par type et par rôle. Les règles définies ici s'appliquent à tous les utilisateurs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-success/50 bg-success/5">
          <ShieldCheck className="h-4 w-4 text-success" />
          <AlertDescription>
            <strong>Architecture sécurisée :</strong> Les notifications sont traitées via une file d'attente asynchrone. 
            Aucun secret n'est stocké en base de données.
          </AlertDescription>
        </Alert>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Type</TableHead>
                {ROLES.map(({ role, label }) => (
                  <TableHead key={role} className="text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{label}</span>
                      {role === 'client' && (
                        <Badge variant="outline" className="text-xs">Restreint</Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {NOTIFICATION_TYPES.map(({ type, label, description }) => (
                <TableRow key={type}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </TableCell>
                  {ROLES.map(({ role }) => {
                    const pref = getGlobalPreference(role, type);
                    const isMessage = type === 'message';
                    const isClientRestricted = role === 'client' && !CLIENT_ALLOWED_TYPES.includes(type);
                    const isClientForced = role === 'client' && CLIENT_ALLOWED_TYPES.includes(type);
                    
                    return (
                      <TableCell key={role} className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={isClientRestricted ? false : (pref?.enabled ?? true)}
                                    onCheckedChange={(checked) =>
                                      updateGlobalPreference(role, type, 'enabled', checked)
                                    }
                                    disabled={saving || isMessage || isClientRestricted}
                                  />
                                  {(isMessage || isClientRestricted) && (
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isMessage 
                                  ? 'Les messages ne peuvent pas être désactivés'
                                  : isClientRestricted
                                    ? 'Les clients ne reçoivent pas ce type de notification'
                                    : pref?.enabled ? 'Activé' : 'Désactivé'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {(pref?.enabled ?? true) && !isClientRestricted && (
                            isClientForced ? (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                                <Mail className="h-3 w-3" />
                                <Lock className="h-3 w-3" />
                                Forcé
                              </div>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() =>
                                        updateGlobalPreference(role, type, 'force_email', !(pref?.force_email ?? false))
                                      }
                                      disabled={saving}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                                        pref?.force_email
                                          ? 'bg-primary/10 text-primary'
                                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                      }`}
                                    >
                                      <Mail className="h-3 w-3" />
                                      Email
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {pref?.force_email
                                      ? 'Email obligatoire pour ce rôle'
                                      : 'Cliquez pour forcer l\'email'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 space-y-2">
          <h4 className="font-medium text-sm">Légende</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Switch checked disabled className="scale-75" />
              <span>Notification activée</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-3 w-3" />
              <span>Non modifiable (règle système)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                <Mail className="h-3 w-3" />
                Email
              </div>
              <span>Email obligatoire</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Restreint</Badge>
              <span>Notifications limitées pour ce rôle</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
