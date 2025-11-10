import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Shield, Loader2, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UserRole = 'admin' | 'team' | 'client' | 'agency';
type AppModule = 'dashboard' | 'crm' | 'agencies' | 'projects' | 'tasks' | 'settings';
type PermissionAction = 'read' | 'create' | 'update' | 'delete';

interface Permission {
  role: UserRole;
  module: AppModule;
  action: PermissionAction;
}

const modules: { id: AppModule; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'crm', label: 'CRM' },
  { id: 'agencies', label: 'Agences' },
  { id: 'projects', label: 'Projets' },
  { id: 'tasks', label: 'Tâches' },
  { id: 'settings', label: 'Paramètres' },
];

const actions: { id: PermissionAction; label: string }[] = [
  { id: 'read', label: 'Lecture' },
  { id: 'create', label: 'Création' },
  { id: 'update', label: 'Modification' },
  { id: 'delete', label: 'Suppression' },
];

const roles: { id: UserRole; label: string; variant: 'default' | 'secondary' | 'outline' }[] = [
  { id: 'admin', label: 'Administrateur', variant: 'default' },
  { id: 'team', label: 'Équipe', variant: 'secondary' },
  { id: 'client', label: 'Client', variant: 'outline' },
  { id: 'agency', label: 'Agence', variant: 'outline' },
];

export function PermissionsTab() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, module, action');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des permissions');
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (role: UserRole, module: AppModule, action: PermissionAction): boolean => {
    return permissions.some(p => p.role === role && p.module === module && p.action === action);
  };

  const togglePermission = (module: AppModule, action: PermissionAction) => {
    const exists = hasPermission(selectedRole, module, action);
    
    if (exists) {
      setPermissions(prev => 
        prev.filter(p => !(p.role === selectedRole && p.module === module && p.action === action))
      );
    } else {
      setPermissions(prev => [...prev, { role: selectedRole, module, action }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing permissions for the selected role
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role', selectedRole);

      if (deleteError) throw deleteError;

      // Insert new permissions for the selected role
      const rolePermissions = permissions.filter(p => p.role === selectedRole);
      
      if (rolePermissions.length > 0) {
        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (insertError) throw insertError;
      }

      toast.success('Permissions mises à jour avec succès');
      await fetchPermissions();
    } catch (error: any) {
      toast.error('Erreur lors de la sauvegarde des permissions');
      console.error('Error saving permissions:', error);
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion des permissions
          </CardTitle>
          <CardDescription>
            Définissez précisément les droits de chaque rôle par module et action
          </CardDescription>
        </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Selector */}
        <div className="space-y-2">
          <Label htmlFor="role-select">Rôle à configurer</Label>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
            <SelectTrigger id="role-select" className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <Badge variant={role.variant}>{role.label}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Permissions Grid */}
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">Module</th>
                  {actions.map((action) => (
                    <th key={action.id} className="p-4 text-center font-medium">
                      {action.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module, idx) => (
                  <tr
                    key={module.id}
                    className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                  >
                    <td className="p-4 font-medium">{module.label}</td>
                    {actions.map((action) => (
                      <td key={action.id} className="p-4 text-center">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={hasPermission(selectedRole, module.id, action.id)}
                            onCheckedChange={() => togglePermission(module.id, action.id)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Les modifications prendront effet immédiatement pour tous les utilisateurs ayant ce rôle
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
