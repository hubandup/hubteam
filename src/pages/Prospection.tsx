import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useProspectionContacts,
  useCreateProspectionContact,
  useUpdateProspectionContact,
  useDeleteProspectionContact,
  useBulkCreateProspectionContacts,
  PROSPECTION_STAGES,
  type ProspectionContact,
  type ProspectionStage,
} from '@/hooks/useProspectionContacts';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Upload, Download, Plus, MoreHorizontal, Linkedin, Mail, Phone, Building2,
  Columns3, List, Trash2, UserPlus, Sparkles, ExternalLink, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageLoader } from '@/components/PageLoader';
import * as XLSX from 'xlsx';

// ─── STAGES ────────────────────────────────────────────
const KANBAN_STAGES = PROSPECTION_STAGES;

// ─── ADD CONTACT DIALOG ────────────────────────────────
function AddContactDialog({ onAdd }: { onAdd: (c: Partial<ProspectionContact>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company: '', contact_name: '', job_title: '', linkedin_url: '', email: '', phone: '' });

  const handleSubmit = () => {
    if (!form.contact_name.trim() && !form.company.trim()) {
      toast.error('Renseignez au moins un nom ou une société');
      return;
    }
    onAdd(form);
    setForm({ company: '', contact_name: '', job_title: '', linkedin_url: '', email: '', phone: '' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau contact</DialogTitle>
          <DialogDescription>Ajoutez un contact de prospection</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Société</Label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Fonction</Label>
            <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EDIT CONTACT DIALOG ───────────────────────────────
function EditContactDialog({
  contact,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onAddToCRM,
}: {
  contact: ProspectionContact;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (c: Partial<ProspectionContact> & { id: string }) => void;
  onDelete: (id: string) => void;
  onAddToCRM: (c: ProspectionContact) => void;
}) {
  const [form, setForm] = useState({
    company: contact.company,
    contact_name: contact.contact_name,
    job_title: contact.job_title || '',
    linkedin_url: contact.linkedin_url || '',
    email: contact.email || '',
    phone: contact.phone || '',
    stage: contact.stage,
    notes: contact.notes || '',
  });

  const handleSave = () => {
    onSave({ id: contact.id, ...form });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le contact</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Société</Label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Fonction</Label>
            <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Étape</Label>
            <Select value={form.stage} onValueChange={(v) => setForm(f => ({ ...f, stage: v as ProspectionStage }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KANBAN_STAGES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => { onDelete(contact.id); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          </div>
          <div className="flex gap-2">
            {!contact.linked_client_id && (
              <Button variant="outline" size="sm" onClick={() => { onAddToCRM(contact); onOpenChange(false); }}>
                <UserPlus className="h-4 w-4 mr-1" /> Ajouter au CRM
              </Button>
            )}
            <Button onClick={handleSave}>Enregistrer</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── IMPORT DIALOG ─────────────────────────────────────
function ImportDialog({ onImport }: { onImport: (contacts: Partial<ProspectionContact>[]) => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Partial<ProspectionContact>[]>([]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      const contacts: Partial<ProspectionContact>[] = json.map(row => ({
        company: row['Société'] || row['Societe'] || row['Company'] || '',
        contact_name: row['Contacts'] || row['Contact'] || row['Nom'] || row['Name'] || '',
        job_title: row['Fonction'] || row['Job Title'] || row['Poste'] || '',
        linkedin_url: row['Linkedin'] || row['LinkedIn'] || row['linkedin'] || '',
        email: row['Mail'] || row['Email'] || row['email'] || '',
        phone: row['Numéro de téléphone'] || row['Téléphone'] || row['Phone'] || row['Tel'] || '',
      }));

      setPreview(contacts);
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirm = () => {
    if (preview.length === 0) return;
    onImport(preview);
    setPreview([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPreview([]); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" /> Importer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des contacts</DialogTitle>
          <DialogDescription>
            Importez un fichier XLS avec les colonnes : Société, Contacts, Fonction, LinkedIn, Mail, Numéro de téléphone
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input type="file" accept=".xls,.xlsx,.csv" onChange={handleFile} />
          {preview.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">{preview.length} contact(s) détecté(s)</p>
              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Société</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Fonction</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 50).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{c.company}</TableCell>
                        <TableCell className="text-sm">{c.contact_name}</TableCell>
                        <TableCell className="text-sm">{c.job_title}</TableCell>
                        <TableCell className="text-sm">{c.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {preview.length > 50 && <p className="text-xs text-muted-foreground mt-1">...et {preview.length - 50} autres</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={preview.length === 0}>
            Importer {preview.length} contact(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CONTACT ROW ───────────────────────────────────────
function ContactRow({
  contact,
  onClick,
  onStageChange,
}: {
  contact: ProspectionContact;
  onClick: () => void;
  onStageChange: (stage: ProspectionStage) => void;
}) {
  const stageInfo = KANBAN_STAGES.find(s => s.value === contact.stage) || KANBAN_STAGES[0];

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <TableCell className="font-medium">{contact.company || '—'}</TableCell>
      <TableCell>{contact.contact_name || '—'}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{contact.job_title || '—'}</TableCell>
      <TableCell>
        {contact.linkedin_url ? (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            onClick={e => e.stopPropagation()}
          >
            <Linkedin className="h-4 w-4" />
          </a>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-sm">{contact.email || '—'}</TableCell>
      <TableCell className="text-sm">{contact.phone || '—'}</TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        <Select value={contact.stage} onValueChange={v => onStageChange(v as ProspectionStage)}>
          <SelectTrigger className="h-7 w-auto border-0 p-0">
            <Badge className={`${stageInfo.color} text-xs whitespace-nowrap`}>{stageInfo.label}</Badge>
          </SelectTrigger>
          <SelectContent>
            {KANBAN_STAGES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {contact.linked_client_id && (
          <Badge variant="outline" className="text-xs">CRM</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── KANBAN CARD ───────────────────────────────────────
function KanbanCard({ contact, onClick }: { contact: ProspectionContact; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow mb-2" onClick={onClick}>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm truncate">{contact.contact_name || '—'}</p>
          {contact.linked_client_id && <Badge variant="outline" className="text-[10px] px-1">CRM</Badge>}
        </div>
        {contact.company && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {contact.company}
          </p>
        )}
        {contact.job_title && (
          <p className="text-xs text-muted-foreground">{contact.job_title}</p>
        )}
        <div className="flex gap-2 mt-1">
          {contact.linkedin_url && <Linkedin className="h-3 w-3 text-blue-600" />}
          {contact.email && <Mail className="h-3 w-3 text-muted-foreground" />}
          {contact.phone && <Phone className="h-3 w-3 text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── KANBAN VIEW ───────────────────────────────────────
function KanbanView({
  contacts,
  onContactClick,
  onStageChange,
}: {
  contacts: ProspectionContact[];
  onContactClick: (c: ProspectionContact) => void;
  onStageChange: (id: string, stage: ProspectionStage) => void;
}) {
  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {KANBAN_STAGES.map(stage => {
        const stageContacts = contacts.filter(c => c.stage === stage.value);
        return (
          <div key={stage.value} className="flex-shrink-0 w-[260px] flex flex-col">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Badge className={`${stage.color} text-xs`}>{stage.label}</Badge>
              <span className="text-xs text-muted-foreground font-medium">{stageContacts.length}</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 px-1">
                {stageContacts.map(c => (
                  <KanbanCard key={c.id} contact={c} onClick={() => onContactClick(c)} />
                ))}
                {stageContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Aucun contact</p>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────
export default function Prospection() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data: contacts = [], isLoading } = useProspectionContacts();
  const createContact = useCreateProspectionContact();
  const updateContact = useUpdateProspectionContact();
  const deleteContact = useDeleteProspectionContact();
  const bulkCreate = useBulkCreateProspectionContacts();

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [editContact, setEditContact] = useState<ProspectionContact | null>(null);

  const filtered = useMemo(() => {
    let result = contacts;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.company?.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.job_title?.toLowerCase().includes(q)
      );
    }

    if (filterStage !== 'all') {
      result = result.filter(c => c.stage === filterStage);
    }

    return result;
  }, [contacts, search, filterStage]);

  const handleCreate = useCallback(async (c: Partial<ProspectionContact>) => {
    try {
      await createContact.mutateAsync(c);
      toast.success('Contact ajouté');
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  }, [createContact]);

  const handleUpdate = useCallback(async (c: Partial<ProspectionContact> & { id: string }) => {
    try {
      await updateContact.mutateAsync(c);
      toast.success('Contact mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  }, [updateContact]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteContact.mutateAsync(id);
      toast.success('Contact supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  }, [deleteContact]);

  const handleImport = useCallback(async (rows: Partial<ProspectionContact>[]) => {
    try {
      await bulkCreate.mutateAsync(rows);
      toast.success(`${rows.length} contact(s) importé(s)`);
    } catch {
      toast.error("Erreur lors de l'import");
    }
  }, [bulkCreate]);

  const handleExport = useCallback(() => {
    const data = filtered.map(c => ({
      'Société': c.company,
      'Contacts': c.contact_name,
      'Fonction': c.job_title || '',
      'Linkedin': c.linkedin_url || '',
      'Mail': c.email || '',
      'Numéro de téléphone': c.phone || '',
      'Étape': KANBAN_STAGES.find(s => s.value === c.stage)?.label || c.stage,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prospection');
    XLSX.writeFile(wb, 'prospection-contacts.xlsx');
    toast.success('Export téléchargé');
  }, [filtered]);

  const handleAddToCRM = useCallback(async (contact: ProspectionContact) => {
    try {
      // Split contact_name into first/last
      const parts = contact.contact_name.trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      // Check for duplicate by email
      if (contact.email) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('email', contact.email)
          .maybeSingle();

        if (existing) {
          // Link to existing client
          await updateContact.mutateAsync({ id: contact.id, linked_client_id: existing.id });
          toast.success('Contact lié au client CRM existant');
          return;
        }
      }

      // Create new client
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          company: contact.company || 'N/A',
          first_name: firstName || 'N/A',
          last_name: lastName || 'N/A',
          email: contact.email || '',
          phone: contact.phone || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Link prospect to client
      await updateContact.mutateAsync({ id: contact.id, linked_client_id: newClient.id });
      toast.success('Contact ajouté au CRM !');
    } catch {
      toast.error("Erreur lors de l'ajout au CRM");
    }
  }, [updateContact]);

  const handleStageChange = useCallback(async (id: string, stage: ProspectionStage) => {
    try {
      await updateContact.mutateAsync({ id, stage });
    } catch {
      toast.error('Erreur lors du changement d\'étape');
    }
  }, [updateContact]);

  const handleEnrich = useCallback(() => {
    toast.info('Enrichissement automatique — Bientôt disponible ! Nous recommandons Dropcontact pour trouver les emails et profils LinkedIn.', { duration: 5000 });
  }, []);

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 pb-2 md:pb-4 bg-background">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground mb-0.5">Prospection</h1>
            <p className="text-muted-foreground text-xs md:text-base">
              {contacts.length} contact(s) • {contacts.filter(c => c.stage === 'meeting_planned').length} RDV planifié(s)
            </p>
          </div>
          {isMobile && <AddContactDialog onAdd={handleCreate} />}
        </div>

        {!isMobile && (
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleEnrich}>
              <Sparkles className="h-4 w-4" /> Enrichir
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" /> Exporter
            </Button>
            <ImportDialog onImport={handleImport} />
            <div className="flex gap-1 border rounded-md">
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')}>
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')}>
                <Columns3 className="h-4 w-4" />
              </Button>
            </div>
            <AddContactDialog onAdd={handleCreate} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 pb-2 md:pb-4 bg-background">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 bg-white dark:bg-background h-10 text-sm"
            />
          </div>
          {!isMobile && (
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Toutes les étapes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les étapes</SelectItem>
                {KANBAN_STAGES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {contacts.length === 0 ? 'Aucun contact de prospection' : 'Aucun résultat'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {contacts.length === 0 ? 'Importez un fichier XLS ou ajoutez un contact manuellement' : 'Essayez une autre recherche'}
            </p>
          </div>
        ) : viewMode === 'kanban' && !isMobile ? (
          <div className="h-full overflow-x-auto overflow-y-hidden px-1">
            <KanbanView
              contacts={filtered}
              onContactClick={c => setEditContact(c)}
              onStageChange={handleStageChange}
            />
          </div>
        ) : (
          <div className="overflow-auto h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Société</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Fonction</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Étape</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    onClick={() => setEditContact(c)}
                    onStageChange={stage => handleStageChange(c.id, stage)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editContact && (
        <EditContactDialog
          contact={editContact}
          open={!!editContact}
          onOpenChange={o => { if (!o) setEditContact(null); }}
          onSave={handleUpdate}
          onDelete={handleDelete}
          onAddToCRM={handleAddToCRM}
        />
      )}
    </div>
  );
}
