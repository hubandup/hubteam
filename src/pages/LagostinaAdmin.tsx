import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  parseScorecardFile,
  parseActivationFile,
  insertActivationData,
  mergeAndInsertScorecard,
  parseBudgetFile,
  parseInfluenceRPFile,
  parseMediaFile,
  parseConsumerFile,
  parseContenusFile,
  parseMetaCsvFile,
  detectFileType,
} from '@/lib/lagostina-parsers';
import { useLagostinaSync } from '@/hooks/useLagostinaSync';

const FILE_TYPES = [
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'budget', label: 'Budget' },
  { value: 'influence_rp', label: 'Influence & RP' },
  { value: 'media', label: 'Médiatisation' },
  { value: 'meta_csv', label: 'Meta Ads (CSV)' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'contenus', label: 'Contenus' },
];


const STATUS_ICONS: Record<string, React.ReactNode> = {
  synced: <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-[#ef4444]" />,
  pending: <Clock className="h-3.5 w-3.5 text-black font-semibold" />,
};

export default function LagostinaAdmin() {
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState('scorecard');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { syncing, syncFromKDrive, invalidateAll } = useLagostinaSync();

  const { data: files, isLoading: loadingFiles } = useQuery({
    queryKey: ['lagostina-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_files_sync')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const processFile = async (file: File) => {
    const isCsv = file.name.endsWith('.csv');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCsv && !isExcel) {
      toast.error('Seuls les fichiers Excel (.xlsx) ou CSV (.csv) sont acceptés');
      return;
    }

    if (selectedType === 'meta_csv' && !isCsv) {
      toast.error('Pour le type "Meta Ads (CSV)", veuillez importer un fichier .csv');
      return;
    }

    if (selectedType !== 'meta_csv' && !isExcel) {
      toast.error('Pour ce type, veuillez importer un fichier Excel (.xlsx)');
      return;
    }

    setUploading(true);

    try {
      const filePath = `${selectedType}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('lagostina-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: syncRecord, error: syncError } = await supabase
        .from('lagostina_files_sync')
        .insert({
          filename: file.name,
          file_type: selectedType === 'meta_csv' ? 'media' : selectedType,
          source: 'upload',
          status: 'pending',
        })
        .select()
        .single();

      if (syncError) throw syncError;

      let insertedCount = 0;

      if (selectedType === 'meta_csv') {
        const csvText = await file.text();
        insertedCount += await parseMetaCsvFile(csvText);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);

        if (selectedType === 'scorecard') {
          const records = await parseScorecardFile(workbook);
          const { personas, activations } = await parseActivationFile(workbook);
          if (records.length === 0 && personas.length === 0 && activations.length === 0) {
            throw new Error('Aucune donnée trouvée dans le fichier. Vérifiez le format.');
          }
          if (records.length > 0) {
            insertedCount += await mergeAndInsertScorecard(records);
          }
          if (personas.length > 0 || activations.length > 0) {
            insertedCount += await insertActivationData(personas, activations);
          }
        } else if (selectedType === 'budget') {
          insertedCount += await parseBudgetFile(workbook);
        } else if (selectedType === 'influence_rp') {
          insertedCount += await parseInfluenceRPFile(workbook);
        } else if (selectedType === 'media') {
          insertedCount += await parseMediaFile(workbook);
        } else if (selectedType === 'consumer') {
          insertedCount += await parseConsumerFile(workbook);
        } else if (selectedType === 'contenus') {
          insertedCount += await parseContenusFile(workbook);
        } else {
          toast.info(`Le parsing des fichiers "${selectedType}" sera disponible dans une prochaine phase.`);
        }
      }

      await supabase
        .from('lagostina_files_sync')
        .update({ status: 'synced', last_synced: new Date().toISOString() })
        .eq('id', syncRecord.id);

      toast.success(`${insertedCount} enregistrements importés depuis ${file.name}`);
      invalidateAll();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(`Erreur : ${err.message || 'Impossible de traiter le fichier'}`);

      try {
        await supabase
          .from('lagostina_files_sync')
          .update({ status: 'error' })
          .eq('filename', file.name)
          .eq('status', 'pending');
      } catch {}
    } finally {
      setUploading(false);
    }
  };


  // Auto-trigger sync when navigating with ?sync=auto
  useEffect(() => {
    if (searchParams.get('sync') === 'auto' && !syncing) {
      setSearchParams({}, { replace: true });
      syncFromKDrive();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [selectedType]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  if (role !== 'admin' && role !== 'team') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0e1a] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Instrument_Sans'] tracking-tight">
            Administration Lagostina
          </h1>
          <p className="text-muted-foreground font-['Roboto'] text-sm mt-1">
            Import et synchronisation des données
          </p>
        </div>

        <div className="bg-white border border-border/30 p-6 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-muted-foreground text-sm font-['Roboto']">Type de fichier :</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-white text-foreground border border-border/40 px-3 py-1.5 text-sm font-['Roboto'] focus:outline-none focus:border-black"
            >
              {FILE_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed p-12 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-black bg-black/5' : 'border-white/20 hover:border-white/40'}
              ${uploading ? 'opacity-50 pointer-events-none' : ''}
            `}
            onClick={() => document.getElementById('file-input-lago')?.click()}
          >
            <input
              id="file-input-lago"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileInput}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 text-black font-semibold animate-spin" />
                <p className="text-foreground font-['Roboto'] text-sm">Traitement en cours…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-foreground font-['Roboto'] text-sm">
                  Glissez un fichier .xlsx ici ou <span className="text-black font-semibold underline">parcourir</span>
                </p>
                <p className="text-muted-foreground font-['Roboto'] text-xs">
                  Format attendu : fichier Excel Lagostina ({FILE_TYPES.find(f => f.value === selectedType)?.label})
                </p>
              </div>
            )}
          </div>

          <button
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-foreground border border-border/40 font-['Roboto'] text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            onClick={syncFromKDrive}
            disabled={syncing || uploading}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation en cours…' : 'Synchroniser depuis kDrive'}
          </button>
        </div>

        <div className="bg-white border border-border/30 overflow-x-auto">
          <div className="px-4 py-3 border-b border-border/40">
            <h2 className="text-foreground font-['Instrument_Sans'] font-bold text-sm">Fichiers synchronisés</h2>
          </div>
          {loadingFiles ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : !files?.length ? (
            <div className="p-8 text-center text-muted-foreground font-['Roboto'] text-sm">
              Aucun fichier importé
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-4 py-2 text-muted-foreground font-['Roboto'] font-medium text-xs uppercase">Fichier</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-['Roboto'] font-medium text-xs uppercase">Type</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-['Roboto'] font-medium text-xs uppercase">Dernière synchro</th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-['Roboto'] font-medium text-xs uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-border/20 hover:bg-gray-50">
                    <td className="px-4 py-3 text-foreground font-['Roboto'] flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-[#22c55e]" />
                      {f.filename}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-['Roboto'] capitalize">{f.file_type}</td>
                    <td className="px-4 py-3 text-muted-foreground font-['Roboto']">
                      {f.last_synced
                        ? new Date(f.last_synced).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        {STATUS_ICONS[f.status] || STATUS_ICONS.pending}
                        <span className={`font-['Roboto'] text-xs capitalize ${
                          f.status === 'synced' ? 'text-[#22c55e]' : f.status === 'error' ? 'text-[#ef4444]' : 'text-black font-semibold'
                        }`}>
                          {f.status}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
