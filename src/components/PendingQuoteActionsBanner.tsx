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
  const {
    role
  } = useUserRole();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (role === 'admin' || role === 'team') {
      fetchPendingActions();
      fetchProjects();
    }
  }, [role]);
  const fetchPendingActions = async () => {
    const {
      data,
      error
    } = await supabase.from('pending_quote_actions').select('*').eq('status', 'pending').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching pending quote actions:', error);
      return;
    }
    setPendingActions(data || []);
  };
  const fetchProjects = async () => {
    const {
      data,
      error
    } = await supabase.from('projects').select('id, name').eq('archived', false).order('name');
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Find client by facturation_pro_id
      const {
        data: client
      } = await supabase.from('clients').select('id').eq('facturation_pro_id', action.customer_id.toString()).single();

      // Create the project
      const {
        data: newProject,
        error: projectError
      } = await supabase.from('projects').insert({
        name: action.quote_title,
        description: `Projet créé depuis le devis ${action.quote_ref}`,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        created_by: user.id
      }).select().single();
      if (projectError) throw projectError;

      // Link project to client if found
      if (client) {
        await supabase.from('project_clients').insert({
          project_id: newProject.id,
          client_id: client.id
        });
      }

      // Update pending action status
      const {
        error: updateError
      } = await supabase.from('pending_quote_actions').update({
        status: 'created',
        linked_project_id: newProject.id,
        actioned_at: new Date().toISOString(),
        actioned_by: user.id
      }).eq('id', action.id);
      if (updateError) throw updateError;
      toast.success(`Projet "${action.quote_title}" créé avec succès`);
      fetchPendingActions();
      queryClient.invalidateQueries({
        queryKey: ['projects']
      });
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Find client by facturation_pro_id
      const {
        data: client
      } = await supabase.from('clients').select('id').eq('facturation_pro_id', selectedAction.customer_id.toString()).single();

      // Link client to project if found and not already linked
      if (client) {
        const {
          data: existingLink
        } = await supabase.from('project_clients').select('id').eq('project_id', selectedProjectId).eq('client_id', client.id).single();
        if (!existingLink) {
          await supabase.from('project_clients').insert({
            project_id: selectedProjectId,
            client_id: client.id
          });
        }
      }

      // Update pending action status
      const {
        error: updateError
      } = await supabase.from('pending_quote_actions').update({
        status: 'linked',
        linked_project_id: selectedProjectId,
        actioned_at: new Date().toISOString(),
        actioned_by: user.id
      }).eq('id', selectedAction.id);
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      await supabase.from('pending_quote_actions').update({
        status: 'dismissed',
        actioned_at: new Date().toISOString(),
        actioned_by: user?.id
      }).eq('id', action.id);
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
  if (pendingActions.length === 0 || role !== 'admin' && role !== 'team') {
    return null;
  }
  return <>
      <div className="mb-6 overflow-hidden rounded-2xl border border-border/50 border-l-4 border-l-[#E8FF4C] shadow-md shadow-black/10 dark:shadow-black/30 bg-white dark:bg-card">
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#E8FF4C]/5 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border-0 border-white rounded-none shadow-none opacity-100 my-0 mt-0 pt-0 flex-row flex items-start justify-center gap-0">
              <FileText className="h-5 w-5 text-[#014a94] dark:text-[#E8FF4C]" />
            </div>
            <div>
              <span className="font-semibold text-foreground">
                {pendingActions.length} devis accepté{pendingActions.length > 1 ? 's' : ''} en attente d'action
              </span>
              <p className="text-xs text-muted-foreground">
                Créez ou associez un projet pour chaque devis
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#E8FF4C]/20">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {isExpanded && <div className="px-4 pb-4">
            <div className="divide-y divide-border/40">
              {pendingActions.map(action => <div key={action.id} className="group flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground leading-relaxed">
                        <span className="text-muted-foreground font-normal">{action.quote_ref}</span> — {action.quote_title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Client : {action.customer_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="h-8 rounded-lg border-border/60 hover:border-primary/50 hover:bg-primary/5" onClick={() => openLinkDialog(action)} disabled={isLoading}>
                        <Link2 className="h-3.5 w-3.5 mr-1.5" />
                        Associer
                      </Button>
                      <Button size="sm" className="h-8 rounded-lg bg-[#014a94] hover:bg-[#014a94]/90 text-white shadow-sm" onClick={() => handleCreateProject(action)} disabled={isLoading}>
                        <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                        Créer le projet
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full opacity-40 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDismiss(action)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>)}
            </div>
          </div>}
      </div>

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
                {projects.map(project => <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleLinkToProject} disabled={!selectedProjectId || isLoading}>
              Associer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>;
}