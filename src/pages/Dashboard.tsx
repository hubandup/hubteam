import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, FolderKanban, CheckSquare, Euro, Loader2, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { usePermissions } from '@/hooks/usePermissions';
import { RolePermissionsIndicator } from '@/components/dashboard/RolePermissionsIndicator';
import { useNavigate } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [stats, setStats] = useState({
    leads: 0,
    clients: 0,
    openProjects: 0,
    tasksInProgress: 0,
    totalRevenue: 0,
  });
  const [projectsWithProgress, setProjectsWithProgress] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [recentComments, setRecentComments] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [projectStatusData, setProjectStatusData] = useState<any[]>([]);
  const [monthlyPerformance, setMonthlyPerformance] = useState<any[]>([]);
  const [projectsByUser, setProjectsByUser] = useState<any[]>([]);
  const [tasksByUser, setTasksByUser] = useState<any[]>([]);
  const [taskCompletionByUser, setTaskCompletionByUser] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
      toast.error('Accès refusé : page réservée aux administrateurs');
      return;
    }
    
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    
    fetchDashboardData();

    // Subscribe to realtime changes for projects, tasks, and clients
    const projectsChannel = supabase
      .channel('dashboard-projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch clients stats
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('active, revenue, revenue_current_year');
      
      if (clientsError) throw clientsError;

      const leads = clients?.filter(c => !c.active).length || 0;
      const activeClients = clients?.filter(c => c.active).length || 0;
      const totalRevenue = clients?.reduce((sum, c) => sum + (c.revenue_current_year || 0), 0) || 0;

      // Fetch projects for progress calculation (without relying on FK-based nested selects)
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          status,
          end_date,
          project_clients (
            clients (
              company
            )
          )
        `)
        .in('status', ['planning', 'active']);

      if (projectsError) throw projectsError;

      // Compute progress by fetching tasks separately and grouping by project_id
      const projectIds = (projects || []).map((p: any) => p.id);
      let tasksByProject: Record<string, { total: number; done: number }> = {};

      if (projectIds.length > 0) {
        const { data: tasksList, error: tasksListError } = await supabase
          .from('tasks')
          .select('project_id, status')
          .in('project_id', projectIds);
        if (tasksListError) throw tasksListError;

        tasksByProject = (tasksList || []).reduce((acc: Record<string, { total: number; done: number }>, t: any) => {
          const pid = t.project_id;
          if (!pid) return acc;
          if (!acc[pid]) acc[pid] = { total: 0, done: 0 };
          acc[pid].total += 1;
          if (t.status === 'done') acc[pid].done += 1;
          return acc;
        }, {});
      }

      const projectsProgress = (projects || [])
        .map((project: any) => {
          const counts = tasksByProject[project.id] || { total: 0, done: 0 };
          const totalTasks = counts.total;
          const completedTasks = counts.done;
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const clientName = project.project_clients?.[0]?.clients?.company || 'Client inconnu';

          return {
            ...project,
            clientName,
            totalTasks,
            completedTasks,
            progress,
          };
        })
        .filter((p: any) => p.totalTasks > 0);

      // Fetch tasks in progress
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('status', 'in_progress');

      if (tasksError) throw tasksError;

      // Fetch top 5 clients by revenue
      const { data: topClientsData, error: topClientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('active', true)
        .order('revenue_current_year', { ascending: false })
        .limit(5);

      if (topClientsError) throw topClientsError;

      // Fetch recent task comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('task_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          task_id,
          project_id
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (commentsError) console.error('Error fetching comments:', commentsError);

      const commentsWithDetails = await Promise.all(
        (commentsData || []).map(async (comment) => {
          let profile = null;
          let task = null;
          let project = 'Projet inconnu';
          let projectId = comment.project_id; // Start with comment's project_id

          if (comment.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name, last_name, avatar_url')
              .eq('id', comment.user_id)
              .maybeSingle();
            profile = profileData;
          }

          if (comment.task_id) {
            const { data: taskData } = await supabase
              .from('tasks')
              .select('title, project_id')
              .eq('id', comment.task_id)
              .maybeSingle();
            
            if (taskData) {
              task = { title: taskData.title };
              projectId = projectId || taskData.project_id; // Use task's project_id if comment doesn't have one
              
              if (taskData.project_id) {
                const { data: projectData } = await supabase
                  .from('projects')
                  .select('name')
                  .eq('id', taskData.project_id)
                  .maybeSingle();
                
                if (projectData) {
                  project = projectData.name;
                }
              }
            }
          } else if (comment.project_id) {
            // For free comments without task, get project directly
            const { data: projectData } = await supabase
              .from('projects')
              .select('name')
              .eq('id', comment.project_id)
              .maybeSingle();
            
            if (projectData) {
              project = projectData.name;
            }
          }

          return {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            profiles: profile,
            tasks: task,
            project,
            project_id: projectId,
            task_id: comment.task_id
          };
        })
      );

      const comments = commentsWithDetails;

      setStats({
        leads,
        clients: activeClients,
        openProjects: projects?.length || 0,
        tasksInProgress: tasks?.length || 0,
        totalRevenue,
      });

      // Fetch revenue evolution data from invoices (last 6 months)
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 5); // 5 months ago + current month = 6 months
      
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('invoice_date, amount')
        .gte('invoice_date', format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd'))
        .lte('invoice_date', format(endOfMonth(now), 'yyyy-MM-dd'))
        .order('invoice_date', { ascending: true });
      
      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
      }

      // Group invoices by month and calculate revenue
      const revenueByMonth: Record<string, number> = {};
      
      invoices?.forEach((invoice) => {
        const monthKey = format(new Date(invoice.invoice_date), 'yyyy-MM');
        if (!revenueByMonth[monthKey]) {
          revenueByMonth[monthKey] = 0;
        }
        revenueByMonth[monthKey] += Number(invoice.amount);
      });

      // Generate array of last 6 months with revenue data
      const revenueEvolution = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthName = format(monthDate, 'MMMM', { locale: fr });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        
        revenueEvolution.push({
          month: capitalizedMonth,
          revenue: revenueByMonth[monthKey] || 0,
        });
      }

      // Calculate project status distribution
      const { data: allProjects, error: allProjectsError } = await supabase
        .from('projects')
        .select('status');

      if (allProjectsError) console.error('Error fetching all projects:', allProjectsError);

      const statusCounts = allProjects?.reduce((acc: any, project: any) => {
        const status = project.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}) || {};

      const projectsStatus = [
        { name: 'Planification', value: statusCounts['planning'] || 0 },
        { name: 'Actif', value: statusCounts['active'] || 0 },
        { name: 'Terminé', value: statusCounts['completed'] || 0 },
      ].filter(item => item.value > 0);

      // Mock monthly performance data
      const performance = [
        { month: 'Juil', projets: 8, taches: 45, revenue: 45000 },
        { month: 'Août', projets: 10, taches: 52, revenue: 52000 },
        { month: 'Sept', projets: 9, taches: 48, revenue: 48000 },
        { month: 'Oct', projets: 12, taches: 61, revenue: 61000 },
        { month: 'Nov', projets: 11, taches: 58, revenue: 58000 },
        { month: 'Déc', projets: projects?.length || 0, taches: tasks?.length || 0, revenue: totalRevenue },
      ];

      // Fetch projects by user (team + admin)
      const { data: teamAdminUsers, error: usersError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'team']);

      if (usersError) {
        console.error('Error fetching team/admin users:', usersError);
      }

      // Get profiles for these users
      const userIds = teamAdminUsers?.map(u => u.user_id) || [];
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      // Create a map of user profiles
      const profilesMap = new Map(
        userProfiles?.map(p => [p.id, `${p.first_name} ${p.last_name}`]) || []
      );

      // Count projects by user
      const projectCountsByUser: Record<string, { name: string; count: number }> = {};

      if (teamAdminUsers) {
        for (const userRole of teamAdminUsers) {
          const userId = userRole.user_id;
          const userName = profilesMap.get(userId) || 'Utilisateur inconnu';

          // Count projects created by this user
          const { count, error: projectsError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', userId);

          if (!projectsError) {
            projectCountsByUser[userId] = {
              name: userName,
              count: count || 0,
            };
          }
        }
      }

      // Transform to array for chart
      const projectsByUserData = Object.values(projectCountsByUser)
        .sort((a, b) => b.count - a.count)
        .map(user => ({
          name: user.name,
          projets: user.count,
        }));

      // Count tasks by user (team + admin)
      const taskCountsByUser: Record<string, { name: string; count: number }> = {};

      if (teamAdminUsers) {
        for (const userRole of teamAdminUsers) {
          const userId = userRole.user_id;
          const userName = profilesMap.get(userId) || 'Utilisateur inconnu';

          // Count tasks assigned to this user
          const { count: taskCount, error: tasksError } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', userId);

          if (!tasksError) {
            taskCountsByUser[userId] = {
              name: userName,
              count: taskCount || 0,
            };
          }
        }
      }

      // Transform to array for chart
      const tasksByUserData = Object.values(taskCountsByUser)
        .sort((a, b) => b.count - a.count)
        .map(user => ({
          name: user.name,
          taches: user.count,
        }));

      // Calculate task completion rate by user
      const taskCompletionByUserData: any[] = [];

      if (teamAdminUsers) {
        for (const userRole of teamAdminUsers) {
          const userId = userRole.user_id;
          const userName = profilesMap.get(userId) || 'Utilisateur inconnu';

          // Count total tasks assigned to this user
          const { count: totalTasks } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', userId);

          // Count completed tasks
          const { count: completedTasks } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', userId)
            .eq('status', 'done');

          if (totalTasks && totalTasks > 0) {
            const completionRate = Math.round(((completedTasks || 0) / totalTasks) * 100);
            taskCompletionByUserData.push({
              name: userName,
              taux: completionRate,
              terminees: completedTasks || 0,
              total: totalTasks,
            });
          }
        }
      }

      // Sort by completion rate descending
      taskCompletionByUserData.sort((a, b) => b.taux - a.taux);

      setStats({
        leads,
        clients: activeClients,
        openProjects: projects?.length || 0,
        tasksInProgress: tasks?.length || 0,
        totalRevenue,
      });

      setProjectsWithProgress(projectsProgress);
      setTopClients(topClientsData || []);
      setRecentComments(comments || []);
      setRevenueData(revenueEvolution);
      setProjectStatusData(projectsStatus);
      setMonthlyPerformance(performance);
      setProjectsByUser(projectsByUserData);
      setTasksByUser(tasksByUserData);
      setTaskCompletionByUser(taskCompletionByUserData);

      // Get last sync timestamp from clients
      const { data: lastSyncedClient } = await supabase
        .from('clients')
        .select('facturation_pro_synced_at')
        .not('facturation_pro_synced_at', 'is', null)
        .order('facturation_pro_synced_at', { ascending: false })
        .limit(1)
        .single();

      if (lastSyncedClient?.facturation_pro_synced_at) {
        setLastSyncTimestamp(lastSyncedClient.facturation_pro_synced_at);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  // Color palette for charts - harmonious and theme-consistent
  const chartColors = [
    'hsl(210, 60%, 55%)',  // Blue
    'hsl(160, 55%, 50%)',  // Teal
    'hsl(280, 50%, 60%)',  // Purple
    'hsl(30, 65%, 55%)',   // Orange
    'hsl(340, 55%, 60%)',  // Pink
    'hsl(180, 50%, 50%)',  // Cyan
    'hsl(45, 60%, 55%)',   // Yellow
    'hsl(120, 45%, 50%)',  // Green
  ];

  const getChartColor = (index: number) => {
    return chartColors[index % chartColors.length];
  };

  // Format user name to initial
  const formatUserName = (fullName: string) => {
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
    }
    return fullName;
  };

  // Custom label renderer for pie charts with left alignment
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="hsl(var(--foreground))" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        style={{ fontSize: '11px' }}
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom label renderer for completion rate with percentage value
  const renderCompletionLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="hsl(var(--foreground))" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        style={{ fontSize: '11px' }}
      >
        {`${name} ${value.toFixed(0)}%`}
      </text>
    );
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    toast.info('Synchronisation Facturation.PRO en cours...');
    
    try {
      // Sync clients
      const { error: clientsError } = await supabase.functions.invoke('sync-facturation-pro-clients');
      if (clientsError) throw new Error(`Erreur clients: ${clientsError.message}`);
      
      // Sync invoices
      const { error: invoicesError } = await supabase.functions.invoke('sync-facturation-pro-invoices');
      if (invoicesError) throw new Error(`Erreur factures: ${invoicesError.message}`);
      
      toast.success('Synchronisation Facturation.PRO terminée avec succès');
      
      // Refresh dashboard data
      fetchDashboardData();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canRead('dashboard')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder au tableau de bord</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronisation...' : 'Sync Facturation.PRO'}
          </Button>
          {lastSyncTimestamp && (
            <p className="text-xs text-muted-foreground">
              Dernière sync: {format(new Date(lastSyncTimestamp), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            </p>
          )}
        </div>
      </div>

      {/* Role & Permissions Indicator */}
      <RolePermissionsIndicator />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leads}</div>
            <p className="text-xs text-muted-foreground">Clients inactifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clients}</div>
            <p className="text-xs text-muted-foreground">Clients actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projets ouverts</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openProjects}</div>
            <p className="text-xs text-muted-foreground">En cours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tâches en cours</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasksInProgress}</div>
            <p className="text-xs text-muted-foreground">À réaliser</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Année Fiscale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString('fr-FR')} €</div>
            <p className="text-xs text-muted-foreground">Avril - Mars</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Schedule */}
      <WeeklySchedule />

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Revenue Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution du CA</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value: any) => `${value.toLocaleString('fr-FR')} €`}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des projets</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        index === 0 ? 'hsl(var(--primary))' : 
                        index === 1 ? 'hsl(var(--warning))' : 
                        'hsl(var(--success))'
                      } 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyPerformance}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar dataKey="projets" fill="hsl(var(--primary))" name="Projets" />
                <Bar dataKey="taches" fill="hsl(var(--secondary))" name="Tâches" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Projects by User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projets par utilisateur</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={projectsByUser.map((item, index) => ({
                    name: formatUserName(item.name),
                    value: item.projets,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={renderCustomLabel}
                  outerRadius={70}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {projectsByUser.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getChartColor(index)}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px' }}
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tasks by User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tâches par utilisateur</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tasksByUser.map((item, index) => ({
                    name: formatUserName(item.name),
                    value: item.taches,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={renderCustomLabel}
                  outerRadius={70}
                  fill="hsl(var(--secondary))"
                  dataKey="value"
                >
                  {tasksByUser.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getChartColor(index)}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px' }}
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Completion Rate by User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taux de complétion des tâches</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskCompletionByUser.map((item, index) => ({
                    name: formatUserName(item.name),
                    originalName: item.name,
                    value: item.taux,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={renderCompletionLabel}
                  outerRadius={70}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {taskCompletionByUser.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getChartColor(index)}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    const item = taskCompletionByUser.find(d => d.name === props.payload.originalName);
                    if (item) {
                      return [`${value.toFixed(0)}% (${item.terminees}/${item.total})`, 'Taux de complétion'];
                    }
                    return [value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px' }}
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Projects Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Projets en cours</CardTitle>
          </CardHeader>
          <CardContent>
            {projectsWithProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun projet en cours
              </p>
            ) : (
              <div className="space-y-4">
                {projectsWithProgress.slice(0, 5).map((project) => {
                  const isOverdue = project.end_date && new Date(project.end_date) < new Date() && project.status !== 'completed';
                  
                  return (
                    <div key={project.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                          {project.clientName} - {project.name}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {project.completedTasks}/{project.totalTasks} tâches
                        </span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {project.progress.toFixed(1)}% complété
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun client actif
              </p>
            ) : (
              <div className="space-y-4">
                {topClients.map((client, index) => (
                  <div key={client.id} className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate uppercase">{client.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.first_name} {client.last_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-success">
                        {(client.revenue_current_year || 0).toLocaleString('fr-FR')} €
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Comments */}
      <Card>
        <CardHeader>
          <CardTitle>Derniers commentaires</CardTitle>
        </CardHeader>
        <CardContent>
          {recentComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun commentaire récent
            </p>
          ) : (
            <div className="space-y-4">
              {recentComments.map((comment: any) => (
                <div 
                  key={comment.id} 
                  className="flex gap-3 pb-4 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => {
                    if (comment.project_id) {
                      navigate(`/project/${comment.project_id}`);
                    }
                  }}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    {comment.profiles?.avatar_url && (
                      <AvatarImage 
                        src={comment.profiles.avatar_url} 
                        alt={`${comment.profiles?.first_name} ${comment.profiles?.last_name}`} 
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {comment.profiles?.first_name?.[0]}{comment.profiles?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {comment.profiles?.first_name} {comment.profiles?.last_name}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        dans {comment.project}
                      </span>
                      {comment.tasks && (
                        <span className="text-xs text-muted-foreground">
                          · {comment.tasks.title}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{comment.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
