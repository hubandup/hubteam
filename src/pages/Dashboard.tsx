import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, FolderKanban, CheckSquare, DollarSign, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { usePermissions } from '@/hooks/usePermissions';
import { RolePermissionsIndicator } from '@/components/dashboard/RolePermissionsIndicator';

export default function Dashboard() {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        .select('active, revenue');
      
      if (clientsError) throw clientsError;

      const leads = clients?.filter(c => !c.active).length || 0;
      const activeClients = clients?.filter(c => c.active).length || 0;
      const totalRevenue = clients?.reduce((sum, c) => sum + (c.revenue || 0), 0) || 0;

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
        .order('revenue', { ascending: false })
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

      // Fetch profiles and tasks separately for each comment
      const commentsWithDetails = await Promise.all(
        (commentsData || []).map(async (comment) => {
          let profile = null;
          let task = null;
          let project = 'Projet inconnu';

          if (comment.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', comment.user_id)
              .single();
            profile = profileData;
          }

          if (comment.task_id) {
            const { data: taskData } = await supabase
              .from('tasks')
              .select('title, project_id')
              .eq('id', comment.task_id)
              .single();
            
            if (taskData) {
              task = { title: taskData.title };
              
              if (taskData.project_id) {
                const { data: projectData } = await supabase
                  .from('projects')
                  .select('name')
                  .eq('id', taskData.project_id)
                  .single();
                
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
              .single();
            
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
            project
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

      // Mock revenue evolution data (last 6 months)
      const revenueEvolution = [
        { month: 'Juillet', revenue: 45000 },
        { month: 'Août', revenue: 52000 },
        { month: 'Septembre', revenue: 48000 },
        { month: 'Octobre', revenue: 61000 },
        { month: 'Novembre', revenue: 58000 },
        { month: 'Décembre', revenue: totalRevenue },
      ];

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
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
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
            <CardTitle className="text-sm font-medium">CA Global</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString('fr-FR')} €</div>
            <p className="text-xs text-muted-foreground">Tous clients</p>
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
                      <p className="text-sm font-medium truncate">{client.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.first_name} {client.last_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-success">
                        {client.revenue.toLocaleString('fr-FR')} €
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
                <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {comment.profiles?.first_name?.[0]}{comment.profiles?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {comment.profiles?.first_name} {comment.profiles?.last_name}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        dans {comment.project}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.content}</p>
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
