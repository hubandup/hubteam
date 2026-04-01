import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserCheck, FolderKanban, CheckSquare, Loader2, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { usePermissions } from '@/hooks/usePermissions';
import { RolePermissionsIndicator } from '@/components/dashboard/RolePermissionsIndicator';
import { useNavigate } from 'react-router-dom';
import { format, subMonths, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [periodFilter, setPeriodFilter] = useState('180'); // days
  const [conversionRate, setConversionRate] = useState({ rate: 0, converted: 0, total: 0 });
  const [monthlyRevenue, setMonthlyRevenue] = useState({ current: 0, previous: 0, variation: 0 });
  const [teamWorkload, setTeamWorkload] = useState<any[]>([]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
      toast.error(t('dashboard.adminOnly'));
      return;
    }

    if (isAdmin) {
      fetchDashboardData(true);
    }
  }, [isAdmin, roleLoading, navigate, periodFilter]);

  useEffect(() => {
    if (!isAdmin) return;

    const projectsChannel = supabase
      .channel('dashboard-projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchDashboardData(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchDashboardData(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchDashboardData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
    };
  }, [isAdmin, periodFilter]);

  const fetchDashboardData = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const now = new Date();
      const sixMonthsAgo = subMonths(now, 5);
      const sixMonthsStart = format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd');
      const sixMonthsEnd = format(endOfMonth(now), 'yyyy-MM-dd');

      const [
        clientsResult,
        projectsResult,
        topClientsResult,
        commentsResult,
        invoicesResult,
        allProjectsResult,
        recentProjectsResult,
        recentTasksResult,
        teamAdminUsersResult,
      ] = await Promise.all([
        supabase.from('clients').select('active, revenue_current_year, kanban_stage'),
        supabase
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
          .in('status', ['active', 'reco_in_progress']),
        supabase
          .from('clients')
          .select('company, first_name, last_name, revenue_current_year')
          .eq('active', true)
          .order('revenue_current_year', { ascending: false })
          .limit(5),
        supabase
          .from('task_comments')
          .select('id, content, created_at, user_id, task_id, project_id')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('invoices')
          .select('invoice_date, amount')
          .gte('invoice_date', sixMonthsStart)
          .lte('invoice_date', sixMonthsEnd)
          .order('invoice_date', { ascending: true }),
        supabase.from('projects').select('status'),
        supabase.from('projects').select('created_at').gte('created_at', sixMonthsStart),
        supabase.from('tasks').select('created_at').gte('created_at', sixMonthsStart),
        supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'team']),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (topClientsResult.error) throw topClientsResult.error;
      if (commentsResult.error) console.error('Error fetching comments:', commentsResult.error);
      if (invoicesResult.error) console.error('Error fetching invoices:', invoicesResult.error);
      if (allProjectsResult.error) console.error('Error fetching all projects:', allProjectsResult.error);
      if (teamAdminUsersResult.error) console.error('Error fetching team/admin users:', teamAdminUsersResult.error);

      const clients = clientsResult.data || [];
      const projects = projectsResult.data || [];
      const topClientsData = topClientsResult.data || [];
      const commentsData = commentsResult.data || [];
      const invoices = invoicesResult.data || [];
      const allProjects = allProjectsResult.data || [];
      const recentProjects = recentProjectsResult.data || [];
      const recentTasks = recentTasksResult.data || [];
      const teamAdminUsers = teamAdminUsersResult.data || [];

      const leadStages = ['prospect', 'rdv_a_prendre', 'a_relancer', 'rdv_hub_date', 'rdv_pris', 'reco_en_cours'];
      const clientStages = ['a_fideliser', 'projet_valide'];

      const leads = clients.filter(c => c.active && leadStages.includes(c.kanban_stage)).length;
      const activeClients = clients.filter(c => c.active && clientStages.includes(c.kanban_stage)).length;
      const totalRevenue = clients.reduce((sum, c) => sum + (c.revenue_current_year || 0), 0);

      const projectIds = projects.map((p: any) => p.id);
      const openProjectTasksResult = projectIds.length
        ? await supabase.from('tasks').select('project_id, status').in('project_id', projectIds)
        : { data: [], error: null };

      if (openProjectTasksResult.error) throw openProjectTasksResult.error;

      const tasksByProject = (openProjectTasksResult.data || []).reduce((acc: Record<string, { total: number; done: number; inProgress: number }>, task: any) => {
        if (!task.project_id) return acc;
        if (!acc[task.project_id]) {
          acc[task.project_id] = { total: 0, done: 0, inProgress: 0 };
        }
        acc[task.project_id].total += 1;
        if (task.status === 'done') acc[task.project_id].done += 1;
        if (task.status === 'in_progress') acc[task.project_id].inProgress += 1;
        return acc;
      }, {});

      const projectsProgress = projects
        .map((project: any) => {
          const counts = tasksByProject[project.id] || { total: 0, done: 0, inProgress: 0 };
          const progress = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
          const clientName = project.project_clients?.[0]?.clients?.company || t('dashboard.unknownClient');

          return {
            ...project,
            clientName,
            totalTasks: counts.total,
            completedTasks: counts.done,
            progress,
          };
        })
        .filter((project: any) => project.totalTasks > 0);

      const tasksInProgressCount = Object.values(tasksByProject).reduce((sum, taskGroup) => sum + taskGroup.inProgress, 0);

      const commentUserIds = [...new Set(commentsData.map(comment => comment.user_id).filter(Boolean))];
      const commentTaskIds = [...new Set(commentsData.map(comment => comment.task_id).filter(Boolean))];

      const [commentProfilesResult, commentTasksResult] = await Promise.all([
        commentUserIds.length
          ? supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', commentUserIds)
          : Promise.resolve({ data: [], error: null }),
        commentTaskIds.length
          ? supabase.from('tasks').select('id, title, project_id').in('id', commentTaskIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const commentProfiles = commentProfilesResult.data || [];
      const commentTasks = commentTasksResult.data || [];
      const commentProjectIds = [...new Set([
        ...commentsData.map(comment => comment.project_id).filter(Boolean),
        ...commentTasks.map(task => task.project_id).filter(Boolean),
      ])];

      const commentProjectsResult = commentProjectIds.length
        ? await supabase.from('projects').select('id, name').in('id', commentProjectIds)
        : { data: [], error: null };

      const profileMap = new Map(commentProfiles.map(profile => [profile.id, profile]));
      const taskMap = new Map(commentTasks.map(task => [task.id, task]));
      const projectMap = new Map((commentProjectsResult.data || []).map(project => [project.id, project.name]));

      const comments = commentsData.map(comment => {
        const task = comment.task_id ? taskMap.get(comment.task_id) : null;
        const resolvedProjectId = comment.project_id || task?.project_id || null;

        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          profiles: comment.user_id ? profileMap.get(comment.user_id) || null : null,
          tasks: task ? { title: task.title } : null,
          project: resolvedProjectId ? projectMap.get(resolvedProjectId) || 'Projet inconnu' : 'Projet inconnu',
          project_id: resolvedProjectId,
          task_id: comment.task_id,
        };
      });

      const revenueByMonth: Record<string, number> = {};
      invoices.forEach((invoice: any) => {
        if (!invoice.invoice_date) return;
        const monthKey = format(new Date(invoice.invoice_date), 'yyyy-MM');
        revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + Number(invoice.amount || 0);
      });

      const revenueEvolution = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthName = format(monthDate, 'MMMM', { locale: fr });
        revenueEvolution.push({
          month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          revenue: revenueByMonth[monthKey] || 0,
        });
      }

      const statusCounts = allProjects.reduce((acc: Record<string, number>, project: any) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
      }, {});

      const projectsStatus = [
        { name: 'Planification', value: statusCounts['planning'] || 0 },
        { name: 'Actif', value: statusCounts['active'] || 0 },
        { name: 'Terminé', value: statusCounts['completed'] || 0 },
      ].filter(item => item.value > 0);

      const monthlyPerformanceMap = new Map<string, { month: string; projets: number; taches: number }>();
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const key = format(monthDate, 'yyyy-MM');
        const label = format(monthDate, 'MMM', { locale: fr });
        monthlyPerformanceMap.set(key, {
          month: label.charAt(0).toUpperCase() + label.slice(1),
          projets: 0,
          taches: 0,
        });
      }

      recentProjects.forEach((project: any) => {
        const key = format(new Date(project.created_at), 'yyyy-MM');
        const month = monthlyPerformanceMap.get(key);
        if (month) month.projets += 1;
      });

      recentTasks.forEach((task: any) => {
        const key = format(new Date(task.created_at), 'yyyy-MM');
        const month = monthlyPerformanceMap.get(key);
        if (month) month.taches += 1;
      });

      const performance = Array.from(monthlyPerformanceMap.values());

      const convertedCount = clients.filter(c => ['projet_valide', 'a_fideliser'].includes(c.kanban_stage)).length;
      const totalClientsCount = clients.length;
      const rate = totalClientsCount > 0 ? Math.round((convertedCount / totalClientsCount) * 100) : 0;

      const currentMonthKey = format(now, 'yyyy-MM');
      const prevMonthKey = format(subMonths(now, 1), 'yyyy-MM');
      const currentMonthRevenue = revenueByMonth[currentMonthKey] || 0;
      const prevMonthRevenue = revenueByMonth[prevMonthKey] || 0;
      const revenueVariation = prevMonthRevenue > 0
        ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
        : 0;

      setStats({
        leads,
        clients: activeClients,
        openProjects: projects.length,
        tasksInProgress: tasksInProgressCount,
        totalRevenue,
      });
      setProjectsWithProgress(projectsProgress);
      setTopClients(topClientsData);
      setRecentComments(comments);
      setRevenueData(revenueEvolution);
      setProjectStatusData(projectsStatus);
      setMonthlyPerformance(performance);
      setConversionRate({ rate, converted: convertedCount, total: totalClientsCount });
      setMonthlyRevenue({ current: currentMonthRevenue, previous: prevMonthRevenue, variation: revenueVariation });
      setLoading(false);

      const userIds = teamAdminUsers.map(user => user.user_id);
      if (userIds.length === 0) {
        setProjectsByUser([]);
        setTasksByUser([]);
        setTaskCompletionByUser([]);
        setTeamWorkload([]);
        return;
      }

      const [userProfilesResult, allUserProjectsResult, allUserTasksResult] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name').in('id', userIds),
        supabase.from('projects').select('created_by').in('created_by', userIds),
        supabase.from('tasks').select('assigned_to, status').in('assigned_to', userIds),
      ]);

      const userProfiles = userProfilesResult.data || [];
      const allUserProjects = allUserProjectsResult.data || [];
      const allUserTasks = allUserTasksResult.data || [];
      const profilesMap = new Map(userProfiles.map(profile => [profile.id, `${profile.first_name} ${profile.last_name}`]));

      const projectCountsByUser = allUserProjects.reduce((acc: Record<string, number>, project: any) => {
        if (!project.created_by) return acc;
        acc[project.created_by] = (acc[project.created_by] || 0) + 1;
        return acc;
      }, {});

      const taskCountsByUser: Record<string, number> = {};
      const taskCompletedByUser: Record<string, number> = {};
      const workloadByUser: Record<string, { todo: number; in_progress: number }> = {};

      allUserTasks.forEach((task: any) => {
        if (!task.assigned_to) return;
        taskCountsByUser[task.assigned_to] = (taskCountsByUser[task.assigned_to] || 0) + 1;
        if (task.status === 'done') {
          taskCompletedByUser[task.assigned_to] = (taskCompletedByUser[task.assigned_to] || 0) + 1;
        }
        if (!workloadByUser[task.assigned_to]) {
          workloadByUser[task.assigned_to] = { todo: 0, in_progress: 0 };
        }
        if (task.status === 'todo') workloadByUser[task.assigned_to].todo += 1;
        if (task.status === 'in_progress') workloadByUser[task.assigned_to].in_progress += 1;
      });

      const projectsByUserData = userIds
        .map(uid => ({
          name: profilesMap.get(uid) || 'Utilisateur inconnu',
          projets: projectCountsByUser[uid] || 0,
        }))
        .filter(user => user.projets > 0)
        .sort((a, b) => b.projets - a.projets);

      const tasksByUserData = userIds
        .map(uid => ({
          name: profilesMap.get(uid) || 'Utilisateur inconnu',
          taches: taskCountsByUser[uid] || 0,
        }))
        .filter(user => user.taches > 0)
        .sort((a, b) => b.taches - a.taches);

      const taskCompletionByUserData = userIds
        .map(uid => {
          const total = taskCountsByUser[uid] || 0;
          const completed = taskCompletedByUser[uid] || 0;
          if (total === 0) return null;
          return {
            name: profilesMap.get(uid) || 'Utilisateur inconnu',
            taux: Math.round((completed / total) * 100),
            terminees: completed,
            total,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.taux - a.taux);

      const workloadData = userIds
        .map(uid => ({
          name: formatUserName(profilesMap.get(uid) || 'Inconnu'),
          todo: workloadByUser[uid]?.todo || 0,
          en_cours: workloadByUser[uid]?.in_progress || 0,
        }))
        .filter(user => user.todo > 0 || user.en_cours > 0)
        .sort((a, b) => (b.todo + b.en_cours) - (a.todo + a.en_cours));

      setProjectsByUser(projectsByUserData);
      setTasksByUser(tasksByUserData);
      setTaskCompletionByUser(taskCompletionByUserData as any[]);
      setTeamWorkload(workloadData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error(t('dashboard.loadError'));
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

  // Format user name to initial with proper casing
  const formatUserName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      const firstInitial = parts[0].charAt(0).toUpperCase();
      const lastName = parts.slice(1)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
      return `${firstInitial}. ${lastName}`;
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
          <p className="text-lg font-semibold text-foreground">{t('common.accessDenied')}</p>
          <p className="text-muted-foreground">{t('dashboard.adminOnly')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 jours</SelectItem>
            <SelectItem value="90">90 jours</SelectItem>
            <SelectItem value="180">6 mois</SelectItem>
            <SelectItem value="365">1 an</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Role & Permissions Indicator */}
      <RolePermissionsIndicator />

      {/* New KPIs Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Conversion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.rate}%</div>
            <p className="text-xs text-muted-foreground">
              {conversionRate.converted} convertis sur {conversionRate.total} clients
            </p>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA mensuel</CardTitle>
            {monthlyRevenue.variation >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(monthlyRevenue.current)}
            </div>
            <p className={`text-xs ${monthlyRevenue.variation >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {monthlyRevenue.variation >= 0 ? '+' : ''}{monthlyRevenue.variation}% vs mois précédent
            </p>
          </CardContent>
        </Card>

        {/* Team Workload Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charge équipe</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamWorkload.reduce((sum, u) => sum + u.todo + u.en_cours, 0)} tâches
            </div>
            <p className="text-xs text-muted-foreground">
              réparties sur {teamWorkload.length} membres
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.leads')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leads}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.leadsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.clients')}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clients}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.clientsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.openProjects')}</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openProjects}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.openProjectsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.tasksInProgress')}</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasksInProgress}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.tasksInProgressDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Schedule */}
      <WeeklySchedule />

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Project Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.projectStatus')}</CardTitle>
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
                  fill={chartColors[0]}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={chartColors[index % chartColors.length]} 
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
            <CardTitle>{t('dashboard.monthlyPerformance')}</CardTitle>
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
                <Bar dataKey="projets" fill="hsl(var(--primary))" name={t('dashboard.projectsChart')} />
                <Bar dataKey="taches" fill="hsl(var(--secondary))" name={t('dashboard.tasksChart')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Projects by User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.projectsByUser')}</CardTitle>
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
            <CardTitle className="text-base">{t('dashboard.tasksByUser')}</CardTitle>
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
            <CardTitle className="text-base">{t('dashboard.taskCompletionByUser')}</CardTitle>
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
                      return [`${value.toFixed(0)}% (${item.terminees}/${item.total})`, t('dashboard.completionRate')];
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

      {/* Team Workload Bar Chart */}
      {teamWorkload.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Charge de travail par membre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, teamWorkload.length * 45)}>
              <BarChart data={teamWorkload} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Bar dataKey="en_cours" stackId="a" fill="hsl(var(--primary))" name="En cours" />
                <Bar dataKey="todo" stackId="a" fill="hsl(var(--secondary))" name="À faire" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Projects Progress */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.progressByProject')}</CardTitle>
          </CardHeader>
          <CardContent>
            {projectsWithProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('dashboard.noOngoingProjects')}
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
                          {project.completedTasks}/{project.totalTasks} {t('dashboard.tasks')}
                        </span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {project.progress.toFixed(1)}% {t('dashboard.completed')}
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
            <CardTitle>{t('dashboard.topClients')}</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('dashboard.noActiveClients')}
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
          <CardTitle>{t('dashboard.recentComments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentComments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('dashboard.noRecentComments')}
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
