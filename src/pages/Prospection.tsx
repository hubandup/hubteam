import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, Upload, Download, Plus, Linkedin, Mail, Phone, Building2,
  Columns3, List, Trash2, UserPlus, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageLoader } from '@/components/PageLoader';
import * as XLSX from 'xlsx';

type SortKey = 'company' | 'first_name' | 'last_name' | 'contact_name' | 'job_title' | 'email' | 'phone' | 'stage';
type SortDir = 'asc' | 'desc';

// ─── STAGES ────────────────────────────────────────────
const KANBAN_STAGES = PROSPECTION_STAGES;

// ─── ADD CONTACT DIALOG ────────────────────────────────
function AddContactDialog({ onAdd }: { onAdd: (c: Partial<ProspectionContact>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company: '', first_name: '', last_name: '', contact_name: '', job_title: '', linkedin_url: '', email: '', phone: '' });

  const handleSubmit = () => {
    if (!form.first_name.trim() && !form.last_name.trim() && !form.company.trim()) {
      toast.error('Renseignez au moins un nom ou une société');
      return;
    }
    const contactName = `${form.first_name} ${form.last_name}`.trim();
    onAdd({ ...form, contact_name: contactName || form.contact_name });
    setForm({ company: '', first_name: '', last_name: '', contact_name: '', job_title: '', linkedin_url: '', email: '', phone: '' });
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
              <Label>Prénom</Label>
              <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <Label>Nom</Label>
              <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Société</Label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <Label>Fonction</Label>
              <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
            </div>
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
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
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
              <Label>Prénom</Label>
              <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <Label>Nom</Label>
              <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Société</Label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <Label>Fonction</Label>
              <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
            </div>
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

// ─── IMPORT DIALOG WITH COLUMN MAPPING ─────────────────
const PROSPECTION_FIELDS = [
  { key: 'first_name', label: 'Prénom', required: false },
  { key: 'last_name', label: 'Nom', required: false },
  { key: 'company', label: 'Société', required: false },
  { key: 'contact_name', label: 'Contact (Prénom Nom)', required: false },
  { key: 'job_title', label: 'Fonction', required: false },
  { key: 'linkedin_url', label: 'LinkedIn', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Téléphone', required: false },
] as const;

type ProspectFieldKey = typeof PROSPECTION_FIELDS[number]['key'];
type ImportStep = 'upload' | 'mapping' | 'preview';

function ImportDialog({ onImport }: { onImport: (contacts: Partial<ProspectionContact>[]) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ProspectFieldKey | ''>>({});

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

        if (json.length === 0) {
          toast.error('Le fichier est vide');
          return;
        }

        const fileHeaders = Object.keys(json[0]);
        setHeaders(fileHeaders);
        setRows(json);

        // Auto-mapping by name similarity
        const autoMap: Record<string, ProspectFieldKey | ''> = {};
        fileHeaders.forEach(h => {
          const norm = h.toLowerCase().trim();
          const match = PROSPECTION_FIELDS.find(f => {
            const fl = f.label.toLowerCase();
            return norm === fl || norm.includes(fl) || fl.includes(norm) ||
              norm === f.key.toLowerCase() ||
              (f.key === 'first_name' && (norm.includes('prénom') || norm.includes('prenom') || norm === 'first name' || norm === 'firstname')) ||
              (f.key === 'last_name' && (norm === 'nom' || norm === 'last name' || norm === 'lastname' || norm === 'nom de famille')) ||
              (f.key === 'company' && (norm.includes('société') || norm.includes('societe') || norm.includes('entreprise') || norm.includes('company'))) ||
              (f.key === 'contact_name' && (norm.includes('contact') || norm.includes('nom complet') || norm.includes('full name'))) ||
              (f.key === 'job_title' && (norm.includes('fonction') || norm.includes('poste') || norm.includes('title') || norm.includes('job'))) ||
              (f.key === 'linkedin_url' && (norm.includes('linkedin'))) ||
              (f.key === 'email' && (norm.includes('email') || norm.includes('e-mail') || norm.includes('mail'))) ||
              (f.key === 'phone' && (norm.includes('téléphone') || norm.includes('telephone') || norm.includes('tel') || norm.includes('phone') || norm.includes('numéro')));
          });
          autoMap[h] = match?.key || '';
        });
        setMapping(autoMap);
        setStep('mapping');
      } catch {
        toast.error('Erreur lors de la lecture du fichier');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const mappedFields = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);

  const previewData = useMemo(() => {
    return rows.slice(0, 10).map(row => {
      const mapped: Record<string, string> = {};
      Object.entries(mapping).forEach(([header, field]) => {
        if (field) mapped[field] = String(row[header] || '').trim();
      });
      return mapped;
    });
  }, [rows, mapping]);

  const handleConfirm = () => {
    const contacts: Partial<ProspectionContact>[] = rows.map(row => {
      const c: Record<string, string> = {};
      Object.entries(mapping).forEach(([header, field]) => {
        if (field) c[field] = String(row[header] || '').trim();
      });
      return c;
    });
    onImport(contacts);
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" /> Importer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer des contacts
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Sélectionnez un fichier Excel (.xlsx, .xls) ou CSV.'}
            {step === 'mapping' && 'Associez les colonnes de votre fichier aux champs de prospection.'}
            {step === 'preview' && 'Vérifiez les données avant import.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 pb-2">
          {(['upload', 'mapping', 'preview'] as ImportStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                step === s ? 'bg-primary text-primary-foreground' :
                (['upload', 'mapping', 'preview'].indexOf(step) > i) ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs ${step === s ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {s === 'upload' ? 'Fichier' : s === 'mapping' ? 'Correspondance' : 'Aperçu'}
              </span>
              {i < 2 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">Glissez votre fichier ou cliquez pour sélectionner</p>
                <Label htmlFor="prospection-file-upload" className="cursor-pointer">
                  <Button variant="outline" asChild><span>Choisir un fichier</span></Button>
                </Label>
                <Input id="prospection-file-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </div>
              <p className="text-xs text-muted-foreground">Formats acceptés : .xlsx, .xls, .csv</p>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{fileName}</Badge>
                <Badge variant="outline">{rows.length} ligne(s)</Badge>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-3 pr-4">
                  {headers.map(header => (
                    <div key={header} className="flex items-center gap-3">
                      <div className="w-1/3 text-sm font-medium truncate border rounded-md px-3 py-2 bg-muted/50" title={header}>
                        {header}
                      </div>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Select
                        value={mapping[header] || '_none'}
                        onValueChange={(value) => {
                          setMapping(prev => ({
                            ...prev,
                            [header]: value === '_none' ? '' : value as ProspectFieldKey,
                          }));
                        }}
                      >
                        <SelectTrigger className="w-2/3">
                          <SelectValue placeholder="Ne pas importer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">— Ne pas importer —</SelectItem>
                          {PROSPECTION_FIELDS.map(field => {
                            const alreadyUsed = Object.entries(mapping).some(
                              ([h, v]) => v === field.key && h !== header
                            );
                            return (
                              <SelectItem key={field.key} value={field.key} disabled={alreadyUsed}>
                                {field.label}{alreadyUsed ? ' (déjà assigné)' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {mappedFields.size === 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <span>Associez au moins une colonne pour continuer.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Aperçu des {Math.min(10, rows.length)} premières lignes sur {rows.length} au total
              </p>
              <ScrollArea className="h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {PROSPECTION_FIELDS.filter(f => mappedFields.has(f.key)).map(f => (
                        <TableHead key={f.key} className="whitespace-nowrap">{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        {PROSPECTION_FIELDS.filter(f => mappedFields.has(f.key)).map(f => (
                          <TableCell key={f.key} className="text-sm max-w-[200px] truncate">
                            {row[f.key] || <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step !== 'upload' && (
            <Button variant="outline" onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}>
              Retour
            </Button>
          )}
          {step === 'mapping' && (
            <Button onClick={() => setStep('preview')} disabled={mappedFields.size === 0}>
              Suivant
            </Button>
          )}
          {step === 'preview' && (
            <Button onClick={handleConfirm}>
              Importer {rows.length} contact(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── INLINE EDITABLE CELL ──────────────────────────────
function InlineEditCell({
  value,
  field,
  contactId,
  onSave,
  type = 'text',
  className = '',
}: {
  value: string;
  field: string;
  contactId: string;
  onSave: (id: string, field: string, value: string) => void;
  type?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(contactId, field, editValue);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditValue(value); setEditing(false); }
        }}
        className="h-7 text-sm px-1 min-w-[80px]"
      />
    );
  }

  return (
    <span
      className={`cursor-text hover:bg-muted/60 rounded px-1 py-0.5 inline-block min-w-[40px] ${className}`}
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="Cliquer pour modifier"
    >
      {value || '—'}
    </span>
  );
}

// ─── CONTACT ROW ───────────────────────────────────────
function ContactRow({
  contact,
  onFieldSave,
  onStageChange,
  selected,
  onToggleSelect,
}: {
  contact: ProspectionContact;
  onFieldSave: (id: string, field: string, value: string) => void;
  onStageChange: (stage: ProspectionStage) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const stageInfo = KANBAN_STAGES.find(s => s.value === contact.stage) || KANBAN_STAGES[0];

  return (
    <TableRow className={`hover:bg-muted/50 ${selected ? 'bg-primary/5' : ''}`}>
      <TableCell className="w-10 pr-0">
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(contact.id)} />
      </TableCell>
      <TableCell>
        <InlineEditCell value={contact.first_name || ''} field="first_name" contactId={contact.id} onSave={onFieldSave} />
      </TableCell>
      <TableCell>
        <InlineEditCell value={contact.last_name || ''} field="last_name" contactId={contact.id} onSave={onFieldSave} className="font-medium" />
      </TableCell>
      <TableCell>
        <InlineEditCell value={contact.company} field="company" contactId={contact.id} onSave={onFieldSave} />
      </TableCell>
      <TableCell>
        <InlineEditCell value={contact.job_title || ''} field="job_title" contactId={contact.id} onSave={onFieldSave} className="text-muted-foreground" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <InlineEditCell value={contact.linkedin_url || ''} field="linkedin_url" contactId={contact.id} onSave={onFieldSave} className="text-sm max-w-[120px] truncate" />
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex-shrink-0">
              <Linkedin className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </TableCell>
      <TableCell>
        <InlineEditCell value={contact.email || ''} field="email" contactId={contact.id} onSave={onFieldSave} type="email" />
      </TableCell>
      <TableCell>
        <InlineEditCell value={contact.phone || ''} field="phone" contactId={contact.id} onSave={onFieldSave} type="tel" />
      </TableCell>
      <TableCell>
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
          <p className="font-medium text-sm truncate">{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.contact_name || '—'}</p>
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const filtered = useMemo(() => {
    let result = contacts;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.company?.toLowerCase().includes(q) ||
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.job_title?.toLowerCase().includes(q)
      );
    }

    if (filterStage !== 'all') {
      result = result.filter(c => c.stage === filterStage);
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = (a[sortKey] || '').toLowerCase();
        const bVal = (b[sortKey] || '').toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [contacts, search, filterStage, sortKey, sortDir]);

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

  const handleFieldSave = useCallback(async (id: string, field: string, value: string) => {
    try {
      await updateContact.mutateAsync({ id, [field]: value });
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

  const handleExport = useCallback((contactsToExport?: ProspectionContact[]) => {
    const source = contactsToExport || filtered;
    const data = source.map(c => ({
      'Prénom': c.first_name || '',
      'Nom': c.last_name || '',
      'Société': c.company,
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
    toast.success(`${source.length} contact(s) exporté(s)`);
  }, [filtered]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map(c => c.id));
    });
  }, [filtered]);

  const handleBulkExport = useCallback(() => {
    const selected = filtered.filter(c => selectedIds.has(c.id));
    handleExport(selected);
    setSelectedIds(new Set());
  }, [filtered, selectedIds, handleExport]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      try {
        await deleteContact.mutateAsync(id);
        deleted++;
      } catch { /* skip */ }
    }
    setSelectedIds(new Set());
    toast.success(`${deleted} contact(s) supprimé(s)`);
  }, [selectedIds, deleteContact]);

  const handleAddToCRM = useCallback(async (contact: ProspectionContact) => {
    try {
      // Use first_name/last_name if available, fallback to splitting contact_name
      const firstName = contact.first_name || contact.contact_name.trim().split(' ')[0] || '';
      const lastName = contact.last_name || contact.contact_name.trim().split(' ').slice(1).join(' ') || '';

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
            <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport()}>
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
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 bg-primary/10 border-b rounded-t-md">
                <span className="text-sm font-medium text-foreground">
                  {selectedIds.size} sélectionné(s)
                </span>
                <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={handleBulkExport}>
                  <Download className="h-3.5 w-3.5" /> Exporter
                </Button>
                <Button variant="destructive" size="sm" className="gap-1.5 h-7" onClick={handleBulkDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
                <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  {([
                    ['first_name', 'Prénom'],
                    ['last_name', 'Nom'],
                    ['company', 'Société'],
                    ['job_title', 'Fonction'],
                    ['linkedin_url', 'LinkedIn'],
                    ['email', 'Email'],
                    ['phone', 'Téléphone'],
                    ['stage', 'Étape'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <TableHead key={key}>
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => toggleSort(key)}
                      >
                        {label}
                        {sortKey === key ? (
                          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    onFieldSave={handleFieldSave}
                    onStageChange={stage => handleStageChange(c.id, stage)}
                    selected={selectedIds.has(c.id)}
                    onToggleSelect={toggleSelect}
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
