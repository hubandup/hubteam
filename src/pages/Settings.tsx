import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Gérez les utilisateurs et vos informations personnelles' : 'Gérez vos informations personnelles'}
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="profile" className="flex items-center gap-2 whitespace-nowrap">
              <User className="h-4 w-4" />
              Mon profil
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 whitespace-nowrap">
              <Lock className="h-4 w-4" />
              Sécurité
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 whitespace-nowrap">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="users" className="flex items-center gap-2 whitespace-nowrap">
                  <Users className="h-4 w-4" />
                  Utilisateurs
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex items-center gap-2 whitespace-nowrap">
                  <Shield className="h-4 w-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger value="data" className="flex items-center gap-2 whitespace-nowrap">
                  <Database className="h-4 w-4" />
                  Données
                </TabsTrigger>
                <TabsTrigger value="design" className="flex items-center gap-2 whitespace-nowrap">
                  <Palette className="h-4 w-4" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="faq" className="flex items-center gap-2 whitespace-nowrap">
                  <HelpCircle className="h-4 w-4" />
                  FAQ
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationPreferencesTab />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="users" className="mt-6">
              <UsersTab />
            </TabsContent>
            
            <TabsContent value="permissions" className="mt-6">
              <PermissionsTab />
            </TabsContent>

            <TabsContent value="data" className="mt-6">
              <DataManagementTab />
            </TabsContent>

            <TabsContent value="design" className="mt-6">
              <DesignTab />
            </TabsContent>

            <TabsContent value="faq" className="mt-6">
              <FaqCategoriesTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
