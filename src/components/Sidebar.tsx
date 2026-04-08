import { Home, LayoutDashboard, FolderKanban, Settings, LogOut, Building2, Users, ListTodo, HelpCircle, Rss, Euro, MessageSquare, ArrowUpFromLine, BarChart3 } from 'lucide-react';
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
import logo from '@/assets/logo-hubandup.svg';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SmashDialog } from './SmashDialog';
import { useTranslation } from 'react-i18next';

export function Sidebar() {
  const { signOut, user } = useAuth();
  const { role } = useUserRole();
  const { canRead } = usePermissions();
  const [clientId, setClientId] = useState<string | null>(null);
  const [smashOpen, setSmashOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchClientId = async () => {
      if (role === 'client' && user) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single();

          if (profile?.email) {
            const { data: client, error: clientError } = await supabase
              .from('clients')
              .select('id')
              .eq('email', profile.email)
              .single();

            if (client) {
              setClientId(client.id);
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
    { title: t('nav.home'), url: '/', icon: Home, module: 'dashboard' as const },
    ...(role === 'client' && clientId ? [{ title: t('nav.myClientFile'), url: `/client/${clientId}`, icon: Users, module: 'crm' as const, matchParent: true, isClientItem: true }] : []),
    { title: t('nav.feed'), url: '/feed', icon: Rss, module: 'dashboard' as const, hideForClient: true },
    { title: t('nav.activity'), url: '/dashboard', icon: LayoutDashboard, module: 'dashboard' as const },
    { title: t('nav.finances'), url: '/finances', icon: Euro, module: 'dashboard' as const, adminOnly: true },
    { title: t('nav.crm'), url: '/crm', icon: Users, module: 'crm' as const, matchParent: true },
    { title: t('nav.prospection'), url: '/prospection', icon: ListTodo, module: 'crm' as const, hideForAgency: true, hideForClient: true },
    { title: t('nav.agencies'), url: '/agencies', icon: Building2, module: 'agencies' as const, matchParent: true },
    { title: t('nav.projects'), url: '/projects', icon: FolderKanban, module: 'projects' as const, matchParent: true },
    { title: t('nav.messages'), url: '/messages', icon: MessageSquare, module: 'dashboard' as const },
    { title: t('nav.faq'), url: '/faq', icon: HelpCircle, module: 'faq' as const },
  ];

  const showSettings = role === 'admin' || role === 'team' || role === 'agency';

  return (
    <ShadcnSidebar className="border-r border-sidebar-border/20">
      <SidebarHeader className="border-b border-sidebar-border/20 p-5">
        <div className="flex items-center justify-center">
          <img src={logo} alt="HubandUp" className="h-7 min-h-7 min-w-[2.6rem] w-auto object-contain flex-shrink-0 [filter:brightness(0)_invert(1)]" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter(item => item.title !== t('nav.activity') || role === 'admin')
                .filter(item => !(item as any).adminOnly || role === 'admin')
                .filter(item => item.title !== t('nav.crm') || role !== 'client')
                .filter(item => !(item as any).hideForAgency || role !== 'agency')
                .filter(item => !(item as any).hideForClient || role !== 'client')
                .map((item) =>
                  canRead(item.module) ? (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          end={item.url === '/' || item.url === '/dashboard'} 
                          matchParent={item.matchParent}
                          activePatterns={item.url === '/crm' ? ['/client'] : item.url === '/projects' ? ['/project'] : item.url === '/agencies' ? ['/agency'] : []}
                         className="text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 rounded-lg text-[13px]" 
                          activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        >
                          <item.icon className="mr-2.5 h-4 w-4" />
                          <span>{item.title}</span>
                          {(item as any).isClientItem && (
                            <span className="ml-auto">
                              <span className="inline-flex items-center justify-center w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : null
                )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={() => setSmashOpen(true)}
                    className="flex items-center w-full text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 rounded-lg cursor-pointer text-[13px]"
                  >
                    <ArrowUpFromLine className="mr-2.5 h-4 w-4" />
                    <span>{t('nav.smash')}</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {showSettings && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/settings" 
                      className="text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 rounded-lg text-[13px]" 
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <Settings className="mr-2.5 h-4 w-4" />
                      <span>{t('nav.settings')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/20 p-3">
        <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150 rounded-lg text-[13px]">
          <LogOut className="mr-2.5 h-4 w-4" />
          {t('nav.signOut')}
        </Button>
      </SidebarFooter>
      <SmashDialog open={smashOpen} onOpenChange={setSmashOpen} />
    </ShadcnSidebar>
  );
}
