import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Eye, Plus, Edit, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const roleConfig = {
  admin: { 
    label: 'Administrateur', 
    variant: 'default' as const,
    description: 'Accès complet à toutes les fonctionnalités'
  },
  team: { 
    label: 'Équipe', 
    variant: 'secondary' as const,
    description: 'Accès en lecture et écriture sur la plupart des modules'
  },
  client: { 
    label: 'Client', 
    variant: 'outline' as const,
    description: 'Accès en lecture à vos données uniquement'
  },
  agency: { 
    label: 'Agence', 
    variant: 'outline' as const,
    description: 'Accès à vos clients et projets rattachés'
  },
};

const moduleLabels = {
  dashboard: 'Tableau de bord',
  crm: 'CRM',
  agencies: 'Agences',
  projects: 'Projets',
  tasks: 'Tâches',
  settings: 'Paramètres',
};

const actionIcons = {
  read: Eye,
  create: Plus,
  update: Edit,
  delete: Trash2,
};

const actionLabels = {
  read: 'Lecture',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
};

export function RolePermissionsIndicator() {
  const { role, loading: roleLoading } = useUserRole();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);

  if (roleLoading || permissionsLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardHeader>
      </Card>
    );
  }

  if (!role) {
    return null;
  }

  const config = roleConfig[role];
  
  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm.action);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Votre profil utilisateur
            </CardTitle>
            <CardDescription className="text-sm">
              {config.description}
            </CardDescription>
          </div>
          <Badge variant={config.variant} className="text-sm px-3 py-1">
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {Object.keys(permissionsByModule).length} modules accessibles
            </p>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <span className="text-sm mr-1">
                  {isOpen ? 'Masquer' : 'Voir'} les permissions
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-4 space-y-3">
            {Object.entries(permissionsByModule).map(([module, actions]) => (
              <div 
                key={module} 
                className="rounded-lg border bg-background/50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    {moduleLabels[module as keyof typeof moduleLabels] || module}
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    {actions.length} {actions.length > 1 ? 'actions' : 'action'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => {
                    const Icon = actionIcons[action as keyof typeof actionIcons];
                    return (
                      <div
                        key={action}
                        className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-md"
                      >
                        {Icon && <Icon className="h-3 w-3" />}
                        <span>{actionLabels[action as keyof typeof actionLabels] || action}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {Object.keys(moduleLabels).filter(m => !permissionsByModule[m]).length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Modules non accessibles
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(moduleLabels)
                    .filter(m => !permissionsByModule[m])
                    .map(module => (
                      <Badge key={module} variant="outline" className="text-xs opacity-50">
                        {moduleLabels[module as keyof typeof moduleLabels]}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
