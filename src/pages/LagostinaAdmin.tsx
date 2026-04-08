import { useState, useCallback } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

const FILE_TYPES = [
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'budget', label: 'Budget' },
  { value: 'influence_rp', label: 'Influence & RP' },
  { value: 'media', label: 'Médiatisation' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'contenus', label: 'Contenus' },
];

async function parseScorecardFile(workbook: XLSX.WorkBook) {
  const records: Array<{
    priority: string;
    levier: string;
    kpi_name: string;
    week: string;
    month: string;
    actual: number | null;
    objective: number | null;
  }> = [];

  for (const sheetName of workbook.SheetNames) {
    const prioMatch = sheetName.match(/prio\s*(\d+)/i);
    const priority = prioMatch ? `prio_${prioMatch[1]}` : sheetName;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    const months: Record<number, string> = {};
    const weeks: Record<number, string> = {};

    for (let c = range.s.c; c <= range.e.c; c++) {
      const monthCell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      if (monthCell?.v) months[c] = String(monthCell.v);

      const weekCell = sheet[XLSX.utils.encode_cell({ r: 1, c })];
      if (weekCell?.v) weeks[c] = String(weekCell.v);
    }

    let lastMonth = '';
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (months[c]) lastMonth = months[c];
      else months[c] = lastMonth;
    }

    for (let r = 2; r <= range.e.r; r++) {
      const leverCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
      const kpiCell = sheet[XLSX.utils.encode_cell({ r, c: 2 })];
      const typeCell = sheet[XLSX.utils.encode_cell({ r, c: 3 })];

      if (!leverCell?.v || !kpiCell?.v || !typeCell?.v) continue;

      const levier = String(leverCell.v).trim().toLowerCase().replace(/\s+/g, '_');
      const kpiName = String(kpiCell.v).trim();
      const type = String(typeCell.v).trim().toLowerCase();
      const isActual = type.includes('actual');

      for (let c = 4; c <= range.e.c; c++) {
        const weekKey = weeks[c];
        if (!weekKey || !weekKey.match(/^S\d+$/i)) continue;

        const valCell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (valCell?.v == null || valCell.v === '') continue;

        const numVal = Number(valCell.v);
        if (isNaN(numVal)) continue;

        records.push({
          priority,
          levier,
          kpi_name: kpiName,
          week: weekKey.toUpperCase(),
          month: months[c] || '',
          actual: isActual ? numVal : null,
          objective: !isActual ? numVal : null,
        });
      }
    }
  }

  return records;
}

// ── ACTIVATION PARSER ──
async function parseActivationFile(workbook: XLSX.WorkBook) {
  const personas: Array<{
    priority: string;
    persona_name: string;
    persona_type: string | null;
    age_range: string | null;
    has_children: string | null;
    market_weight: string | null;
    motivators: string[];
    barriers: string[];
    preferred_media: string | null;
  }> = [];

  const activations: Array<{
    priority: string;
    section: string;
    data: Record<string, any>;
  }> = [];

  for (const sheetName of workbook.SheetNames) {
    const activationMatch = sheetName.match(/activation\s+prio\s*(\d+)/i);
    if (!activationMatch) continue;

    const priority = `prio_${activationMatch[1]}`;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];
    let section = '';

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row.length) continue;
      const firstCell = String(row[0] || '').trim().toLowerCase();

      if (firstCell.includes('persona')) { section = 'persona'; continue; }
      if (firstCell.includes('produit') || firstCell.includes('product')) { section = 'product'; continue; }
      if (firstCell.includes('distribution')) { section = 'distribution'; continue; }
      if (firstCell.includes('sell-in') || firstCell.includes('sell in')) { section = 'sell_in'; continue; }
      if (firstCell.includes('sell-out') || firstCell.includes('sell out')) { section = 'sell_out'; continue; }

      if (section === 'persona' && row[0] && row[1]) {
        const name = String(row[0]).trim();
        if (name.length > 1 && !name.toLowerCase().includes('nom')) {
          const motivators: string[] = [];
          const barriers: string[] = [];
          for (let c = 5; c < Math.min(9, row.length); c++) {
            if (row[c]) motivators.push(String(row[c]).trim());
          }
          for (let c = 9; c < Math.min(13, row.length); c++) {
            if (row[c]) barriers.push(String(row[c]).trim());
          }
          personas.push({
            priority, persona_name: name,
            persona_type: row[1] ? String(row[1]).trim() : null,
            age_range: row[2] ? String(row[2]).trim() : null,
            has_children: row[3] ? String(row[3]).trim() : null,
            market_weight: row[4] ? String(row[4]).trim() : null,
            motivators, barriers,
            preferred_media: row[13] ? String(row[13]).trim() : null,
          });
        }
      }

      if (section === 'product') {
        const label = String(row[0] || '').trim().toLowerCase();
        const val = row[1] ? String(row[1]).trim() : '';
        if (label && val) {
          let existing = activations.find((a) => a.priority === priority && a.section === 'product');
          if (!existing) {
            existing = { priority, section: 'product', data: {} };
            activations.push(existing);
          }
          if (label.includes('flagship')) existing.data.flagship = val;
          else if (label.includes('benefit') && label.includes('1')) existing.data.benefit_1 = val;
          else if (label.includes('benefit') && label.includes('2')) existing.data.benefit_2 = val;
          else if (label.includes('rtb')) existing.data.rtb = val;
          else if (label.includes('claim')) existing.data.claims = val;
          else if (label.includes('marge')) existing.data.marge_std = val;
          else if (label.includes('prix')) existing.data.prix_conso = val;
        }
      }
    }
  }
  return { personas, activations };
}

async function insertActivationData(
  personas: Awaited<ReturnType<typeof parseActivationFile>>['personas'],
  activations: Awaited<ReturnType<typeof parseActivationFile>>['activations']
) {
  let count = 0;
  if (personas.length > 0) {
    const priorities = [...new Set(personas.map((p) => p.priority))];
    for (const p of priorities) {
      await supabase.from('lagostina_personas').delete().eq('priority', p);
    }
    const { error } = await supabase.from('lagostina_personas').insert(personas);
    if (error) throw error;
    count += personas.length;
  }
  if (activations.length > 0) {
    for (const a of activations) {
      await supabase.from('lagostina_activation').delete().eq('priority', a.priority).eq('section', a.section);
    }
    const { error } = await supabase.from('lagostina_activation').insert(activations);
    if (error) throw error;
    count += activations.length;
  }
  return count;
}

async function mergeAndInsertScorecard(records: Array<{
  priority: string;
  levier: string;
  kpi_name: string;
  week: string;
  month: string;
  actual: number | null;
  objective: number | null;
}>) {
  const merged = new Map<string, typeof records[0]>();

  for (const r of records) {
    const key = `${r.priority}|${r.levier}|${r.kpi_name}|${r.week}`;
    const existing = merged.get(key);
    if (existing) {
      if (r.actual != null) existing.actual = r.actual;
      if (r.objective != null) existing.objective = r.objective;
    } else {
      merged.set(key, { ...r });
    }
  }

  const finalRecords = Array.from(merged.values());
  const priorities = [...new Set(finalRecords.map((r) => r.priority))];

  for (const p of priorities) {
    await supabase.from('lagostina_scorecards').delete().eq('priority', p);
  }

  for (let i = 0; i < finalRecords.length; i += 500) {
    const batch = finalRecords.slice(i, i + 500);
    const { error } = await supabase.from('lagostina_scorecards').insert(batch);
    if (error) throw error;
  }

  return finalRecords.length;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  synced: <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-[#ef4444]" />,
  pending: <Clock className="h-3.5 w-3.5 text-[#E8FF4C]" />,
};

export default function LagostinaAdmin() {
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState('scorecard');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  if (role !== 'admin' && role !== 'team') {
    return <Navigate to="/" replace />;
  }

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Seuls les fichiers Excel (.xlsx) sont acceptés');
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
          file_type: selectedType,
          source: 'upload',
          status: 'pending',
        })
        .select()
        .single();

      if (syncError) throw syncError;

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);

      let insertedCount = 0;

      if (selectedType === 'scorecard') {
        const records = await parseScorecardFile(workbook);
        if (records.length === 0) {
          throw new Error('Aucune donnée trouvée dans le fichier. Vérifiez le format.');
        }
        insertedCount = await mergeAndInsertScorecard(records);
      } else {
        toast.info(`Le parsing des fichiers "${selectedType}" sera disponible dans une prochaine phase.`);
      }

      await supabase
        .from('lagostina_files_sync')
        .update({ status: 'synced', last_synced: new Date().toISOString() })
        .eq('id', syncRecord.id);

      toast.success(`${insertedCount} enregistrements importés depuis ${file.name}`);
      queryClient.invalidateQueries({ queryKey: ['lagostina-files'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-scorecards'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-budget'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-category-status'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-last-sync'] });
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

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Instrument_Sans'] tracking-tight">
            Administration Lagostina
          </h1>
          <p className="text-[#9ca3af] font-['Roboto'] text-sm mt-1">
            Import et synchronisation des données
          </p>
        </div>

        <div className="bg-[#0f1422] p-6 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-[#9ca3af] text-sm font-['Roboto']">Type de fichier :</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-[#0a0e1a] text-white border border-white/10 px-3 py-1.5 text-sm font-['Roboto'] focus:outline-none focus:border-[#E8FF4C]"
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
              ${isDragging ? 'border-[#E8FF4C] bg-[#E8FF4C]/5' : 'border-white/20 hover:border-white/40'}
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
                <RefreshCw className="h-8 w-8 text-[#E8FF4C] animate-spin" />
                <p className="text-white font-['Roboto'] text-sm">Traitement en cours…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-8 w-8 text-[#9ca3af]" />
                <p className="text-white font-['Roboto'] text-sm">
                  Glissez un fichier .xlsx ici ou <span className="text-[#E8FF4C] underline">parcourir</span>
                </p>
                <p className="text-[#9ca3af] font-['Roboto'] text-xs">
                  Format attendu : fichier Excel Lagostina ({FILE_TYPES.find(f => f.value === selectedType)?.label})
                </p>
              </div>
            )}
          </div>

          <button
            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white border border-white/10 font-['Roboto'] text-sm hover:bg-white/10 transition-colors"
            onClick={() => toast.info('Synchronisation kDrive — fonctionnalité à venir')}
          >
            <RefreshCw className="h-4 w-4" />
            Synchroniser depuis kDrive
          </button>
        </div>

        <div className="bg-[#0f1422] overflow-x-auto">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="text-white font-['Instrument_Sans'] font-bold text-sm">Fichiers synchronisés</h2>
          </div>
          {loadingFiles ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : !files?.length ? (
            <div className="p-8 text-center text-[#9ca3af] font-['Roboto'] text-sm">
              Aucun fichier importé
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-[#9ca3af] font-['Roboto'] font-medium text-xs uppercase">Fichier</th>
                  <th className="text-left px-4 py-2 text-[#9ca3af] font-['Roboto'] font-medium text-xs uppercase">Type</th>
                  <th className="text-left px-4 py-2 text-[#9ca3af] font-['Roboto'] font-medium text-xs uppercase">Dernière synchro</th>
                  <th className="text-center px-4 py-2 text-[#9ca3af] font-['Roboto'] font-medium text-xs uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-['Roboto'] flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-[#22c55e]" />
                      {f.filename}
                    </td>
                    <td className="px-4 py-3 text-[#9ca3af] font-['Roboto'] capitalize">{f.file_type}</td>
                    <td className="px-4 py-3 text-[#9ca3af] font-['Roboto']">
                      {f.last_synced
                        ? new Date(f.last_synced).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        {STATUS_ICONS[f.status] || STATUS_ICONS.pending}
                        <span className={`font-['Roboto'] text-xs capitalize ${
                          f.status === 'synced' ? 'text-[#22c55e]' : f.status === 'error' ? 'text-[#ef4444]' : 'text-[#E8FF4C]'
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
