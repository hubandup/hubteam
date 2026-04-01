import { useState, useEffect } from 'react';
import { TodoList } from '@/components/home/TodoList';
import { QuickNotes } from '@/components/home/QuickNotes';
import { TodayTasks } from '@/components/home/TodayTasks';
import { MyWeeklySchedule } from '@/components/home/MyWeeklySchedule';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, isFuture, addDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Calendar, Clock, Activity, Users, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActiveProject {
  id: string;
  name: string;
  status: string;
  clientName: string;
}

interface UpcomingDeadline {
  id: string;
  title: string;
  end_date: string;
  type: 'task' | 'project';
  projectName?: string;
}

interface FollowUpClient {
  id: string;
  company: string;
  follow_up_date: string;
}

interface RecentActivity {
  id: string;
  action_type: string;
  entity_type: string;
  created_at: string;
  userName?: string;
}

export default function Home() {
  const [userName, setUserName] = useState('');
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpClient[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { role, isAgency, isClient } = useUserRole();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchHomeData();
    }
  }, [user]);

  const fetchHomeData = async () => {
    if (!user) return;
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) setUserName(profile.first_name);

      // Get user's project IDs (team member or creator)
      const { data: memberProjects } = await supabase
        .from('project_team_members')
        .select('project_id')
        .eq('member_type', 'profile')
        .eq('member_id', user.id);

      const { data: createdProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('created_by', user.id);

      const userProjectIds = [
        ...new Set([
          ...(memberProjects || []).map((p: any) => p.project_id),
          ...(createdProjects || []).map((p: any) => p.id),
        ]),
      ];

      // Fetch active projects for user
      if (userProjectIds.length > 0) {
        const { data: activeData } = await supabase
          .from('projects')
          .select('id, name, status, project_clients(clients(company))')
          .in('id', userProjectIds)
          .eq('archived', false)
          .in('status', ['active', 'reco_in_progress', 'planning'])
          .order('updated_at', { ascending: false })
          .limit(5);

        setActiveProjects(
          (activeData || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            clientName: p.project_clients?.[0]?.clients?.company || 'N/A',
          }))
        );
      }

      // Upcoming deadlines (tasks due in next 7 days)
      const in7days = addDays(new Date(), 7).toISOString();
      const now = new Date().toISOString();

      // Upcoming deadlines - only user's tasks (assigned or in user's projects)
      if (userProjectIds.length > 0) {
        const { data: upcomingTasks } = await supabase
          .from('tasks')
          .select('id, title, end_date, assigned_to, project_id, projects(name)')
          .gte('end_date', now)
          .lte('end_date', in7days)
          .neq('status', 'done')
          .in('project_id', userProjectIds)
          .order('end_date', { ascending: true })
          .limit(8);

        setUpcomingDeadlines(
          (upcomingTasks || []).map((tk: any) => ({
            id: tk.id,
            title: tk.title,
            end_date: tk.end_date,
            type: 'task' as const,
            projectName: tk.projects?.name,
          }))
        );
      }

      // Client follow-ups due
      const { data: followUpData } = await supabase
        .from('clients')
        .select('id, company, follow_up_date')
        .lte('follow_up_date', in7days)
        .eq('active', true)
        .not('follow_up_date', 'is', null)
        .order('follow_up_date', { ascending: true })
        .limit(5);

      setFollowUps(followUpData || []);

      // Recent activity
      const { data: activityData } = await supabase
        .from('activity_log')
        .select('id, action_type, entity_type, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(8);

      if (activityData && activityData.length > 0) {
        const userIds = [...new Set(activityData.map((a) => a.user_id).filter(Boolean))];
        let profilesMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', userIds);
          profilesMap = (profiles || []).reduce((acc: any, p: any) => {
            acc[p.id] = `${p.first_name} ${p.last_name}`;
            return acc;
          }, {});
        }
        setRecentActivities(
          activityData.map((a) => ({
            ...a,
            userName: a.user_id ? profilesMap[a.user_id] || '' : '',
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 6) return t('home.goodEvening');
    return t('home.goodMorning');
  };

  const dateLocale = i18n.language === 'en' ? enUS : fr;
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: dateLocale });

  const actionLabels: Record<string, string> = {
    create: 'a créé',
    update: 'a modifié',
    delete: 'a supprimé',
  };

  const entityLabels: Record<string, string> = {
    project: 'un projet',
    task: 'une tâche',
    client: 'un client',
    agency: 'une agence',
    note: 'une note',
    comment: 'un commentaire',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {getGreeting()} {userName}
          </h1>
          <p className="text-muted-foreground mt-1 capitalize">{today}</p>
        </div>
        {unreadCount > 0 && (
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/feed')}
          >
            <CardContent className="flex items-center gap-2 py-3 px-4">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alerts row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Overdue projects - hidden for agency role */}
        {!isAgency && <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Projets en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun projet en cours</p>
            ) : (
              <div className="space-y-2">
                {activeProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors"
                    onClick={() => navigate(`/project/${p.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.clientName}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 ml-2">
                      {p.status === 'reco_in_progress' ? 'Reco' : p.status === 'planning' ? 'Planning' : 'Actif'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Upcoming deadlines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Échéances à venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune échéance cette semaine</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      {d.projectName && <p className="text-xs text-muted-foreground">{d.projectName}</p>}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 ml-2">
                      {format(new Date(d.end_date), 'd MMM', { locale: fr })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client follow-ups - hidden for agency/client roles */}
        {!isAgency && !isClient && <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Rappels de suivi client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun suivi à prévoir</p>
            ) : (
              <div className="space-y-2">
                {followUps.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors"
                    onClick={() => navigate(`/client/${c.id}`)}
                  >
                    <p className="text-sm font-medium truncate">{c.company}</p>
                    <Badge
                      variant={isPast(new Date(c.follow_up_date)) ? 'destructive' : 'outline'}
                      className="text-xs shrink-0 ml-2"
                    >
                      {format(new Date(c.follow_up_date), 'd MMM', { locale: fr })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>}
      </div>

      {/* Recent activity - hidden for client/agency */}
      {!isAgency && !isClient && recentActivities.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm p-1">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{a.userName || 'Quelqu\'un'}</span>{' '}
                    {actionLabels[a.action_type] || a.action_type}{' '}
                    {entityLabels[a.entity_type] || a.entity_type}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {format(new Date(a.created_at), 'HH:mm', { locale: fr })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing widgets */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <TodoList />
        <QuickNotes />
        <TodayTasks />
        <MyWeeklySchedule />
      </div>
    </div>
  );
}
