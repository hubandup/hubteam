import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProjectCard } from '@/components/ProjectCard';
import { AddProjectDialog } from '@/components/AddProjectDialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

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
              company
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

  const filteredProjects = projects.filter(project => {
    if (activeTab === 'all') return true;
    return project.status === activeTab;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <AddProjectDialog onProjectAdded={fetchProjects} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Tous ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Actifs ({projects.filter(p => p.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            En attente ({projects.filter(p => p.status === 'pending').length})
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
                  : `Aucun projet ${activeTab === 'active' ? 'actif' : activeTab === 'pending' ? 'en attente' : 'terminé'}`
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Commencez par créer un nouveau projet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => navigate(`/project/${project.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
