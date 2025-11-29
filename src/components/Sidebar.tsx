import { Home, LayoutDashboard, FolderKanban, Settings, LogOut, Building2, Users, ListTodo, MessageSquare, History, HelpCircle, Rss } from 'lucide-react';
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
    { title: 'Tableau de bord', url: '/dashboard', icon: LayoutDashboard, module: 'dashboard' as const },
    { title: 'CRM', url: '/crm', icon: Users, module: 'crm' as const, matchParent: true },
    { title: 'Prospection', url: '/prospection', icon: ListTodo, module: 'crm' as const, hideForAgency: true },
    { title: 'Agences', url: '/agencies', icon: Building2, module: 'agencies' as const, matchParent: true },
    { title: 'Projets', url: '/projects', icon: FolderKanban, module: 'projects' as const, matchParent: true },
    { title: 'Messages', url: '/messages', icon: MessageSquare, module: 'messages' as const },
    { title: 'Activité', url: '/activity', icon: History, module: 'dashboard' as const, hideForClient: true, hideForAgency: true },
    { title: 'FAQ', url: '/faq', icon: HelpCircle, module: 'faq' as const },
  ];

  const showSettings = role === 'admin' || role === 'team' || role === 'agency';

  return (
    <ShadcnSidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <img src={logo} alt="HubandUp" className="h-7 w-auto" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter(item => item.title !== 'Tableau de bord' || role === 'admin')
                .filter(item => item.title !== 'CRM' || role !== 'client')
                .filter(item => !item.hideForClient || role !== 'client')
                .filter(item => !item.hideForAgency || role !== 'agency')
                .map((item) =>
                  canRead(item.module) ? (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          end={item.url === '/' || item.url === '/dashboard'} 
                          matchParent={item.matchParent}
                          activePatterns={item.title === 'CRM' ? ['/client'] : item.title === 'Projets' ? ['/project'] : item.title === 'Agences' ? ['/agency'] : []}
                          className="hover:bg-muted/50" 
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.title}</span>
                          {(item as any).isClientItem && (
                            <span className="ml-auto">
                              <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-primary" />
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
