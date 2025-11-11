type UserRole = 'admin' | 'team' | 'client' | 'agency';

interface RoleConfig {
  label: string;
  variant: 'admin' | 'team' | 'client' | 'agency';
  description: string;
}

const roleConfigurations: Record<UserRole, RoleConfig> = {
  admin: {
    label: 'Administrateur',
    variant: 'admin',
    description: 'Accès complet à toutes les fonctionnalités',
  },
  team: {
    label: 'Équipe',
    variant: 'team',
    description: 'Accès en lecture et écriture sur la plupart des modules',
  },
  client: {
    label: 'Client',
    variant: 'client',
    description: 'Accès en lecture à vos données uniquement',
  },
  agency: {
    label: 'Agence',
    variant: 'agency',
    description: 'Accès à vos clients et projets rattachés',
  },
};

export function useRoleConfig() {
  const getRoleConfig = (role: UserRole | string | null): RoleConfig | null => {
    if (!role || !(role in roleConfigurations)) {
      return null;
    }
    return roleConfigurations[role as UserRole];
  };

  const getRoleLabel = (role: UserRole | string | null): string => {
    const config = getRoleConfig(role);
    return config?.label || 'Rôle inconnu';
  };

  const getRoleDescription = (role: UserRole | string | null): string => {
    const config = getRoleConfig(role);
    return config?.description || 'Accès personnalisé';
  };

  const getRoleVariant = (role: UserRole | string | null): 'admin' | 'team' | 'client' | 'agency' | 'outline' => {
    const config = getRoleConfig(role);
    return config?.variant || 'outline';
  };

  const getAllRoles = (): Array<{ value: UserRole; label: string; description: string }> => {
    return Object.entries(roleConfigurations).map(([value, config]) => ({
      value: value as UserRole,
      label: config.label,
      description: config.description,
    }));
  };

  return {
    getRoleConfig,
    getRoleLabel,
    getRoleDescription,
    getRoleVariant,
    getAllRoles,
    roleConfigurations,
  };
}

export type { UserRole, RoleConfig };
