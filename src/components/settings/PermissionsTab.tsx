import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Save, Loader2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';

type UserRole = 'admin' | 'team' | 'client' | 'agency';
type AppModule = 
  | 'dashboard' 
  | 'crm' 
  | 'agencies' 
  | 'projects' 
  | 'tasks' 
  | 'settings' 
  | 'settings_profile'
  | 'settings_security'
  | 'settings_notifications'
  | 'settings_users'
  | 'settings_permissions'
  | 'settings_data'
  | 'settings_design'
  | 'settings_faq'
  | 'faq' 
  | 'messages';
type PermissionAction = 'read' | 'create' | 'update' | 'delete';
type PermissionScope = 'all' | 'limited' | 'own';

interface Permission {
  role: UserRole;
  module: AppModule;
  action: PermissionAction;
  scope: PermissionScope;
}

// Module groups with scope support
const moduleGroups = [
  {
    title: 'Tableau de bord',
    modules: [
      { value: 'dashboard' as AppModule, label: 'Dashboard', hasScope: false, scopeOptions: [] as PermissionScope[] },
    ]
  },
  {
    title: 'CRM',
    modules: [
      { value: 'crm' as AppModule, label: 'CRM', hasScope: true, scopeOptions: ['all', 'limited'] as PermissionScope[] },
    ]
  },
  {
    title: 'Agences',
    modules: [
      { value: 'agencies' as AppModule, label: 'Agences', hasScope: true, scopeOptions: ['all', 'limited'] as PermissionScope[] },
    ]
  },
  {
    title: 'Projets',
    modules: [
      { value: 'projects' as AppModule, label: 'Projets', hasScope: true, scopeOptions: ['all', 'limited'] as PermissionScope[] },
      { value: 'tasks' as AppModule, label: 'Tâches', hasScope: true, scopeOptions: ['all', 'limited'] as PermissionScope[] },
    ]
  },
  {
    title: 'FAQ',
    modules: [
      { value: 'faq' as AppModule, label: 'FAQ', hasScope: true, scopeOptions: ['all', 'limited'] as PermissionScope[] },
    ]
  },
  {
    title: 'Messagerie',
    modules: [
      { value: 'messages' as AppModule, label: 'Messages', hasScope: false, scopeOptions: [] as PermissionScope[] },
    ]
  },
  {
    title: 'Activité',
    modules: [
      { value: 'settings' as AppModule, label: 'Journal d\'activité', hasScope: false, scopeOptions: [] as PermissionScope[], actionsOnly: ['read'] },
    ]
  },
  {
    title: 'Paramètres',
    modules: [
      { value: 'settings_profile' as AppModule, label: 'Profil', hasScope: false, scopeOptions: [] as PermissionScope[] },
      { value: 'settings_security' as AppModule, label: 'Sécurité', hasScope: false, scopeOptions: [] as PermissionScope[] },
      { value: 'settings_notifications' as AppModule, label: 'Notifications', hasScope: false, scopeOptions: [] as PermissionScope[] },
      { value: 'settings_users' as AppModule, label: 'Utilisateurs', hasScope: false, scopeOptions: [] as PermissionScope[] },
      { value: 'settings_permissions' as AppModule, label: 'Permissions', hasScope: false, scopeOptions: [] as PermissionScope[] },
      { value: 'settings_data' as AppModule, label: 'Données', hasScope: false, scopeOptions: [] as PermissionScope[] },
      { value: 'settings_design' as AppModule, label: 'Design', hasScope: false, scopeOptions: [] as PermissionScope[] },
      { value: 'settings_faq' as AppModule, label: 'FAQ Admin', hasScope: false, scopeOptions: [] as PermissionScope[] },
    ]
  },
];

const actions = [
  { value: 'read' as PermissionAction, label: 'Lecture' },
  { value: 'create' as PermissionAction, label: 'Création' },
  { value: 'update' as PermissionAction, label: 'Modification' },
  { value: 'delete' as PermissionAction, label: 'Suppression' },
];

const scopeLabels: Record<PermissionScope, string> = {
  all: 'Tout',
  limited: 'Limité',
  own: 'Personnel',
};

const roles = [
  { value: 'admin' as UserRole, label: 'Administrateur', variant: 'default' as const },
  { value: 'team' as UserRole, label: 'Équipe', variant: 'secondary' as const },
  { value: 'client' as UserRole, label: 'Client', variant: 'default' as const },
  { value: 'agency' as UserRole, label: 'Agence', variant: 'secondary' as const },
];

export function PermissionsTab() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, [selectedRole]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, module, action, scope')
        .eq('role', selectedRole);

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Impossible de charger les permissions');
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (module: AppModule, action: PermissionAction, scope: PermissionScope): boolean => {
    return permissions.some(p => p.module === module && p.action === action && p.scope === scope);
  };

  const getModuleScope = (module: AppModule): PermissionScope => {
    const perm = permissions.find(p => p.module === module);
    return perm?.scope || 'all';
  };

  const setModuleScope = (module: AppModule, newScope: PermissionScope) => {
    // Update scope for all actions of this module
    setPermissions(prev => prev.map(p => 
      p.module === module ? { ...p, scope: newScope } : p
    ));
  };

  const togglePermission = (module: AppModule, action: PermissionAction, scope: PermissionScope) => {
    const exists = hasPermission(module, action, scope);
    
    if (exists) {
      setPermissions(prev => prev.filter(p => !(p.module === module && p.action === action && p.scope === scope)));
    } else {
      setPermissions(prev => [...prev, { role: selectedRole, module, action, scope }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing permissions for this role
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role', selectedRole);

      if (deleteError) throw deleteError;

      // Insert new permissions with scope
      if (permissions.length > 0) {
        const permissionsToInsert = permissions.map(p => ({
          role: p.role,
          module: p.module,
          action: p.action,
          scope: p.scope || 'all',
        }));

        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
      }

      toast.success('Permissions enregistrées avec succès');
      await fetchPermissions();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Erreur lors de l\'enregistrement des permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Gestion des permissions
        </CardTitle>
        <CardDescription>
          Configurez les droits d'accès avec portée (tout / limité) pour chaque module
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Rôle à configurer</Label>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  <div className="flex items-center gap-2">
                    <Badge variant={role.variant}>{role.label}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-8">
          {moduleGroups.map((group) => (
            <div key={group.title} className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">{group.title}</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {group.modules.map((module) => {
                  const currentScope = getModuleScope(module.value);
                  const allowedActions = module.actionsOnly || actions.map(a => a.value);
                  
                  return (
                    <Card key={module.value} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-medium">{module.label}</Label>
                          
                          {module.hasScope && module.scopeOptions.length > 0 && (
                            <ToggleGroup 
                              type="single" 
                              value={currentScope}
                              onValueChange={(value) => value && setModuleScope(module.value, value as PermissionScope)}
                              className="bg-muted/50 rounded-md p-1"
                            >
                              {module.scopeOptions.map((scope) => (
                                <ToggleGroupItem 
                                  key={scope} 
                                  value={scope}
                                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                >
                                  {scopeLabels[scope]}
                                </ToggleGroupItem>
                              ))}
                            </ToggleGroup>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {actions
                            .filter(action => allowedActions.includes(action.value))
                            .map((action) => (
                              <div key={action.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${module.value}-${action.value}-${currentScope}`}
                                  checked={hasPermission(module.value, action.value, currentScope)}
                                  onCheckedChange={() => togglePermission(module.value, action.value, currentScope)}
                                />
                                <Label 
                                  htmlFor={`${module.value}-${action.value}-${currentScope}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {action.label}
                                </Label>
                              </div>
                            ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={saving} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Enregistrement...' : 'Enregistrer les permissions'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}