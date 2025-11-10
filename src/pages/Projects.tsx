import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectKanbanView } from '@/components/ProjectKanbanView';
import { ProjectListView } from '@/components/ProjectListView';
import { AddProjectDialog } from '@/components/AddProjectDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, LayoutGrid, List, Kanban } from 'lucide-react';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';

export default function Projects() {
  const navigate = useNavigate();
  const { canRead } = usePermissions();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'kanban' | 'list'>('grid');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_clients (
            clients (
              company,
              logo_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId);

      if (error) throw error;

      // Update local state
      setProjects(prev =>
        prev.map(p =>
          p.id === projectId ? { ...p, status: newStatus } : p
        )
      );

      toast.success('Statut du projet mis à jour');
    } catch (error) {
      console.error('Error updating project status:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(project => project.status === activeTab);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.project_clients?.[0]?.clients?.company?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [projects, activeTab, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canRead('projects')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder aux projets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projets</h1>
          <p className="text-muted-foreground">Gérez tous vos projets</p>
        </div>
        <ProtectedAction module="projects" action="create">
          <AddProjectDialog onProjectAdded={fetchProjects} />
        </ProtectedAction>
      </div>

      {projects.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
            >
              <Kanban className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Tous ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="planning">
            Planification ({projects.filter(p => p.status === 'planning').length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Actifs ({projects.filter(p => p.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Terminés ({projects.filter(p => p.status === 'completed').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeTab === 'all' 
                  ? 'Aucun projet pour le moment' 
                  : `Aucun projet ${activeTab === 'planning' ? 'en planification' : activeTab === 'active' ? 'actif' : 'terminé'}`
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Commencez par créer un nouveau projet
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => navigate(`/project/${project.id}`)}
                />
              ))}
            </div>
          ) : viewMode === 'kanban' ? (
            <ProjectKanbanView 
              projects={filteredProjects}
              onProjectClick={(id) => navigate(`/project/${id}`)}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <ProjectListView 
              projects={filteredProjects}
              onProjectClick={(id) => navigate(`/project/${id}`)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
