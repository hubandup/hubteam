import { useUserRole } from '@/hooks/useUserRole';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { User, Lock, Users, Shield, Database, Bell, Palette, HelpCircle, Tag, Mail, BarChart3 } from 'lucide-react';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { NotificationPreferencesTab } from '@/components/settings/NotificationPreferencesTab';
import { UsersTab } from '@/components/settings/UsersTab';
import { PermissionsTab } from '@/components/settings/PermissionsTab';
import { DataManagementTab } from '@/components/settings/DataManagementTab';
import { DesignTab } from '@/components/settings/DesignTab';
import { FaqCategoriesTab } from '@/components/settings/FaqCategoriesTab';
import { AgencyTagsTab } from '@/components/settings/AgencyTagsTab';
import { TestInvitationEmail } from '@/components/settings/TestInvitationEmail';
import { LagostinaAccessTab } from '@/components/settings/LagostinaAccessTab';
import { BrisachAccessTab } from '@/components/settings/BrisachAccessTab';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { isAdmin } = useUserRole();
  const { t } = useTranslation();

  const baseTabs: TabItem[] = [
    {
      value: 'profile',
      label: t('settings.tabs.profile'),
      icon: <User className="h-4 w-4" />,
      content: <ProfileTab />
    },
    {
      value: 'security',
      label: t('settings.tabs.security'),
      icon: <Lock className="h-4 w-4" />,
      content: <SecurityTab />
    },
    {
      value: 'notifications',
      label: t('settings.tabs.notifications'),
      icon: <Bell className="h-4 w-4" />,
      content: <NotificationPreferencesTab />
    }
  ];

  const adminTabs: TabItem[] = isAdmin ? [
    {
      value: 'users',
      label: t('settings.tabs.users'),
      icon: <Users className="h-4 w-4" />,
      content: <UsersTab />
    },
    {
      value: 'permissions',
      label: t('settings.tabs.permissions'),
      icon: <Shield className="h-4 w-4" />,
      content: <PermissionsTab />
    },
    {
      value: 'data',
      label: t('settings.tabs.data'),
      icon: <Database className="h-4 w-4" />,
      content: <DataManagementTab />
    },
    {
      value: 'design',
      label: t('settings.tabs.design'),
      icon: <Palette className="h-4 w-4" />,
      content: <DesignTab />
    },
    {
      value: 'faq',
      label: t('settings.tabs.faq'),
      icon: <HelpCircle className="h-4 w-4" />,
      content: <FaqCategoriesTab />
    },
    {
      value: 'agency-tags',
      label: t('settings.tabs.agencyTags'),
      icon: <Tag className="h-4 w-4" />,
      content: <AgencyTagsTab />
    },
    {
      value: 'test-email',
      label: t('settings.tabs.testEmail'),
      icon: <Mail className="h-4 w-4" />,
      content: <TestInvitationEmail />
    },
    {
      value: 'lagostina-access',
      label: 'Accès Lagostina',
      icon: <BarChart3 className="h-4 w-4" />,
      content: <LagostinaAccessTab />
    },
    {
      value: 'brisach-access',
      label: 'Accès Brisach',
      icon: <BarChart3 className="h-4 w-4" />,
      content: <BrisachAccessTab />
    }
  ] : [];

  const allTabs = [...baseTabs, ...adminTabs];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground">
          {isAdmin ? t('settings.subtitleAdmin') : t('settings.subtitleUser')}
        </p>
      </div>

      <ResponsiveTabs defaultValue="profile" tabs={allTabs} storageKey="settings-tabs" />
    </div>
  );
}
