import { Home, Users, Briefcase, Building2, MoreHorizontal, Activity, Calculator, Wallet, Target, Send, HelpCircle, Sparkles, Settings, Megaphone, ArrowUpFromLine, LogOut, Bell } from 'lucide-react';
import { NavLink as RouterNavLink, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { useTabVisits } from '@/hooks/useTabVisits';
import { Badge } from '@/components/ui/badge';
import { MobileBottomSheet } from './MobileBottomSheet';
import { SmashDialog } from './SmashDialog';

const NAVY = '#0C1320';
const LIME = '#DDF247';
const INACTIVE = '#8B93A3';

type Tab = { to: string; icon: typeof Home; label: string };

const TABS: Tab[] = [
  { to: '/', icon: Home, label: 'Accueil' },
  { to: '/crm', icon: Users, label: 'CRM' },
  { to: '/projects', icon: Briefcase, label: 'Projets' },
  { to: '/agencies', icon: Building2, label: 'Agences' },
];

type MoreItem =
  | { kind: 'nav'; to: string; icon: typeof Home; label: string }
  | { kind: 'action'; onSelect: () => void; icon: typeof Home; label: string; danger?: boolean };

export function MobileBottomNav() {
  const { user, signOut } = useAuth();
  const { data: tasks } = useTasks();
  const { data: clients } = useClients();
  const lastVisits = useTabVisits();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [smashOpen, setSmashOpen] = useState(false);

  const crmCount = useMemo(() => {
    if (!clients) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastVisit = lastVisits.crm;
    return clients.filter((c) => {
      if (!c.follow_up_date) return false;
      const deadline = new Date(c.follow_up_date);
      deadline.setHours(0, 0, 0, 0);
      if (deadline > today) return false;
      return new Date(c.updated_at).getTime() > lastVisit;
    }).length;
  }, [clients, lastVisits.crm]);

  const projectsCount = useMemo(() => {
    if (!user || !tasks) return 0;
    return tasks.filter(
      (t) =>
        t.assigned_to === user.id &&
        t.status !== 'Terminée' &&
        new Date(t.created_at).getTime() > lastVisits.projects,
    ).length;
  }, [tasks, user, lastVisits.projects]);

  const badgeFor = (to: string) => {
    if (to === '/crm') return crmCount;
    if (to === '/projects') return projectsCount;
    return 0;
  };

  const moreItems: MoreItem[] = [
    { kind: 'nav', to: '/feed', icon: Activity, label: 'Activité' },
    { kind: 'nav', to: '/comptabilite', icon: Calculator, label: 'Comptabilité' },
    { kind: 'nav', to: '/finances', icon: Wallet, label: 'Finances' },
    { kind: 'nav', to: '/targets', icon: Target, label: 'Targets' },
    { kind: 'nav', to: '/prospection', icon: Send, label: 'Prospection' },
    { kind: 'nav', to: '/faq', icon: HelpCircle, label: 'FAQ' },
    { kind: 'nav', to: '/lagostina', icon: Sparkles, label: 'Lagostina' },
    { kind: 'nav', to: '/brisach', icon: Sparkles, label: 'Brisach' },
    { kind: 'action', onSelect: () => setSmashOpen(true), icon: ArrowUpFromLine, label: 'Smash' },
    { kind: 'nav', to: '/announcements', icon: Megaphone, label: 'Informer' },
    { kind: 'nav', to: '/settings', icon: Settings, label: 'Paramètres' },
  ];

  const handleMoreSelect = (item: MoreItem) => {
    setMoreOpen(false);
    if (item.kind === 'nav') navigate(item.to);
    else item.onSelect();
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          backgroundColor: NAVY,
          paddingBottom: 'env(safe-area-inset-bottom)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
        aria-label="Navigation principale"
      >
        <div className="flex justify-around items-stretch h-16 px-1" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = badgeFor(tab.to);
            return (
              <RouterNavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className="flex-1 flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] transition-colors"
                role="tab"
                aria-label={tab.label}
              >
                {({ isActive }) => {
                  const color = isActive ? LIME : INACTIVE;
                  return (
                    <>
                      <div className="relative">
                        <Icon className="h-[22px] w-[22px]" style={{ color }} strokeWidth={2} />
                        {count > 0 && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-2 h-4 min-w-4 px-1 flex items-center justify-center p-0 text-[9px] font-bold"
                          >
                            {count > 9 ? '9+' : count}
                          </Badge>
                        )}
                      </div>
                      <span
                        className="text-[11px] leading-none font-medium"
                        style={{ color }}
                      >
                        {tab.label}
                      </span>
                    </>
                  );
                }}
              </RouterNavLink>
            );
          })}

          {/* Plus */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px]"
            aria-label="Plus"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal
              className="h-[22px] w-[22px]"
              style={{ color: moreOpen ? LIME : INACTIVE }}
              strokeWidth={2}
            />
            <span
              className="text-[11px] leading-none font-medium"
              style={{ color: moreOpen ? LIME : INACTIVE }}
            >
              Plus
            </span>
          </button>
        </div>
      </nav>

      <MobileBottomSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        variant="navy"
        ariaLabel="Menu supplémentaire"
      >
        <div className="pt-2 pb-2 grid grid-cols-1">
          {moreItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.kind === 'nav' ? item.to : item.label}
                type="button"
                onClick={() => handleMoreSelect(item)}
                className="w-full flex items-center gap-4 px-2 py-3 rounded-xl text-left hover:bg-white/5 active:bg-white/10 min-h-[48px]"
              >
                <span
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                >
                  <Icon className="h-5 w-5 text-white/90" strokeWidth={1.8} />
                </span>
                <span className="text-white text-[15px] font-medium">{item.label}</span>
              </button>
            );
          })}

          <div className="h-px bg-white/10 my-2" />

          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-4 px-2 py-3 rounded-xl text-left hover:bg-white/5 active:bg-white/10 min-h-[48px]"
          >
            <span
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(229,72,77,0.12)' }}
            >
              <LogOut className="h-5 w-5" style={{ color: '#E5484D' }} strokeWidth={1.8} />
            </span>
            <span className="text-[15px] font-semibold" style={{ color: '#E5484D' }}>
              Déconnexion
            </span>
          </button>
        </div>
      </MobileBottomSheet>

      <SmashDialog open={smashOpen} onOpenChange={setSmashOpen} />
    </>
  );
}
