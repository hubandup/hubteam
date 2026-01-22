import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Save, Trash2, FileText, ChevronDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  EmailTemplate,
} from '@/hooks/useEmailTemplates';

interface EmailTemplateManagerProps {
  currentSubject: string;
  currentMessage: string;
  onSelectTemplate: (subject: string, message: string) => void;
}

export function EmailTemplateManager({
  currentSubject,
  currentMessage,
  onSelectTemplate,
}: EmailTemplateManagerProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const handleSaveAsNew = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setShowSaveDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Veuillez entrer un nom pour le modèle');
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          name: templateName,
          subject: currentSubject,
          content: currentMessage,
        });
        toast.success('Modèle mis à jour');
      } else {
        await createTemplate.mutateAsync({
          name: templateName,
          subject: currentSubject,
          content: currentMessage,
        });
        toast.success('Modèle enregistré');
      }
      setShowSaveDialog(false);
      setTemplateName('');
      setEditingTemplate(null);
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleSelectTemplate = (template: EmailTemplate) => {
    onSelectTemplate(template.subject, template.content);
    toast.success(`Modèle "${template.name}" chargé`);
  };

  const handleUpdateExisting = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setShowSaveDialog(true);
  };

  const handleDeleteTemplate = async (template: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Supprimer le modèle "${template.name}" ?`)) {
      try {
        await deleteTemplate.mutateAsync(template.id);
        toast.success('Modèle supprimé');
      } catch (error) {
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isLoading}>
              <FileText className="h-4 w-4 mr-2" />
              Modèles
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {templates.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                Aucun modèle enregistré
              </div>
            ) : (
              templates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  className="flex items-center justify-between group"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <span className="truncate flex-1">{template.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateExisting(template);
                      }}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => handleDeleteTemplate(template, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveAsNew}
          disabled={!currentSubject.trim() && !currentMessage.trim()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Enregistrer comme modèle
        </Button>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Mettre à jour le modèle' : 'Enregistrer un nouveau modèle'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Nom du modèle</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ex: Première prise de contact"
              />
            </div>
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="rounded-md border p-3 bg-muted/50">
                <p className="font-medium text-sm">{currentSubject || '(Pas de sujet)'}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                  {currentMessage || '(Pas de contenu)'}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveTemplate} disabled={createTemplate.isPending || updateTemplate.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {editingTemplate ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
