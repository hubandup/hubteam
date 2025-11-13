import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ProtectedAction } from "@/components/ProtectedAction";

export default function ArchivedProjects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["archived-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          project_clients(
            client:clients(id, company)
          )
        `)
        .eq("archived", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ archived: false })
        .eq("id", projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projet désarchivé avec succès");
    },
    onError: (error) => {
      console.error("Error unarchiving project:", error);
      toast.error("Erreur lors de la désarchivation du projet");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
      toast.success("Projet supprimé avec succès");
      setProjectToDelete(null);
    },
    onError: (error) => {
      console.error("Error deleting project:", error);
      toast.error("Erreur lors de la suppression du projet");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Archive className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold">Projets archivés</h1>
            <p className="text-muted-foreground">
              {projects?.length || 0} projet(s) archivé(s)
            </p>
          </div>
        </div>
      </div>

      {!projects || projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun projet archivé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const client = project.project_clients?.[0]?.client;
            
            return (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{project.name}</CardTitle>
                      {client && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Client: {client.company}
                        </p>
                      )}
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <ProtectedAction module="projects" action="update">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </ProtectedAction>
                      <ProtectedAction module="projects" action="update">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unarchiveMutation.mutate(project.id)}
                          disabled={unarchiveMutation.isPending}
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                      </ProtectedAction>
                      <ProtectedAction module="projects" action="delete">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProjectToDelete(project.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ProtectedAction>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {project.start_date && (
                      <div>
                        Début: {format(new Date(project.start_date), "d MMM yyyy", { locale: fr })}
                      </div>
                    )}
                    {project.end_date && (
                      <div>
                        Fin: {format(new Date(project.end_date), "d MMM yyyy", { locale: fr })}
                      </div>
                    )}
                    <div>
                      Archivé: {format(new Date(project.updated_at), "d MMM yyyy à HH:mm", { locale: fr })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement ce projet ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && deleteMutation.mutate(projectToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
