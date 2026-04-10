import { useState, useRef } from 'react';
import { createSafeHtml } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, Mail, Eye, ImagePlus, Loader2, X, Save, FileText, ChevronDown, Plus, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ProspectionContact } from '@/hooks/useProspectionContacts';
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  uploadEmailImage,
  EmailTemplate,
} from '@/hooks/useEmailTemplates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: ProspectionContact[];
}

const SHORTCODES = [
  { code: '{prénom}', label: 'Prénom' },
  { code: '{nom}', label: 'Nom' },
  { code: '{société}', label: 'Société' },
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 5;

function applyShortcodes(text: string, contact: ProspectionContact): string {
  return text
    .replace(/\{prénom\}/g, contact.first_name || '')
    .replace(/\{nom\}/g, contact.last_name || '')
    .replace(/\{société\}/g, contact.company || '');
}

export function SendEmailDialog({ open, onOpenChange, recipients }: SendEmailDialogProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [tab, setTab] = useState<'compose' | 'preview'>('compose');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [insertedImages, setInsertedImages] = useState<string[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const { data: templates = [], isLoading: loadingTemplates } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const eligibleRecipients = recipients.filter(r => r.email);
  const previewContact = eligibleRecipients[0] || recipients[0];

  const insertAtCursor = (text: string) => {
    const el = messageRef.current;
    if (!el) {
      setMessage(prev => prev + text);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const newMsg = message.slice(0, start) + text + message.slice(end);
    setMessage(newMsg);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    }, 0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG, GIF ou WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux. Maximum ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadEmailImage(file);
      const imageTag = `[Image: ${url}]`;
      insertAtCursor(`\n${imageTag}\n`);
      setInsertedImages(prev => [...prev, url]);
      toast.success('Image insérée');
    } catch {
      toast.error("Erreur lors de l'upload de l'image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) { toast.error('Veuillez renseigner un objet'); return; }
    if (!message.trim()) { toast.error('Veuillez renseigner un message'); return; }
    if (eligibleRecipients.length === 0) {
      toast.error('Aucun destinataire avec une adresse email');
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-prospection-email', {
        body: {
          recipients: eligibleRecipients.map(r => ({
            email: r.email,
            firstName: r.first_name || '',
            lastName: r.last_name || '',
            company: r.company || '',
          })),
          subject,
          message,
        },
      });

      if (error) throw error;
      toast.success(`Email envoyé à ${eligibleRecipients.length} destinataire(s)`);
      onOpenChange(false);
      setSubject('');
      setMessage('');
      setInsertedImages([]);
    } catch {
      toast.error("Erreur lors de l'envoi des emails");
    } finally {
      setIsSending(false);
    }
  };

  // ── Template handlers ──────────────────────────────────
  const handleSelectTemplate = (template: EmailTemplate) => {
    setSubject(template.subject);
    setMessage(template.content);
    toast.success(`Modèle "${template.name}" chargé`);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { toast.error('Veuillez entrer un nom pour le modèle'); return; }
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, name: templateName, subject, content: message });
        toast.success('Modèle mis à jour');
      } else {
        await createTemplate.mutateAsync({ name: templateName, subject, content: message });
        toast.success('Modèle enregistré');
      }
      setShowSaveDialog(false);
      setTemplateName('');
      setEditingTemplate(null);
    } catch {
      toast.error("Erreur lors de l'enregistrement du modèle");
    }
  };

  const handleDeleteTemplate = async (template: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le modèle "${template.name}" ?`)) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success('Modèle supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  // ── Preview renderer ───────────────────────────────────
  const renderPreview = () => {
    if (!previewContact) return message;
    let preview = applyShortcodes(message, previewContact);
    // Convert [Image: URL] to img tags
    preview = preview.replace(
      /\[Image:\s*(https?:\/\/[^\]]+)\]/g,
      '<img src="$1" alt="Image" style="max-width:100%;height:auto;margin:10px 0;" />'
    );
    preview = preview.replace(/\n/g, '<br />');
    return preview;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Envoyer un email
            </DialogTitle>
            <DialogDescription>
              {eligibleRecipients.length} destinataire(s) avec email
              {recipients.length - eligibleRecipients.length > 0 && (
                <span className="text-destructive ml-1">
                  • {recipients.length - eligibleRecipients.length} sans email (ignoré)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Toolbar: Templates + Shortcodes */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Templates dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={loadingTemplates}>
                    <FileText className="h-4 w-4 mr-1.5" />
                    Modèles
                    <ChevronDown className="h-4 w-4 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {templates.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      Aucun modèle enregistré
                    </div>
                  ) : (
                    templates.map(t => (
                      <DropdownMenuItem
                        key={t.id}
                        className="flex items-center justify-between group"
                        onClick={() => handleSelectTemplate(t)}
                      >
                        <span className="truncate flex-1">{t.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={e => { e.stopPropagation(); setEditingTemplate(t); setTemplateName(t.name); setShowSaveDialog(true); }}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                            onClick={e => handleDeleteTemplate(t, e)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Save as template */}
              <Button
                variant="outline" size="sm"
                onClick={() => { setEditingTemplate(null); setTemplateName(''); setShowSaveDialog(true); }}
                disabled={!subject.trim() && !message.trim()}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Enregistrer comme modèle
              </Button>

              <div className="h-4 w-px bg-border mx-1" />

              {/* Shortcodes */}
              <span className="text-xs text-muted-foreground">Insérer :</span>
              {SHORTCODES.map(s => (
                <Button
                  key={s.code}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2 font-mono"
                  onClick={() => insertAtCursor(s.code)}
                >
                  {s.code}
                </Button>
              ))}
            </div>

            <Tabs value={tab} onValueChange={v => setTab(v as 'compose' | 'preview')} className="flex-1 flex flex-col min-h-0">
              <TabsList className="self-start">
                <TabsTrigger value="compose">Rédiger</TabsTrigger>
                <TabsTrigger value="preview" disabled={!message.trim()}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Aperçu
                  {previewContact && (
                    <span className="ml-1 text-muted-foreground font-normal">
                      ({previewContact.first_name || previewContact.contact_name})
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compose" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
                {/* Subject */}
                <div className="space-y-1.5">
                  <Label>Objet</Label>
                  <Input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Objet de l'email"
                  />
                </div>

                {/* Message */}
                <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                  <Label>Message</Label>
                  <Textarea
                    ref={messageRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Rédigez votre message... Utilisez {prénom}, {nom}, {société} pour personnaliser."
                    className="flex-1 min-h-[200px] resize-none font-mono text-sm"
                  />
                </div>

                {/* Image upload */}
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(',')}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage
                      ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      : <ImagePlus className="h-4 w-4 mr-1.5" />
                    }
                    Insérer une image
                  </Button>
                  <span className="text-xs text-muted-foreground">JPG, PNG, GIF, WebP • Max {MAX_IMAGE_SIZE_MB}MB</span>

                  {insertedImages.length > 0 && (
                    <div className="flex gap-1.5 ml-1">
                      {insertedImages.map((url, i) => (
                        <div key={url} className="relative group">
                          <img src={url} alt="" className="h-8 w-8 object-cover rounded border" />
                          <button
                            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            onClick={() => setInsertedImages(prev => prev.filter((_, j) => j !== i))}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="preview" className="flex-1 min-h-0 mt-3">
                {previewContact && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">Aperçu pour :</span>
                    <Badge variant="secondary" className="text-xs">
                      {[previewContact.first_name, previewContact.last_name].filter(Boolean).join(' ') || previewContact.contact_name}
                      {previewContact.company && ` — ${previewContact.company}`}
                    </Badge>
                  </div>
                )}
                <ScrollArea className="h-[350px] border rounded-lg">
                  <div className="p-4 bg-background">
                    {subject && (
                      <p className="font-semibold text-base mb-3 pb-2 border-b">
                        {previewContact ? applyShortcodes(subject, previewContact) : subject}
                      </p>
                    )}
                    <div
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={createSafeHtml(renderPreview())}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || eligibleRecipients.length === 0}
              className="gap-2"
            >
              {isSending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
              Envoyer à {eligibleRecipients.length} contact(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save template dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Mettre à jour le modèle' : 'Enregistrer un modèle'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom du modèle</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Ex: Première prise de contact"
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="rounded-md border p-3 bg-muted/50">
                <p className="font-medium text-sm">{subject || '(Pas de sujet)'}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3 whitespace-pre-line">
                  {message || '(Pas de contenu)'}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Annuler</Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplate.isPending || updateTemplate.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {editingTemplate ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
