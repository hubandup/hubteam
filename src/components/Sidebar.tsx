import { Home, LayoutDashboard, FolderKanban, Settings, LogOut, Building2, Users, ListTodo, MessageSquare, History, HelpCircle, Rss, Euro } from 'lucide-react';
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
import { ThemeToggle } from './ThemeToggle';
import logo from '@/assets/logo-hubandup.svg';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function Sidebar() {
  const { signOut, user } = useAuth();
  const { role } = useUserRole();
  const { canRead } = usePermissions();
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const fetchClientId = async () => {
      console.log('Sidebar - Role:', role, 'User:', user?.id);
      if (role === 'client' && user) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single();

          console.log('Sidebar - Profile:', profile, 'Error:', profileError);

          if (profile?.email) {
            const { data: client, error: clientError } = await supabase
              .from('clients')
              .select('id')
              .eq('email', profile.email)
              .single();

            console.log('Sidebar - Client:', client, 'Error:', clientError);

            if (client) {
              setClientId(client.id);
              console.log('Sidebar - Client ID set:', client.id);
            }
          }
        } catch (error) {
          console.error('Error fetching client ID:', error);
        }
      }
    };

    fetchClientId();
  }, [role, user]);

  const mainItems = [
    { title: 'Accueil', url: '/', icon: Home, module: 'dashboard' as const },
    ...(role === 'client' && clientId ? [{ title: 'Ma fiche client', url: `/client/${clientId}`, icon: Users, module: 'crm' as const, matchParent: true, isClientItem: true }] : []),
    { title: 'Feed', url: '/feed', icon: Rss, module: 'dashboard' as const },
    { title: 'Activité', url: '/dashboard', icon: LayoutDashboard, module: 'dashboard' as const },
    { title: 'Finances', url: '/finances', icon: Euro, module: 'dashboard' as const, adminOnly: true },
    { title: 'CRM', url: '/crm', icon: Users, module: 'crm' as const, matchParent: true },
    { title: 'Prospection', url: '/prospection', icon: ListTodo, module: 'crm' as const, hideForAgency: true },
    { title: 'Agences', url: '/agencies', icon: Building2, module: 'agencies' as const, matchParent: true },
    { title: 'Projets', url: '/projects', icon: FolderKanban, module: 'projects' as const, matchParent: true },
    { title: 'Messages', url: '/messages', icon: MessageSquare, module: 'messages' as const },
    { title: 'FAQ', url: '/faq', icon: HelpCircle, module: 'faq' as const },
  ];

  const showSettings = role === 'admin' || role === 'team' || role === 'agency';

  return (
    <ShadcnSidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4 bg-sidebar-background">
        <div className="flex items-center justify-between gap-2">
          <img src={logo} alt="HubandUp" className="h-7 w-auto [filter:brightness(0)_invert(1)]" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar-background">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter(item => item.title !== 'Activité' || role === 'admin')
                .filter(item => !(item as any).adminOnly || role === 'admin')
                .filter(item => item.title !== 'CRM' || role !== 'client')
                .filter(item => !(item as any).hideForAgency || role !== 'agency')
                .map((item) =>
                  canRead(item.module) ? (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          end={item.url === '/' || item.url === '/dashboard'} 
                          matchParent={item.matchParent}
                          activePatterns={item.title === 'CRM' ? ['/client'] : item.title === 'Projets' ? ['/project'] : item.title === 'Agences' ? ['/agency'] : []}
                          className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 rounded-lg" 
                          activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.title}</span>
                          {(item as any).isClientItem && (
                            <span className="ml-auto">
                              <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-sidebar-primary" />
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : null
                )}
              {showSettings && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/settings" 
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 rounded-lg" 
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                    >
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
      <SidebarFooter className="bg-sidebar-background border-t border-sidebar-border">
        <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
