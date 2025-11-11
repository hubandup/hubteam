import { Badge } from '@/components/ui/badge';

type UserRole = 'admin' | 'team' | 'client' | 'agency';

interface RoleBadgeProps {
  role: UserRole | null | string;
  className?: string;
}

const roleConfig: Record<UserRole, { label: string; variant: 'admin' | 'team' | 'client' | 'agency' }> = {
  admin: { label: 'Administrateur', variant: 'admin' },
  team: { label: 'Équipe', variant: 'team' },
  client: { label: 'Client', variant: 'client' },
  agency: { label: 'Agence', variant: 'agency' },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  if (!role) {
    return <Badge variant="outline" className={className}>Aucun rôle</Badge>;
  }

  const config = roleConfig[role as UserRole];
  
  if (!config) {
    return <Badge variant="outline" className={className}>Rôle inconnu</Badge>;
  }

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

// Export role configuration for components that need it
export { roleConfig };
