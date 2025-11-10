import { LayoutDashboard, FolderKanban, Settings, LogOut, Building2, Users, ListTodo, MessageSquare, History } from 'lucide-react';
import { NavLink } from './NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from './ui/button';
import { NotificationBell } from './notifications/NotificationBell';
import logo from '@/assets/logo-hubandup.svg';

export function Sidebar() {
  const { signOut } = useAuth();
  const { role } = useUserRole();
  const { canRead } = usePermissions();

  const mainItems = [
    { title: 'Tableau de bord', url: '/', icon: LayoutDashboard, module: 'dashboard' as const },
    { title: 'CRM', url: '/crm', icon: Users, module: 'crm' as const },
    { title: 'Agences', url: '/agencies', icon: Building2, module: 'agencies' as const },
    { title: 'Projets', url: '/projects', icon: FolderKanban, module: 'projects' as const },
    { title: 'Messages', url: '/messages', icon: MessageSquare, module: 'dashboard' as const },
    { title: 'Activité', url: '/activity', icon: History, module: 'dashboard' as const },
  ];

  const showSettings = role === 'admin' || role === 'team';

  return (
    <ShadcnSidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <img src={logo} alt="HubandUp" className="h-8" />
          <NotificationBell />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => 
                canRead(item.module) ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="hover:bg-muted/50" activeClassName="bg-primary/10 text-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null
              )}
              {showSettings && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/settings" className="hover:bg-muted/50" activeClassName="bg-primary/10 text-primary font-medium">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" onClick={signOut} className="w-full justify-start">
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
