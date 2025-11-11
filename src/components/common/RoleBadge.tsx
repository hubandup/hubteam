import { Badge } from '@/components/ui/badge';
import { useRoleConfig } from '@/hooks/useRoleConfig';

interface RoleBadgeProps {
  role: string | null;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const { getRoleLabel, getRoleVariant } = useRoleConfig();

  if (!role) {
    return <Badge variant="outline" className={className}>Aucun rôle</Badge>;
  }

  const label = getRoleLabel(role);
  const variant = getRoleVariant(role);

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
