import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateProspect } from '@/hooks/useProspects';
import * as XLSX from 'xlsx';

const PROSPECT_FIELDS = [
  { key: 'company_name', label: 'Entreprise', required: true },
  { key: 'contact_name', label: 'Nom du contact', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Téléphone', required: false },
  { key: 'linkedin_url', label: 'LinkedIn URL', required: false },
  { key: 'channel', label: 'Canal', required: false },
  { key: 'status', label: 'Statut', required: false },
  { key: 'priority', label: 'Priorité', required: false },
  { key: 'estimated_amount', label: 'Montant estimé', required: false },
  { key: 'need_summary', label: 'Résumé du besoin', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'referrer', label: 'Référent', required: false },
] as const;

type ProspectFieldKey = typeof PROSPECT_FIELDS[number]['key'];

interface ImportProspectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'mapping' | 'preview';

export function ImportProspectsDialog({ open, onOpenChange }: ImportProspectsDialogProps) {
  const createProspect = useCreateProspect();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ProspectFieldKey | ''>>({}); 
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: number } | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImporting(false);
    setImportResults(null);
  }, []);

  const handleClose = useCallback((open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  }, [onOpenChange, reset]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error('Format non supporté. Utilisez .xlsx, .xls ou .csv');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        if (jsonData.length === 0) {
          toast.error('Le fichier est vide');
          return;
        }

        const fileHeaders = Object.keys(jsonData[0]);
        setHeaders(fileHeaders);
        setRows(jsonData);

        // Auto-map columns by matching names
        const autoMapping: Record<string, ProspectFieldKey | ''> = {};
        fileHeaders.forEach(header => {
          const normalized = header.toLowerCase().trim();
          const match = PROSPECT_FIELDS.find(f => {
            const fieldNorm = f.label.toLowerCase();
            return normalized === fieldNorm || 
              normalized.includes(fieldNorm) || 
              fieldNorm.includes(normalized) ||
              normalized === f.key.toLowerCase() ||
              // Common French synonyms
              (f.key === 'company_name' && (normalized.includes('société') || normalized.includes('entreprise') || normalized.includes('company'))) ||
              (f.key === 'contact_name' && (normalized.includes('contact') || normalized.includes('nom') || normalized.includes('name'))) ||
              (f.key === 'email' && (normalized.includes('email') || normalized.includes('e-mail') || normalized.includes('mail'))) ||
              (f.key === 'phone' && (normalized.includes('téléphone') || normalized.includes('tel') || normalized.includes('phone'))) ||
              (f.key === 'linkedin_url' && (normalized.includes('linkedin'))) ||
              (f.key === 'notes' && (normalized.includes('note') || normalized.includes('commentaire'))) ||
              (f.key === 'estimated_amount' && (normalized.includes('montant') || normalized.includes('budget') || normalized.includes('amount')));
          });
          autoMapping[header] = match?.key || '';
        });
        setMapping(autoMapping);
        setStep('mapping');
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Erreur lors de la lecture du fichier');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const requiredFieldsMapped = useMemo(() => {
    const mappedFields = new Set(Object.values(mapping).filter(Boolean));
    return PROSPECT_FIELDS.filter(f => f.required).every(f => mappedFields.has(f.key));
  }, [mapping]);

  const previewData = useMemo(() => {
    return rows.slice(0, 5).map(row => {
      const mapped: Record<string, string> = {};
      Object.entries(mapping).forEach(([header, field]) => {
        if (field) {
          mapped[field] = String(row[header] || '').trim();
        }
      });
      return mapped;
    });
  }, [rows, mapping]);

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const prospectData: Record<string, any> = {};
        Object.entries(mapping).forEach(([header, field]) => {
          if (field) {
            const value = String(row[header] || '').trim();
            if (field === 'estimated_amount') {
              prospectData[field] = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
            } else {
              prospectData[field] = value;
            }
          }
        });

        // Skip rows with empty required fields
        if (!prospectData.company_name || !prospectData.contact_name || !prospectData.email) {
          errors++;
          continue;
        }

        // Set defaults for unmapped fields
        if (!prospectData.status) prospectData.status = 'À contacter';
        if (!prospectData.priority) prospectData.priority = 'B';
        if (!prospectData.channel) prospectData.channel = 'Email';
        if (!prospectData.estimated_amount) prospectData.estimated_amount = 0;
        if (!prospectData.probability) prospectData.probability = 0.5;
        prospectData.offer_tags = [];

        await createProspect.mutateAsync(prospectData);
        success++;
      } catch (error) {
        console.error('Error importing row:', error);
        errors++;
      }
    }

    setImportResults({ success, errors });
    setImporting(false);

    if (success > 0) {
      toast.success(`${success} prospect(s) importé(s) avec succès`);
    }
    if (errors > 0) {
      toast.error(`${errors} ligne(s) en erreur`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer des contacts
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Sélectionnez un fichier Excel (.xlsx, .xls) ou CSV contenant vos contacts.'}
            {step === 'mapping' && 'Associez les colonnes du fichier aux champs de la base Prospection.'}
            {step === 'preview' && 'Vérifiez les données avant l\'import.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 pb-2">
          {(['upload', 'mapping', 'preview'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                step === s ? 'bg-primary text-primary-foreground' : 
                (['mapping', 'preview'].indexOf(step) > ['mapping', 'preview'].indexOf(s) || (step !== 'upload' && s === 'upload'))
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs ${step === s ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {s === 'upload' ? 'Fichier' : s === 'mapping' ? 'Correspondance' : 'Aperçu'}
              </span>
              {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Glissez votre fichier ici ou cliquez pour sélectionner
                </p>
                <Label htmlFor="prospect-file-upload" className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span>Choisir un fichier</span>
                  </Button>
                </Label>
                <Input
                  id="prospect-file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Formats acceptés : .xlsx, .xls, .csv
              </p>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{fileName}</span>
                <Badge variant="secondary">{rows.length} ligne(s)</Badge>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-4">
                  {headers.map(header => (
                    <div key={header} className="flex items-center gap-3">
                      <div className="w-1/3 text-sm font-medium truncate" title={header}>
                        {header}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
                          {PROSPECT_FIELDS.map(field => {
                            const alreadyUsed = Object.entries(mapping).some(
                              ([h, v]) => v === field.key && h !== header
                            );
                            return (
                              <SelectItem
                                key={field.key}
                                value={field.key}
                                disabled={alreadyUsed}
                              >
                                {field.label} {field.required && '*'}
                                {alreadyUsed && ' (déjà assigné)'}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {!requiredFieldsMapped && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Les champs obligatoires (Entreprise, Nom du contact, Email) doivent être associés.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {importResults ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    importResults.errors === 0 ? 'bg-primary/10' : 'bg-destructive/10'
                  }`}>
                    {importResults.errors === 0 ? (
                      <Check className="h-8 w-8 text-primary" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-destructive" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">Import terminé</p>
                    <p className="text-sm text-muted-foreground">
                      {importResults.success} importé(s), {importResults.errors} erreur(s)
                    </p>
                  </div>
                  <Button onClick={() => handleClose(false)}>Fermer</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Aperçu des 5 premières lignes sur {rows.length} au total</span>
                  </div>

                  <ScrollArea className="h-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {PROSPECT_FIELDS
                            .filter(f => Object.values(mapping).includes(f.key))
                            .map(f => (
                              <TableHead key={f.key} className="whitespace-nowrap">
                                {f.label}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, i) => (
                          <TableRow key={i}>
                            {PROSPECT_FIELDS
                              .filter(f => Object.values(mapping).includes(f.key))
                              .map(f => (
                                <TableCell key={f.key} className="text-sm max-w-[200px] truncate">
                                  {row[f.key] || <span className="text-muted-foreground italic">—</span>}
                                </TableCell>
                              ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </div>
          )}
        </div>

        {!importResults && (
          <DialogFooter className="gap-2">
            {step !== 'upload' && (
              <Button
                variant="outline"
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                disabled={importing}
              >
                Retour
              </Button>
            )}
            {step === 'mapping' && (
              <Button
                onClick={() => setStep('preview')}
                disabled={!requiredFieldsMapped}
              >
                Suivant
              </Button>
            )}
            {step === 'preview' && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Import en cours...' : `Importer ${rows.length} contact(s)`}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
