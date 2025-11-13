import { useUserRole } from '@/hooks/useUserRole';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { User, Lock, Users, Shield, Database, Bell, Palette, HelpCircle } from 'lucide-react';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { NotificationPreferencesTab } from '@/components/settings/NotificationPreferencesTab';
import { UsersTab } from '@/components/settings/UsersTab';
import { PermissionsTab } from '@/components/settings/PermissionsTab';
import { DataManagementTab } from '@/components/settings/DataManagementTab';
import { DesignTab } from '@/components/settings/DesignTab';
import { FaqCategoriesTab } from '@/components/settings/FaqCategoriesTab';

export default function Settings() {
  const { isAdmin } = useUserRole();

  const baseTabs: TabItem[] = [
    {
      value: 'profile',
      label: 'Mon profil',
      icon: <User className="h-4 w-4" />,
      content: <ProfileTab />
    },
    {
      value: 'security',
      label: 'Sécurité',
      icon: <Lock className="h-4 w-4" />,
      content: <SecurityTab />
    },
    {
      value: 'notifications',
      label: 'Notifications',
      icon: <Bell className="h-4 w-4" />,
      content: <NotificationPreferencesTab />
    }
  ];

  const adminTabs: TabItem[] = isAdmin ? [
    {
      value: 'users',
      label: 'Utilisateurs',
      icon: <Users className="h-4 w-4" />,
      content: <UsersTab />
    },
    {
      value: 'permissions',
      label: 'Permissions',
      icon: <Shield className="h-4 w-4" />,
      content: <PermissionsTab />
    },
    {
      value: 'data',
      label: 'Données',
      icon: <Database className="h-4 w-4" />,
      content: <DataManagementTab />
    },
    {
      value: 'design',
      label: 'Design',
      icon: <Palette className="h-4 w-4" />,
      content: <DesignTab />
    },
    {
      value: 'faq',
      label: 'FAQ',
      icon: <HelpCircle className="h-4 w-4" />,
      content: <FaqCategoriesTab />
    }
  ] : [];

  const allTabs = [...baseTabs, ...adminTabs];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Gérez les utilisateurs et vos informations personnelles' : 'Gérez vos informations personnelles'}
        </p>
      </div>

      <ResponsiveTabs defaultValue="profile" tabs={allTabs} storageKey="settings-tabs" />
    </div>
  );
}
