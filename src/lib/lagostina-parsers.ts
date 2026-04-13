import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

// ── SCORECARD PARSER ──
export async function parseScorecardFile(workbook: XLSX.WorkBook) {
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
export async function parseActivationFile(workbook: XLSX.WorkBook) {
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

export async function insertActivationData(
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

export async function mergeAndInsertScorecard(records: Array<{
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
export async function parseBudgetFile(workbook: XLSX.WorkBook) {
  const records: Array<{ levier: string; month: string; planned: number; engaged: number; invoiced: number; remaining: number }> = [];
  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  console.log('[Budget] SheetNames:', workbook.SheetNames);
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];
    if (!rows.length) continue;

    console.log(`[Budget] Sheet "${sheetName}" has ${rows.length} rows`);
    for (let r = 0; r < Math.min(8, rows.length); r++) {
      console.log(`[Budget] Row ${r}:`, JSON.stringify(rows[r]?.slice(0, 15)));
    }

    const MONTH_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    let monthRow = -1;
    let monthCols: Record<number, string> = {};
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (!val) continue;
        const valLower = val.toLowerCase();
        let matchedMonth = MONTHS.find((m) => valLower.startsWith(m.toLowerCase().slice(0, 3)));
        if (!matchedMonth) {
          const fullIdx = MONTH_FULL.findIndex((m) => valLower.startsWith(m));
          if (fullIdx >= 0) matchedMonth = MONTHS[fullIdx];
        }
        if (matchedMonth) {
          monthCols[c] = matchedMonth;
          monthRow = r;
        }
      }
      if (monthRow >= 0) break;
    }

    console.log(`[Budget] monthRow=${monthRow}, monthCols=`, JSON.stringify(monthCols));
    if (monthRow < 0) continue;

    const header0 = String(rows[monthRow]?.[0] || '').trim().toLowerCase();
    const header1 = String(rows[monthRow]?.[1] || '').trim().toLowerCase();
    const twoColFormat = (header0 === 'levier' && header1 === 'type');
    console.log(`[Budget] twoColFormat=${twoColFormat}, header0="${header0}", header1="${header1}"`);

    let currentLevier = '';
    for (let r = monthRow + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const firstCell = String(row[0] || '').trim();
      if (!firstCell) continue;

      let levierName: string;
      let typeLabel: string;

      if (twoColFormat) {
        levierName = firstCell.toLowerCase().replace(/\s+/g, '_');
        typeLabel = String(row[1] || '').trim().toLowerCase();
      } else {
        const lower = firstCell.toLowerCase();
        if (!lower.includes('prévu') && !lower.includes('engagé') && !lower.includes('facturé') && !lower.includes('budget') && !lower.includes('planned') && !lower.includes('engaged') && !lower.includes('invoiced')) {
          currentLevier = firstCell.toLowerCase().replace(/\s+/g, '_');
          continue;
        }
        if (!currentLevier) continue;
        levierName = currentLevier;
        typeLabel = firstCell.toLowerCase();
      }

      const dataStartCol = twoColFormat ? 2 : 0;

      for (const [colIdx, month] of Object.entries(monthCols)) {
        const ci = Number(colIdx);
        if (ci < dataStartCol) continue;
        const val = Number(row[ci]) || 0;
        let existing = records.find((rec) => rec.levier === levierName && rec.month === month);
        if (!existing) {
          existing = { levier: levierName, month, planned: 0, engaged: 0, invoiced: 0, remaining: 0 };
          records.push(existing);
        }
        if (typeLabel.includes('prévu') || typeLabel.includes('planned') || typeLabel.includes('budget')) existing.planned = val;
        else if (typeLabel.includes('engagé') || typeLabel.includes('engaged')) existing.engaged = val;
        else if (typeLabel.includes('facturé') || typeLabel.includes('invoiced')) existing.invoiced = val;
      }
    }
  }

  records.forEach((r) => { r.remaining = r.planned - r.engaged; });

  if (records.length === 0) throw new Error('Aucune donnée budget trouvée dans le fichier.');

  await supabase.from('lagostina_budget').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('lagostina_budget').insert(records);
  if (error) throw error;
  return records.length;
}

// ── INFLUENCE & RP PARSER ──
export async function parseInfluenceRPFile(workbook: XLSX.WorkBook) {
  let count = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];

    if (sheetName.toLowerCase().includes('influence')) {
      const influenceRecords: Array<{ week: string; influencer_count: number | null; influencer_count_obj: number | null; reach_millions: number | null; reach_millions_obj: number | null; engagement_rate: number | null; engagement_rate_obj: number | null; vtf: number | null; vtf_obj: number | null; conversion_rate: number | null; conversion_rate_obj: number | null; cost_per_reach: number | null; cost_per_reach_obj: number | null }> = [];
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
      const normalizeTonality = (value: unknown) => {
        const normalized = String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalized.startsWith('pos')) return 'positive';
        if (normalized.startsWith('neg')) return 'negative';
        if (normalized.startsWith('neu')) return 'neutral';
        return 'neutral';
      };
      const parseReach = (value: unknown) => {
        if (value == null || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
        const normalized = String(value).trim().replace(/\s+/g, '').replace(/,/g, '.');
        if (!normalized || normalized.toLowerCase() === 'nc' || normalized === '-') return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? Math.round(parsed) : null;
      };

      console.log('[Press] Headers:', rows[0]);
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        if (r <= 3) {
          console.log(`[Press] Row ${r}:`, JSON.stringify(row));
          console.log(`[Press] row[4]=${row[4]} (tonality), row[5]=${row[5]} (reach), typeof=${typeof row[5]}`);
        }

        let dateVal: string;
        if (typeof row[0] === 'number') {
          const d = new Date((row[0] - 25569) * 86400 * 1000);
          dateVal = d.toISOString().slice(0, 10);
        } else if (row[0] instanceof Date) {
          dateVal = row[0].toISOString().slice(0, 10);
        } else {
          dateVal = String(row[0]);
        }

        pressRecords.push({
          date: dateVal,
          media_name: String(row[1] || '').trim(),
          title: String(row[2] || '').trim(),
          url: row[3] ? String(row[3]).trim() : null,
          tonality: normalizeTonality(row[4]),
          estimated_reach: parseReach(row[5]),
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
export async function parseMediaFile(workbook: XLSX.WorkBook) {
  const records: Array<{ channel: string; kpi_name: string; week: string; actual: number | null; objective: number | null; budget_spent: number | null; budget_allocated: number | null }> = [];
  const channelMap: Record<string, string> = { sea: 'sea', sma: 'sma', meta: 'sma', tiktok: 'tiktok', display: 'display', vol: 'vol', social: 'social', affiliation: 'affiliation' };
  const normalizeValue = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const normalizeChannel = (value: unknown) => {
    const normalized = normalizeValue(value);
    if (!normalized) return '';
    if (normalized.includes('meta') || normalized.includes('sma')) return 'sma';
    if (normalized.includes('tiktok')) return 'tiktok';
    if (normalized.includes('sea')) return 'sea';
    if (normalized.includes('display')) return 'display';
    if (normalized.includes('vol')) return 'vol';
    if (normalized.includes('social')) return 'social';
    if (normalized.includes('affiliation')) return 'affiliation';
    return channelMap[normalized] || normalized;
  };
  const parseOptionalNumber = (value: unknown) => {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  console.log('[Media] SheetNames:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    const lowerSheet = sheetName.toLowerCase();
    if (lowerSheet.includes('instruction') || lowerSheet.includes('readme')) continue;
    
    const inferredChannel = normalizeChannel(sheetName);
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) continue;

    console.log(`[Media] Sheet "${sheetName}" → channel="${inferredChannel}", ${rows.length} rows`);
    console.log(`[Media] Row 0:`, JSON.stringify(rows[0]?.slice(0, 15)));
    console.log(`[Media] Row 1:`, JSON.stringify(rows[1]?.slice(0, 15)));

    const headers = (rows[0] || []).map(normalizeValue);
    const channelCol = headers.findIndex((header) => header === 'channel' || header === 'canal');
    const kpiCol = headers.findIndex((header) => ['kpi_name', 'kpi', 'metric', 'indicateur'].includes(header));
    const weekCol = headers.findIndex((header) => header === 'week' || header === 'semaine');
    const actualCol = headers.findIndex((header) => ['actual', 'realise', 'reel', 'valeur_actuelle'].includes(header));
    const objectiveCol = headers.findIndex((header) => ['objective', 'objectif', 'target'].includes(header));
    const budgetAllocatedCol = headers.findIndex((header) => ['budget_allocated', 'budget_alloue', 'budget_prevu'].includes(header));
    const budgetSpentCol = headers.findIndex((header) => ['budget_spent', 'budget_depense', 'budget_engage'].includes(header));
    const rowBasedFormat = weekCol >= 0 && kpiCol >= 0 && (actualCol >= 0 || objectiveCol >= 0 || budgetAllocatedCol >= 0 || budgetSpentCol >= 0);

    if (rowBasedFormat) {
      console.log('[Media] Detected row-based format');
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;

        const week = String(row[weekCol] || '').trim().toUpperCase();
        const kpiName = normalizeValue(row[kpiCol]);
        const channel = normalizeChannel(channelCol >= 0 ? row[channelCol] : inferredChannel) || inferredChannel;

        if (!week.match(/^S\d+$/i) || !kpiName || !channel) continue;

        const actual = actualCol >= 0 ? parseOptionalNumber(row[actualCol]) : null;
        const objective = objectiveCol >= 0 ? parseOptionalNumber(row[objectiveCol]) : null;
        const budgetAllocated = budgetAllocatedCol >= 0 ? parseOptionalNumber(row[budgetAllocatedCol]) : null;
        const budgetSpent = budgetSpentCol >= 0 ? parseOptionalNumber(row[budgetSpentCol]) : null;

        records.push({
          channel,
          kpi_name: kpiName,
          week,
          actual,
          objective,
          budget_allocated: budgetAllocated,
          budget_spent: budgetSpent,
        });
      }
      continue;
    }

    const weekCols: Record<number, string> = {};
    for (let c = 0; c < rows[0].length; c++) {
      const val = String(rows[0][c] || '').trim();
      if (val.match(/^S\d+$/i)) weekCols[c] = val.toUpperCase();
    }

    console.log(`[Media] weekCols=`, JSON.stringify(weekCols));
    if (Object.keys(weekCols).length === 0) {
      console.log('[Media] No week columns found, skipping sheet');
      continue;
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[0]) continue;
      const kpiName = normalizeValue(row[0]);
      const type = row[1] ? String(row[1]).trim().toLowerCase() : 'actual';
      const isActual = !type.includes('obj');

      for (const [colIdx, week] of Object.entries(weekCols)) {
        const val = parseOptionalNumber(row[Number(colIdx)]);
        if (val == null) continue;
        records.push({
          channel: inferredChannel,
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

  const merged = new Map<string, typeof records[0]>();
  for (const r of records) {
    const key = `${r.channel}|${r.kpi_name}|${r.week}`;
    const ex = merged.get(key);
    if (ex) {
      if (r.actual != null) ex.actual = r.actual;
      if (r.objective != null) ex.objective = r.objective;
      if (r.budget_allocated != null) ex.budget_allocated = r.budget_allocated;
      if (r.budget_spent != null) ex.budget_spent = r.budget_spent;
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
export async function parseConsumerFile(workbook: XLSX.WorkBook) {
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
export async function parseContenusFile(workbook: XLSX.WorkBook) {
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

// ── FILE TYPE DETECTION ──
const KDRIVE_FILE_TYPE_MAP: Record<string, string> = {
  'scorecard': 'scorecard',
  'budget': 'budget',
  'influence': 'influence_rp',
  'revue_presse': 'influence_rp',
  'revue de presse': 'influence_rp',
  'presse': 'influence_rp',
  'mediatisation': 'media',
  'médiatisation': 'media',
  'media': 'media',
  'sma': 'media',
  'sea': 'media',
  'consumer': 'consumer',
  'contenus': 'contenus',
  'contenu': 'contenus',
};

export function detectFileType(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [key, type] of Object.entries(KDRIVE_FILE_TYPE_MAP)) {
    if (lower.includes(key)) return type;
  }
  return null;
}
