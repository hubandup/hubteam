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
import { Upload, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';

interface ImportClientsDialogProps {
  onClientsImported: () => void;
}

interface ClientRow {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  phone?: string;
  active?: boolean;
}

export function ImportClientsDialog({ onClientsImported }: ImportClientsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ClientRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const template = [
      {
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'jean.dupont@example.com',
        company: 'Entreprise ABC',
        phone: '+33612345678',
        active: 'true',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'template_import_clients.xlsx');
    toast.success('Modèle téléchargé');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateClientRow = (row: any, index: number): ClientRow | null => {
    const errors: string[] = [];

    if (!row.first_name || typeof row.first_name !== 'string' || row.first_name.trim() === '') {
      errors.push(`Ligne ${index + 2}: Prénom manquant`);
    }
    if (!row.last_name || typeof row.last_name !== 'string' || row.last_name.trim() === '') {
      errors.push(`Ligne ${index + 2}: Nom manquant`);
    }
    if (!row.email || typeof row.email !== 'string' || row.email.trim() === '') {
      errors.push(`Ligne ${index + 2}: Email manquant`);
    } else if (!validateEmail(row.email.trim())) {
      errors.push(`Ligne ${index + 2}: Email invalide`);
    }
    if (!row.company || typeof row.company !== 'string' || row.company.trim() === '') {
      errors.push(`Ligne ${index + 2}: Entreprise manquante`);
    }

    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return null;
    }

    return {
      first_name: row.first_name.trim(),
      last_name: row.last_name.trim(),
      email: row.email.trim().toLowerCase(),
      company: row.company.trim(),
      phone: row.phone ? String(row.phone).trim() : undefined,
      active: row.active === 'false' || row.active === false ? false : true,
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setPreview([]);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        // Parse CSV
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processData(results.data);
          },
          error: (error) => {
            toast.error('Erreur lors de la lecture du fichier CSV');
            console.error(error);
            setLoading(false);
          },
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Parse Excel
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            processData(jsonData);
          } catch (error) {
            toast.error('Erreur lors de la lecture du fichier Excel');
            console.error(error);
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast.error('Format de fichier non supporté. Utilisez CSV ou XLS/XLSX');
        setLoading(false);
      }
    } catch (error) {
      toast.error('Erreur lors du traitement du fichier');
      console.error(error);
      setLoading(false);
    }
  };

  const processData = (data: any[]) => {
    if (!data || data.length === 0) {
      toast.error('Le fichier est vide');
      setLoading(false);
      return;
    }

    const validatedClients: ClientRow[] = [];
    
    data.forEach((row, index) => {
      const validatedRow = validateClientRow(row, index);
      if (validatedRow) {
        validatedClients.push(validatedRow);
      }
    });

    if (validatedClients.length === 0) {
      toast.error('Aucune ligne valide trouvée dans le fichier');
      setLoading(false);
      return;
    }

    setPreview(validatedClients);
    setLoading(false);
    toast.success(`${validatedClients.length} client(s) prêt(s) à être importé(s)`);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setLoading(true);

    try {
      // Check for duplicate emails in database
      const emails = preview.map(c => c.email);
      const { data: existingClients, error: checkError } = await supabase
        .from('clients')
        .select('email')
        .in('email', emails);

      if (checkError) throw checkError;

      const existingEmails = new Set(existingClients?.map(c => c.email) || []);
      const clientsToInsert = preview.filter(c => !existingEmails.has(c.email));

      if (clientsToInsert.length === 0) {
        toast.error('Tous les clients existent déjà dans la base de données');
        setLoading(false);
        return;
      }

      if (existingEmails.size > 0) {
        toast.warning(`${existingEmails.size} client(s) ignoré(s) (déjà existant(s))`);
      }

      // Insert clients
      const { error: insertError } = await supabase
        .from('clients')
        .insert(clientsToInsert);

      if (insertError) throw insertError;

      toast.success(`${clientsToInsert.length} client(s) importé(s) avec succès`);
      setOpen(false);
      setPreview([]);
      onClientsImported();
    } catch (error) {
      console.error('Error importing clients:', error);
      toast.error('Erreur lors de l\'import des clients');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importer des clients
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des clients en masse</DialogTitle>
          <DialogDescription>
            Importez plusieurs clients à partir d'un fichier CSV ou Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Télécharger le modèle
                </Button>
                <p className="text-sm text-muted-foreground">
                  Téléchargez le modèle Excel avec les colonnes requises
                </p>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Choisir un fichier CSV ou Excel
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Formats acceptés : CSV, XLS, XLSX
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Colonnes requises :</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li><span className="font-medium">first_name</span> - Prénom du client</li>
                  <li><span className="font-medium">last_name</span> - Nom du client</li>
                  <li><span className="font-medium">email</span> - Adresse email (unique)</li>
                  <li><span className="font-medium">company</span> - Nom de l'entreprise</li>
                  <li><span className="font-medium">phone</span> - Téléphone (optionnel)</li>
                  <li><span className="font-medium">active</span> - true/false (optionnel, true par défaut)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {preview.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">
                      Aperçu : {preview.length} client(s)
                    </h3>
                    <Button onClick={handleImport} disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Import en cours...
                        </>
                      ) : (
                        <>Importer {preview.length} client(s)</>
                      )}
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Prénom</th>
                            <th className="text-left p-2 font-medium">Nom</th>
                            <th className="text-left p-2 font-medium">Email</th>
                            <th className="text-left p-2 font-medium">Entreprise</th>
                            <th className="text-left p-2 font-medium">Téléphone</th>
                            <th className="text-left p-2 font-medium">Actif</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 50).map((client, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{client.first_name}</td>
                              <td className="p-2">{client.last_name}</td>
                              <td className="p-2">{client.email}</td>
                              <td className="p-2 uppercase">{client.company}</td>
                              <td className="p-2">{client.phone || '-'}</td>
                              <td className="p-2">{client.active ? 'Oui' : 'Non'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.length > 50 && (
                        <p className="text-xs text-muted-foreground p-2 bg-muted">
                          ... et {preview.length - 50} autres clients
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
