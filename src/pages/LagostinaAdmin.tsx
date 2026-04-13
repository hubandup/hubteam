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

// ── BUDGET PARSER ──
async function parseBudgetFile(workbook: XLSX.WorkBook) {
  const records: Array<{ levier: string; month: string; planned: number; engaged: number; invoiced: number; remaining: number }> = [];
  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];
    if (!rows.length) continue;

    // Find month header row
    let monthRow = -1;
    let monthCols: Record<number, string> = {};
    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        const matchedMonth = MONTHS.find((m) => val.toLowerCase().startsWith(m.toLowerCase().slice(0, 3)));
        if (matchedMonth) {
          monthCols[c] = matchedMonth;
          monthRow = r;
        }
      }
      if (monthRow >= 0) break;
    }

    if (monthRow < 0) continue;

    let currentLevier = '';
    for (let r = monthRow + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const firstCell = String(row[0] || '').trim();
      if (!firstCell) continue;

      const lower = firstCell.toLowerCase();
      if (!lower.includes('prévu') && !lower.includes('engagé') && !lower.includes('facturé') && !lower.includes('budget') && !lower.includes('planned') && !lower.includes('engaged') && !lower.includes('invoiced')) {
        currentLevier = firstCell.toLowerCase().replace(/\s+/g, '_');
        continue;
      }

      if (!currentLevier) continue;

      for (const [colIdx, month] of Object.entries(monthCols)) {
        const val = Number(row[Number(colIdx)]) || 0;
        let existing = records.find((rec) => rec.levier === currentLevier && rec.month === month);
        if (!existing) {
          existing = { levier: currentLevier, month, planned: 0, engaged: 0, invoiced: 0, remaining: 0 };
          records.push(existing);
        }
        if (lower.includes('prévu') || lower.includes('planned') || lower.includes('budget')) existing.planned = val;
        else if (lower.includes('engagé') || lower.includes('engaged')) existing.engaged = val;
        else if (lower.includes('facturé') || lower.includes('invoiced')) existing.invoiced = val;
      }
    }
  }

  // Calculate remaining
  records.forEach((r) => { r.remaining = r.planned - r.engaged; });

  if (records.length === 0) throw new Error('Aucune donnée budget trouvée dans le fichier.');

  // Clear and insert
  await supabase.from('lagostina_budget').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('lagostina_budget').insert(records);
  if (error) throw error;
  return records.length;
}

// ── INFLUENCE & RP PARSER ──
async function parseInfluenceRPFile(workbook: XLSX.WorkBook) {
  let count = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];

    if (sheetName.toLowerCase().includes('influence')) {
      const influenceRecords: Array<{ week: string; influencer_count: number | null; influencer_count_obj: number | null; reach_millions: number | null; reach_millions_obj: number | null; engagement_rate: number | null; engagement_rate_obj: number | null; vtf: number | null; vtf_obj: number | null; conversion_rate: number | null; conversion_rate_obj: number | null; cost_per_reach: number | null; cost_per_reach_obj: number | null }> = [];
      // Expect header in first few rows with week column
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        const week = String(row[0]).trim();
        if (!week.match(/^S\d+$/i)) continue;

        influenceRecords.push({
          week: week.toUpperCase(),
          influencer_count: Number(row[1]) || null,
          influencer_count_obj: Number(row[2]) || null,
          reach_millions: Number(row[3]) || null,
          reach_millions_obj: Number(row[4]) || null,
          engagement_rate: Number(row[5]) || null,
          engagement_rate_obj: Number(row[6]) || null,
          vtf: Number(row[7]) || null,
          vtf_obj: Number(row[8]) || null,
          conversion_rate: Number(row[9]) || null,
          conversion_rate_obj: Number(row[10]) || null,
          cost_per_reach: Number(row[11]) || null,
          cost_per_reach_obj: Number(row[12]) || null,
        });
      }

      if (influenceRecords.length > 0) {
        await supabase.from('lagostina_influence').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error } = await supabase.from('lagostina_influence').insert(influenceRecords);
        if (error) throw error;
        count += influenceRecords.length;
      }
    }

    if (sheetName.toLowerCase().includes('presse') || sheetName.toLowerCase().includes('press')) {
      const pressRecords: Array<{ date: string; media_name: string; title: string; url: string | null; tonality: string; estimated_reach: number | null; journalist_name: string | null }> = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;

        let dateVal: string;
        if (typeof row[0] === 'number') {
          const d = new Date((row[0] - 25569) * 86400 * 1000);
          dateVal = d.toISOString().slice(0, 10);
        } else {
          dateVal = String(row[0]);
        }

        pressRecords.push({
          date: dateVal,
          media_name: String(row[1] || '').trim(),
          title: String(row[2] || '').trim(),
          url: row[3] ? String(row[3]).trim() : null,
          tonality: String(row[4] || 'neutral').trim().toLowerCase(),
          estimated_reach: Number(row[5]) || null,
          journalist_name: row[6] ? String(row[6]).trim() : null,
        });
      }

      if (pressRecords.length > 0) {
        await supabase.from('lagostina_press').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error } = await supabase.from('lagostina_press').insert(pressRecords);
        if (error) throw error;
        count += pressRecords.length;
      }
    }
  }

  if (count === 0) throw new Error('Aucune donnée influence/RP trouvée dans le fichier.');
  return count;
}

// ── MEDIA PARSER ──
async function parseMediaFile(workbook: XLSX.WorkBook) {
  const records: Array<{ channel: string; kpi_name: string; week: string; actual: number | null; objective: number | null; budget_spent: number | null; budget_allocated: number | null }> = [];
  const channelMap: Record<string, string> = { sea: 'sea', sma: 'sma', tiktok: 'tiktok' };

  for (const sheetName of workbook.SheetNames) {
    const lowerSheet = sheetName.toLowerCase();
    const channel = Object.keys(channelMap).find((k) => lowerSheet.includes(k));
    if (!channel) continue;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) continue;

    // First row = headers, detect week columns
    const headers = rows[0] || [];
    const weekCols: Record<number, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const val = String(headers[c] || '').trim();
      if (val.match(/^S\d+$/i)) weekCols[c] = val.toUpperCase();
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[0]) continue;
      const kpiName = String(row[0]).trim().toLowerCase().replace(/\s+/g, '_');
      const type = row[1] ? String(row[1]).trim().toLowerCase() : 'actual';
      const isActual = !type.includes('obj');

      for (const [colIdx, week] of Object.entries(weekCols)) {
        const val = Number(row[Number(colIdx)]);
        if (isNaN(val)) continue;
        records.push({
          channel: channelMap[channel],
          kpi_name: kpiName,
          week,
          actual: isActual ? val : null,
          objective: !isActual ? val : null,
          budget_spent: null,
          budget_allocated: null,
        });
      }
    }
  }

  if (records.length === 0) throw new Error('Aucune donnée média trouvée dans le fichier.');

  // Merge actual/objective for same key
  const merged = new Map<string, typeof records[0]>();
  for (const r of records) {
    const key = `${r.channel}|${r.kpi_name}|${r.week}`;
    const ex = merged.get(key);
    if (ex) {
      if (r.actual != null) ex.actual = r.actual;
      if (r.objective != null) ex.objective = r.objective;
    } else {
      merged.set(key, { ...r });
    }
  }

  const final = Array.from(merged.values());
  await supabase.from('lagostina_media_kpis').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  for (let i = 0; i < final.length; i += 500) {
    const batch = final.slice(i, i + 500);
    const { error } = await supabase.from('lagostina_media_kpis').insert(batch);
    if (error) throw error;
  }
  return final.length;
}

// ── CONSUMER PARSER ──
async function parseConsumerFile(workbook: XLSX.WorkBook) {
  let count = 0;
  const consumerRecords: Array<{ section: string; metric_name: string; scope: string | null; value_current: string | null; vs_reference: string | null; vs_brand: string | null; comment: string | null }> = [];
  const rnrRecords: Array<{ platform: string; product_name: string; week: string; avg_score: number | null; review_count: number | null; comments_summary: string | null }> = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];
    const lowerSheet = sheetName.toLowerCase();

    if (lowerSheet.includes('r&r') || lowerSheet.includes('review') || lowerSheet.includes('rnr')) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        rnrRecords.push({
          platform: String(row[0]).trim(),
          product_name: String(row[1] || '').trim(),
          week: String(row[2] || '').trim(),
          avg_score: row[3] != null ? Number(row[3]) : null,
          review_count: row[4] != null ? Number(row[4]) : null,
          comments_summary: row[5] ? String(row[5]).trim() : null,
        });
      }
    } else {
      // Consumer data sheets
      let currentSection = 'sample';
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        const first = String(row[0]).trim().toLowerCase();
        if (first.includes('échantillon') || first.includes('sample')) { currentSection = 'sample'; continue; }
        if (first.includes('valeur') || first.includes('value')) { currentSection = 'value'; continue; }
        if (first.includes('cuisine')) { currentSection = 'cuisine'; continue; }
        if (first.includes('brand') || first.includes('monitoring')) { currentSection = 'brand_monitoring'; continue; }
        if (first.includes('business')) { currentSection = 'business_opp'; continue; }

        const metricName = String(row[0]).trim();
        if (metricName.length > 1) {
          consumerRecords.push({
            section: currentSection,
            metric_name: metricName,
            scope: row[1] ? String(row[1]).trim() : null,
            value_current: row[2] != null ? String(row[2]).trim() : (row[1] != null ? String(row[1]).trim() : null),
            vs_reference: row[3] ? String(row[3]).trim() : null,
            vs_brand: row[4] ? String(row[4]).trim() : null,
            comment: row[5] ? String(row[5]).trim() : null,
          });
        }
      }
    }
  }

  if (consumerRecords.length > 0) {
    await supabase.from('lagostina_consumer').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('lagostina_consumer').insert(consumerRecords);
    if (error) throw error;
    count += consumerRecords.length;
  }
  if (rnrRecords.length > 0) {
    await supabase.from('lagostina_rnr').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('lagostina_rnr').insert(rnrRecords);
    if (error) throw error;
    count += rnrRecords.length;
  }

  if (count === 0) throw new Error('Aucune donnée consumer trouvée dans le fichier.');
  return count;
}

// ── CONTENUS PARSER ──
async function parseContenusFile(workbook: XLSX.WorkBook) {
  let count = 0;
  const contenus: Array<{ content_type: string; count: number; ready: boolean; quality_assessment: string; variations: string | null }> = [];
  const socialMix: Array<{ category: string; count: number }> = [];
  const learnings: Array<{ learning: string; associated_metric: string | null; action: string | null }> = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];
    const lowerSheet = sheetName.toLowerCase();

    if (lowerSheet.includes('learning')) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        learnings.push({
          learning: String(row[0]).trim(),
          associated_metric: row[1] ? String(row[1]).trim() : null,
          action: row[2] ? String(row[2]).trim() : null,
        });
      }
    } else if (lowerSheet.includes('social') || lowerSheet.includes('mix')) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        socialMix.push({
          category: String(row[0]).trim().toLowerCase().replace(/\s+/g, '_'),
          count: Number(row[1]) || 0,
        });
      }
    } else {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        contenus.push({
          content_type: String(row[0]).trim().toLowerCase().replace(/\s+/g, '_'),
          count: Number(row[1]) || 0,
          ready: row[2] ? String(row[2]).trim().toLowerCase() === 'oui' || String(row[2]).trim().toLowerCase() === 'yes' || row[2] === true : false,
          quality_assessment: row[3] ? String(row[3]).trim().toLowerCase().replace(/\s+/g, '_') : 'not_assessed',
          variations: row[4] ? String(row[4]).trim() : null,
        });
      }
    }
  }

  if (contenus.length > 0) {
    await supabase.from('lagostina_contenus').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('lagostina_contenus').insert(contenus);
    if (error) throw error;
    count += contenus.length;
  }
  if (socialMix.length > 0) {
    await supabase.from('lagostina_social_mix').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('lagostina_social_mix').insert(socialMix);
    if (error) throw error;
    count += socialMix.length;
  }
  if (learnings.length > 0) {
    await supabase.from('lagostina_content_learnings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('lagostina_content_learnings').insert(learnings);
    if (error) throw error;
    count += learnings.length;
  }

  if (count === 0) throw new Error('Aucune donnée contenus trouvée dans le fichier.');
  return count;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  synced: <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-[#ef4444]" />,
  pending: <Clock className="h-3.5 w-3.5 text-black font-semibold" />,
};

// Map kDrive filenames to file types for auto-detection
const KDRIVE_FILE_TYPE_MAP: Record<string, string> = {
  'scorecard': 'scorecard',
  'budget': 'budget',
  'influence': 'influence_rp',
  'revue_presse': 'influence_rp',
  'sma': 'media',
  'sea': 'media',
  'consumer': 'consumer',
  'contenus': 'contenus',
};

function detectFileType(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [key, type] of Object.entries(KDRIVE_FILE_TYPE_MAP)) {
    if (lower.includes(key)) return type;
  }
  return null;
}

export default function LagostinaAdmin() {
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState('scorecard');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['lagostina-personas'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-activation'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-influence'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-press'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-media-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-consumer'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-rnr'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-contenus'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-social-mix'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-content-learnings'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-learnings'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-glossary'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-priorities'] });
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

  const syncFromKDrive = async () => {
    setSyncing(true);
    try {
      // Step 1: Search for LAGOSTINA files on kDrive
      toast.info('Recherche des fichiers Lagostina sur kDrive…');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté pour synchroniser');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Search for files with "LAGOSTINA" in the name
      const searchResponse = await supabase.functions.invoke('kdrive-api', {
        body: { action: 'search-folder', folderPath: 'LAGOSTINA' },
      });

      if (searchResponse.error) {
        throw new Error(searchResponse.error.message || 'Erreur lors de la recherche kDrive');
      }

      const searchData = searchResponse.data?.data || searchResponse.data;
      const files = (Array.isArray(searchData) ? searchData : searchData?.data || [])
        .filter((f: any) => {
          const name = (f.name || f.filename || '').toLowerCase();
          return name.endsWith('.xlsx') && name.includes('lagostina');
        });

      if (files.length === 0) {
        toast.warning('Aucun fichier Excel Lagostina trouvé sur kDrive');
        return;
      }

      toast.info(`${files.length} fichier(s) trouvé(s), téléchargement en cours…`);

      let totalImported = 0;
      let errors = 0;

      for (const file of files) {
        const fileName = file.name || file.filename;
        const fileType = detectFileType(fileName);
        
        if (!fileType) {
          console.warn('Type non reconnu pour:', fileName);
          continue;
        }

        try {
          // Download file via proxy
          const driveId = file.drive_id || file.driveId;
          const fileId = file.id || file.file_id;
          
          if (!driveId || !fileId) {
            console.warn('Missing driveId or fileId for:', fileName);
            continue;
          }

          const downloadUrl = `${supabaseUrl}/functions/v1/kdrive-api?action=download&driveId=${driveId}&fileId=${fileId}`;
          const downloadResponse = await fetch(downloadUrl, {
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

          // Update sync record
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

      // Invalidate all queries
      queryClient.invalidateQueries({ queryKey: ['lagostina-files'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-scorecards'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-budget'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-influence'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-press'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-media-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-consumer'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-rnr'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-contenus'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-social-mix'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-content-learnings'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-learnings'] });

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
