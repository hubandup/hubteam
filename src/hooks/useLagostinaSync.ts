import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  detectFileType,
} from '@/lib/lagostina-parsers';

const LAGOSTINA_QUERY_KEYS = [
  'lagostina-files', 'lagostina-scorecards', 'lagostina-budget',
  'lagostina-influence', 'lagostina-affiliation', 'lagostina-press', 'lagostina-media-kpis',
  'lagostina-consumer', 'lagostina-rnr', 'lagostina-contenus',
  'lagostina-social-mix', 'lagostina-content-learnings', 'lagostina-learnings',
  'lagostina-category-status', 'lagostina-last-sync', 'lagostina-personas',
  'lagostina-activation', 'lagostina-glossary', 'lagostina-priorities',
  'lagostina-top-keywords',
];

export function useLagostinaSync() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const invalidateAll = () => {
    LAGOSTINA_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const syncFromKDrive = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      toast.info('Navigation vers kDrive > CLIENTS > LAGOSTINA > _DATA…');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session expirée'); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const resolveResponse = await supabase.functions.invoke('kdrive-api', {
        body: { action: 'resolve-path', folderPath: 'Common documents/CLIENTS/LAGOSTINA/_DATA' },
      });

      if (resolveResponse.error) {
        throw new Error(resolveResponse.error.message || 'Erreur lors de la navigation kDrive');
      }

      const resolveData = resolveResponse.data;
      const driveId = resolveData?.driveId;
      const kdriveFiles = (resolveData?.data || []).filter((f: any) => {
        const name = (f.name || f.filename || '').toLowerCase();
        return name.endsWith('.xlsx') || name.endsWith('.xls');
      });

      if (kdriveFiles.length === 0) {
        toast.warning('Aucun fichier Excel trouvé dans CLIENTS/LAGOSTINA/_DATA');
        return;
      }

      toast.info(`${kdriveFiles.length} fichier(s) Excel trouvé(s), téléchargement en cours…`);

      let totalImported = 0;
      let errors = 0;

      for (const file of kdriveFiles) {
        const fileName = file.name || file.filename;
        const fileType = detectFileType(fileName);
        
        if (!fileType) {
          console.warn('Type non reconnu pour:', fileName);
          continue;
        }

        try {
          const fileId = file.id || file.file_id;
          const fileDriveId = file.drive_id || driveId;
          
          if (!fileDriveId || !fileId) {
            console.warn('Missing driveId or fileId for:', fileName);
            continue;
          }

          const cacheBust = Date.now();
          const downloadUrl = `${supabaseUrl}/functions/v1/kdrive-api?action=download&driveId=${fileDriveId}&fileId=${fileId}&t=${cacheBust}`;
          const downloadResponse = await fetch(downloadUrl, {
            cache: 'no-store',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });

          if (!downloadResponse.ok) {
            throw new Error(`Téléchargement échoué: ${downloadResponse.status}`);
          }

          const arrayBuffer = await downloadResponse.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer);

          let insertedCount = 0;

          if (fileType === 'scorecard') {
            const records = await parseScorecardFile(workbook);
            const { personas, activations } = await parseActivationFile(workbook);
            if (records.length > 0) insertedCount += await mergeAndInsertScorecard(records);
            if (personas.length > 0 || activations.length > 0) insertedCount += await insertActivationData(personas, activations);
          } else if (fileType === 'budget') {
            insertedCount += await parseBudgetFile(workbook);
          } else if (fileType === 'influence_rp') {
            insertedCount += await parseInfluenceRPFile(workbook);
          } else if (fileType === 'media') {
            insertedCount += await parseMediaFile(workbook);
          } else if (fileType === 'consumer') {
            insertedCount += await parseConsumerFile(workbook);
          } else if (fileType === 'contenus') {
            insertedCount += await parseContenusFile(workbook);
          }

          await supabase.from('lagostina_files_sync').insert({
            filename: fileName,
            file_type: fileType,
            source: 'kdrive',
            status: 'synced',
            last_synced: new Date().toISOString(),
          });

          totalImported += insertedCount;
          toast.success(`${fileName}: ${insertedCount} enregistrements importés`);
        } catch (err: any) {
          errors++;
          console.error(`Erreur sync ${fileName}:`, err);
          toast.error(`${fileName}: ${err.message}`);
        }
      }

      invalidateAll();

      if (errors === 0) {
        toast.success(`Synchronisation terminée : ${totalImported} enregistrements importés`);
      } else {
        toast.warning(`Synchronisation partielle : ${totalImported} importés, ${errors} erreur(s)`);
      }
    } catch (err: any) {
      console.error('kDrive sync error:', err);
      toast.error(`Erreur de synchronisation : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setSyncing(false);
    }
  };

  return { syncing, syncFromKDrive, invalidateAll };
}
