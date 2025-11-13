import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface ImportClientsValidationDialogProps {
  onClientsImported: () => void;
}

type ImportAction = 'skip' | 'update' | 'import';

interface ParsedClient {
  id: string;
  company: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  last_contact?: string;
  follow_up_date?: string;
  action: ImportAction;
  isDuplicate: boolean;
  duplicateReason?: string;
  existingClientId?: string;
  selected: boolean;
}

export function ImportClientsValidationDialog({ onClientsImported }: ImportClientsValidationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const splitName = (fullName: string): { first_name: string; last_name: string } => {
    if (!fullName) return { first_name: '', last_name: '' };
    
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: '' };
    }
    
    const last_name = parts.pop() || '';
    const first_name = parts.join(' ');
    return { first_name, last_name };
  };

  const parseDate = (dateStr: string): string | undefined => {
    if (!dateStr) return undefined;
    
    try {
      // Handle Excel date format (M/D/YY)
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        let year = parts[2];
        
        // Convert 2-digit year to 4-digit
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum > 50 ? `19${year}` : `20${year}`;
        }
        
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.error('Date parsing error:', e);
    }
    
    return undefined;
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setParsedClients([]);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          // Skip header row
          const rows = jsonData.slice(1) as any[][];

          // Fetch existing clients for duplicate detection
          const { data: existingClients } = await supabase
            .from('clients')
            .select('id, email, company');

          const emailMap = new Map(existingClients?.map(c => [c.email.toLowerCase(), c]) || []);
          const companyMap = new Map(existingClients?.map(c => [c.company.toLowerCase(), c]) || []);

          const parsed: ParsedClient[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Map columns: Nom, Date création, Dernier contact, E-mail, Nom du contact, Prochaine échéance, Responsable, Téléphone
            const company = row[0]?.toString().trim();
            const email = row[3]?.toString().trim().toLowerCase();
            const contactName = row[4]?.toString().trim();
            const phone = row[7]?.toString().trim();
            const lastContact = parseDate(row[2]?.toString());
            const followUpDate = parseDate(row[5]?.toString());

            // Skip empty rows
            if (!company && !email && !contactName) continue;

            // Skip rows with invalid data
            if (!company || !email || !validateEmail(email)) {
              toast.error(`Ligne ${i + 2}: Données invalides (entreprise ou email manquant/invalide)`);
              continue;
            }

            const { first_name, last_name } = splitName(contactName);

            // Check for duplicates
            let isDuplicate = false;
            let duplicateReason = '';
            let existingClientId = '';
            let defaultAction: ImportAction = 'import';

            const existingByEmail = emailMap.get(email);
            const existingByCompany = companyMap.get(company.toLowerCase());

            if (existingByEmail) {
              isDuplicate = true;
              duplicateReason = 'Email existant';
              existingClientId = existingByEmail.id;
              defaultAction = 'skip';
            } else if (existingByCompany) {
              isDuplicate = true;
              duplicateReason = 'Entreprise existante';
              existingClientId = existingByCompany.id;
              defaultAction = 'skip';
            }

            parsed.push({
              id: `import-${i}`,
              company,
              email,
              first_name,
              last_name,
              phone,
              last_contact: lastContact,
              follow_up_date: followUpDate,
              action: defaultAction,
              isDuplicate,
              duplicateReason,
              existingClientId,
              selected: !isDuplicate, // Auto-select non-duplicates
            });
          }

          setParsedClients(parsed);
          toast.success(`${parsed.length} clients analysés`);
        } catch (error) {
          console.error('Parse error:', error);
          toast.error('Erreur lors de l\'analyse du fichier');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('File read error:', error);
      toast.error('Erreur lors de la lecture du fichier');
      setLoading(false);
    }
  };

  const handleActionChange = (clientId: string, action: ImportAction) => {
    setParsedClients(prev =>
      prev.map(c => c.id === clientId ? { ...c, action } : c)
    );
  };

  const handleSelectChange = (clientId: string, selected: boolean) => {
    setParsedClients(prev =>
      prev.map(c => c.id === clientId ? { ...c, selected } : c)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setParsedClients(prev => prev.map(c => ({ ...c, selected })));
  };

  const handleImport = async () => {
    const selectedClients = parsedClients.filter(c => c.selected);
    
    if (selectedClients.length === 0) {
      toast.error('Aucun client sélectionné');
      return;
    }

    setImporting(true);

    try {
      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const client of selectedClients) {
        if (client.action === 'skip') {
          skipped++;
          continue;
        }

        const clientData = {
          company: client.company,
          email: client.email,
          first_name: client.first_name,
          last_name: client.last_name,
          phone: client.phone,
          last_contact: client.last_contact,
          follow_up_date: client.follow_up_date,
          active: true,
        };

        if (client.action === 'update' && client.existingClientId) {
          const { error } = await supabase
            .from('clients')
            .update(clientData)
            .eq('id', client.existingClientId);

          if (error) {
            console.error('Update error:', error);
            toast.error(`Erreur mise à jour: ${client.company}`);
          } else {
            updated++;
          }
        } else if (client.action === 'import') {
          const { error } = await supabase
            .from('clients')
            .insert(clientData);

          if (error) {
            console.error('Insert error:', error);
            toast.error(`Erreur import: ${client.company}`);
          } else {
            imported++;
          }
        }
      }

      toast.success(`Import terminé: ${imported} créés, ${updated} mis à jour, ${skipped} ignorés`);
      setOpen(false);
      setParsedClients([]);
      onClientsImported();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const stats = {
    total: parsedClients.length,
    selected: parsedClients.filter(c => c.selected).length,
    duplicates: parsedClients.filter(c => c.isDuplicate).length,
    toImport: parsedClients.filter(c => c.selected && c.action === 'import').length,
    toUpdate: parsedClients.filter(c => c.selected && c.action === 'update').length,
    toSkip: parsedClients.filter(c => c.selected && c.action === 'skip').length,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Importer avec validation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import de clients avec validation</DialogTitle>
          <DialogDescription>
            Importez vos clients depuis un fichier Excel et validez les données avant l'import final
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Charger le fichier Excel
            </Button>
          </div>

          {parsedClients.length > 0 && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total</div>
                      <div className="text-2xl font-bold">{stats.total}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Sélectionnés</div>
                      <div className="text-2xl font-bold text-primary">{stats.selected}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Doublons</div>
                      <div className="text-2xl font-bold text-orange-600">{stats.duplicates}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">À créer</div>
                      <div className="text-2xl font-bold text-green-600">{stats.toImport}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">À mettre à jour</div>
                      <div className="text-2xl font-bold text-blue-600">{stats.toUpdate}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">À ignorer</div>
                      <div className="text-2xl font-bold text-gray-600">{stats.toSkip}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={stats.selected === stats.total}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-32">Action</TableHead>
                      <TableHead className="w-24">Statut</TableHead>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Dernier contact</TableHead>
                      <TableHead>Prochaine échéance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedClients.map((client) => (
                      <TableRow key={client.id} className={client.isDuplicate ? 'bg-orange-50 dark:bg-orange-950/20' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={client.selected}
                            onCheckedChange={(checked) => handleSelectChange(client.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={client.action}
                            onValueChange={(value) => handleActionChange(client.id, value as ImportAction)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="import">Créer</SelectItem>
                              <SelectItem value="update" disabled={!client.isDuplicate}>
                                Mettre à jour
                              </SelectItem>
                              <SelectItem value="skip">Ignorer</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {client.isDuplicate ? (
                            <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {client.duplicateReason}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Nouveau
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{client.company}</TableCell>
                        <TableCell className="text-muted-foreground">{client.email}</TableCell>
                        <TableCell>
                          {client.first_name} {client.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{client.phone || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {client.last_contact ? new Date(client.last_contact).toLocaleDateString('fr-FR') : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {client.follow_up_date ? new Date(client.follow_up_date).toLocaleDateString('fr-FR') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || stats.selected === 0}
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Importer {stats.selected > 0 ? `(${stats.selected})` : ''}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
