import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, FolderKanban, CheckSquare, DollarSign, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function Dashboard() {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
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

      // Fetch projects with tasks for progress calculation
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          status,
          tasks (
            id,
            status
          )
        `)
        .neq('status', 'completed');

      if (projectsError) throw projectsError;

      const projectsProgress = projects?.map(project => {
        const tasks = project.tasks || [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t: any) => t.status === 'done').length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        return {
          ...project,
          totalTasks,
          completedTasks,
          progress,
        };
      }) || [];

      // Fetch tasks in progress
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('status', 'in_progress');

      if (tasksError) throw tasksError;

      // Fetch top 3 clients by revenue
      const { data: topClientsData, error: topClientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('active', true)
        .order('revenue', { ascending: false })
        .limit(3);

      if (topClientsError) throw topClientsError;

      // Fetch recent comments
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles (
            first_name,
            last_name
          ),
          tasks (
            title
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (commentsError) throw commentsError;

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
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
      </div>

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
                {projectsWithProgress.map((project) => (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{project.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {project.completedTasks}/{project.totalTasks} tâches
                      </span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {project.progress.toFixed(1)}% complété
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Top 3 Clients</CardTitle>
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
                        sur {comment.tasks?.title}
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
