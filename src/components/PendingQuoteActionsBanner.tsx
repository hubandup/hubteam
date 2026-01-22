import { useState, useEffect } from 'react';
import { FileText, FolderPlus, Link2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PendingQuoteAction {
  id: string;
  quote_id: number;
  quote_ref: string;
  quote_title: string;
  customer_id: number;
  customer_name: string | null;
  amount: number | null;
  status: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

export function PendingQuoteActionsBanner() {
  const [pendingActions, setPendingActions] = useState<PendingQuoteAction[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<PendingQuoteAction | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (role === 'admin' || role === 'team') {
      fetchPendingActions();
      fetchProjects();
    }
  }, [role]);

  const fetchPendingActions = async () => {
    const { data, error } = await supabase
      .from('pending_quote_actions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending quote actions:', error);
      return;
    }

    setPendingActions(data || []);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('archived', false)
      .order('name');

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    setProjects(data || []);
  };

  const handleCreateProject = async (action: PendingQuoteAction) => {
    setIsLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Find client by facturation_pro_id
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('facturation_pro_id', action.customer_id.toString())
        .single();

      // Create the project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: action.quote_title,
          description: `Projet créé depuis le devis ${action.quote_ref}`,
          status: 'active',
          start_date: new Date().toISOString().split('T')[0],
          created_by: user.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Link project to client if found
      if (client) {
        await supabase
          .from('project_clients')
          .insert({
            project_id: newProject.id,
            client_id: client.id,
          });
      }

      // Update pending action status
      const { error: updateError } = await supabase
        .from('pending_quote_actions')
        .update({
          status: 'created',
          linked_project_id: newProject.id,
          actioned_at: new Date().toISOString(),
          actioned_by: user.id,
        })
        .eq('id', action.id);

      if (updateError) throw updateError;

      toast.success(`Projet "${action.quote_title}" créé avec succès`);
      fetchPendingActions();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Erreur lors de la création du projet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkToProject = async () => {
    if (!selectedAction || !selectedProjectId) return;
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Find client by facturation_pro_id
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('facturation_pro_id', selectedAction.customer_id.toString())
        .single();

      // Link client to project if found and not already linked
      if (client) {
        const { data: existingLink } = await supabase
          .from('project_clients')
          .select('id')
          .eq('project_id', selectedProjectId)
          .eq('client_id', client.id)
          .single();

        if (!existingLink) {
          await supabase
            .from('project_clients')
            .insert({
              project_id: selectedProjectId,
              client_id: client.id,
            });
        }
      }

      // Update pending action status
      const { error: updateError } = await supabase
        .from('pending_quote_actions')
        .update({
          status: 'linked',
          linked_project_id: selectedProjectId,
          actioned_at: new Date().toISOString(),
          actioned_by: user.id,
        })
        .eq('id', selectedAction.id);

      if (updateError) throw updateError;

      toast.success('Devis associé au projet avec succès');
      setShowLinkDialog(false);
      setSelectedAction(null);
      setSelectedProjectId('');
      fetchPendingActions();
    } catch (error) {
      console.error('Error linking to project:', error);
      toast.error('Erreur lors de l\'association au projet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async (action: PendingQuoteAction) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('pending_quote_actions')
        .update({
          status: 'dismissed',
          actioned_at: new Date().toISOString(),
          actioned_by: user?.id,
        })
        .eq('id', action.id);

      fetchPendingActions();
    } catch (error) {
      console.error('Error dismissing action:', error);
    }
  };

  const openLinkDialog = (action: PendingQuoteAction) => {
    setSelectedAction(action);
    setSelectedProjectId('');
    setShowLinkDialog(true);
  };

  if (pendingActions.length === 0 || (role !== 'admin' && role !== 'team')) {
    return null;
  }

  return (
    <>
      <Card className="border-primary/50 bg-primary/5 mb-4">
        <div className="p-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">
                {pendingActions.length} devis accepté{pendingActions.length > 1 ? 's' : ''} en attente d'action
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-3">
              {pendingActions.map((action) => (
                <div 
                  key={action.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-background rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      Devis {action.quote_ref} - {action.quote_title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {action.customer_name}
                      {action.amount && ` • ${action.amount.toLocaleString('fr-FR')} €`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLinkDialog(action)}
                      disabled={isLoading}
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      Associer
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateProject(action)}
                      disabled={isLoading}
                    >
                      <FolderPlus className="h-4 w-4 mr-1" />
                      Créer le projet
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleDismiss(action)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associer à un projet existant</DialogTitle>
            <DialogDescription>
              Sélectionnez le projet auquel associer le devis "{selectedAction?.quote_title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un projet..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleLinkToProject} 
              disabled={!selectedProjectId || isLoading}
            >
              Associer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
