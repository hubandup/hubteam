import { useState } from 'react';
import { FileDown, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function getCondFill(actual: number | null, objective: number | null): Partial<ExcelJS.Fill> | undefined {
  if (actual == null || objective == null || objective === 0) return undefined;
  const ratio = actual / objective;
  if (ratio >= 1) return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF22c55e' } };
  if (ratio >= 0.8) return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8FF4C' } };
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFef4444' } };
}

interface ExportButtonsProps {
  tabName: string;
  showPdf?: boolean;
  chartsContainerId?: string;
}

export function LagostinaExportButtons({ tabName, showPdf = false, chartsContainerId }: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const exportExcel = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Hub & Up — Dashboard Lagostina';
      workbook.created = new Date();

      const dateStr = new Date().toISOString().slice(0, 10);

      if (tabName === 'Overview' || tabName === 'Budget') {
        const { data } = await supabase.from('lagostina_budget').select('*');
        const sheet = workbook.addWorksheet('Budget');
        sheet.addRow(['Levier', 'Mois', 'Prévu', 'Engagé', 'Facturé', 'Restant']);
        sheet.getRow(1).font = { bold: true };
        data?.forEach((b) => {
          sheet.addRow([b.levier, b.month, b.planned, b.engaged, b.invoiced, (Number(b.planned) || 0) - (Number(b.engaged) || 0)]);
        });
        sheet.columns.forEach((col) => { col.width = 15; });
      }

      if (tabName === 'Scorecard RECC' || tabName === 'scorecard' || tabName === 'Scorecard') {
        const { data } = await supabase.from('lagostina_scorecards').select('*').order('week');
        const sheet = workbook.addWorksheet('Scorecard full funnel Prio 1');
        sheet.addRow(['Priorité', 'Levier', 'KPI', 'Semaine', 'Mois', 'Actual', 'Objectif']);
        sheet.getRow(1).font = { bold: true };
        data?.forEach((s) => {
          const row = sheet.addRow([s.priority, s.levier, s.kpi_name, s.week, s.month, s.actual, s.objective]);
          const fill = getCondFill(Number(s.actual), Number(s.objective));
          if (fill) {
            row.getCell(6).fill = fill as ExcelJS.Fill;
          }
        });
        sheet.columns.forEach((col) => { col.width = 16; });
      }

      if (tabName === 'Activation & Personas' || tabName === 'activation') {
        const { data: personas } = await supabase.from('lagostina_personas').select('*');
        const sheet = workbook.addWorksheet('Activation Prio 1');
        sheet.addRow(['Persona', 'Type', 'Âge', 'Enfants', 'Poids marché', 'Média préféré']);
        sheet.getRow(1).font = { bold: true };
        personas?.forEach((p) => {
          sheet.addRow([p.persona_name, p.persona_type, p.age_range, p.has_children, p.market_weight, p.preferred_media]);
        });
        sheet.columns.forEach((col) => { col.width = 18; });
      }

      if (tabName === 'Influence & RP' || tabName === 'influence') {
        const { data: influence } = await supabase.from('lagostina_influence').select('*').order('week');
        const { data: press } = await supabase.from('lagostina_press').select('*').order('date', { ascending: false });

        const s1 = workbook.addWorksheet('Influence');
        s1.addRow(['Semaine', 'Nb influenceurs', 'Obj', 'Reach (M)', 'Obj', 'Engagement %', 'Obj', 'VTF', 'Obj', 'Conversion %', 'Obj', 'Coût/Reach', 'Obj']);
        s1.getRow(1).font = { bold: true };
        influence?.forEach((d) => {
          s1.addRow([d.week, d.influencer_count, d.influencer_count_obj, d.reach_millions, d.reach_millions_obj, d.engagement_rate, d.engagement_rate_obj, d.vtf, d.vtf_obj, d.conversion_rate, d.conversion_rate_obj, d.cost_per_reach, d.cost_per_reach_obj]);
        });
        s1.columns.forEach((col) => { col.width = 14; });

        const s2 = workbook.addWorksheet('Revue de presse');
        s2.addRow(['Date', 'Média', 'Titre', 'URL', 'Tonalité', 'Reach estimé', 'Journaliste']);
        s2.getRow(1).font = { bold: true };
        press?.forEach((p) => {
          s2.addRow([p.date, p.media_name, p.title, p.url, p.tonality, p.estimated_reach, p.journalist_name]);
        });
        s2.columns.forEach((col) => { col.width = 18; });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Lagostina_${tabName.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      toast.success('Export Excel téléchargé');
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors de l\'export Excel');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!chartsContainerId) return;
    setExporting(true);
    try {
      const el = document.getElementById(chartsContainerId);
      if (!el) { toast.error('Zone graphiques introuvable'); return; }

      const canvas = await html2canvas(el, { backgroundColor: '#0a0e1a', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`Dashboard Lagostina — ${tabName}`, 10, 8);
      pdf.text(`Export du ${new Date().toLocaleDateString('fr-FR')}`, 287 - 50, 8);

      const pageWidth = 287;
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      pdf.addImage(imgData, 'PNG', 10, 14, imgWidth, Math.min(imgHeight, 180));

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`Lagostina_${tabName.replace(/\s+/g, '_')}_Charts_${dateStr}.pdf`);
      toast.success('Export PDF téléchargé');
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

  const btnClass = "flex items-center justify-center h-8 w-8 text-black dark:text-[#E8FF4C] border border-black dark:border-[#E8FF4C] bg-transparent hover:bg-black hover:text-white dark:hover:bg-[#E8FF4C] dark:hover:text-black transition-colors disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate('/lagostina-admin?sync=auto')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-['Roboto'] font-medium text-black dark:text-[#E8FF4C] border border-black dark:border-[#E8FF4C] bg-transparent hover:bg-black hover:text-white dark:hover:bg-[#E8FF4C] dark:hover:text-black transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Mettre à jour les données
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={exportExcel} disabled={exporting} className={btnClass} aria-label="Exporter Excel">
            <span className="text-[10px] font-bold font-['Roboto'] leading-none">XLS</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Exporter Excel</TooltipContent>
      </Tooltip>

      {showPdf && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={exportPdf} disabled={exporting} className={btnClass} aria-label="Exporter PDF">
              <span className="text-[10px] font-bold font-['Roboto'] leading-none">PDF</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Exporter PDF</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
