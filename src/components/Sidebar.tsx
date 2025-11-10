import { LayoutDashboard, FolderKanban, Settings, LogOut, Building2, Users, ListTodo } from 'lucide-react';
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
} from '@/components/ui/sidebar';
import { Button } from './ui/button';

export function Sidebar() {
  const { signOut } = useAuth();
  const { role } = useUserRole();
  const { canRead } = usePermissions();

  const mainItems = [
    { title: 'Tableau de bord', url: '/', icon: LayoutDashboard, module: 'dashboard' as const },
    { title: 'CRM', url: '/crm', icon: Users, module: 'crm' as const },
    { title: 'Agences', url: '/agencies', icon: Building2, module: 'agencies' as const },
    { title: 'Projets', url: '/projects', icon: FolderKanban, module: 'projects' as const },
  ];

  const showSettings = role === 'admin' || role === 'team';

  return (
    <ShadcnSidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold text-primary">HubTeam</SidebarGroupLabel>
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
