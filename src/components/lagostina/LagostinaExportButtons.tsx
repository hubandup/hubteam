import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLagostinaSync } from '@/hooks/useLagostinaSync';

function getCondFill(actual: number | null, objective: number | null): Partial<ExcelJS.Fill> | undefined {
  if (actual == null || objective == null || objective === 0) return undefined;
  const ratio = actual / objective;
  if (ratio >= 1) return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF22c55e' } };
  if (ratio >= 0.8) return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8FF4C' } };
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFef4444' } };
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1f2e' } };
  sheet.getRow(1).alignment = { horizontal: 'center' };
}

interface ExportButtonsProps {
  tabName: string;
  showPdf?: boolean;
  chartsContainerId?: string;
}

export function LagostinaExportButtons({ tabName, showPdf = false, chartsContainerId }: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);
  const { syncing, syncFromKDrive } = useLagostinaSync();

  const exportExcel = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Hub & Up — Dashboard Lagostina';
      workbook.created = new Date();
      const dateStr = new Date().toISOString().slice(0, 10);

      if (tabName === 'Budget') {
        const { data } = await supabase.from('lagostina_budget').select('*');
        const sheet = workbook.addWorksheet('Budget');
        sheet.addRow(['Levier', 'Mois', 'Prévu', 'Engagé', 'Facturé', 'Restant']);
        styleHeaderRow(sheet);
        data?.forEach((b) => {
          sheet.addRow([b.levier, b.month, b.planned, b.engaged, b.invoiced, (Number(b.planned) || 0) - (Number(b.engaged) || 0)]);
        });
        sheet.columns.forEach((col) => { col.width = 15; });
      }

      if (tabName === 'Scorecard') {
        const { data } = await supabase.from('lagostina_scorecards').select('*').order('week');
        const sheet = workbook.addWorksheet('Scorecard');
        sheet.addRow(['Priorité', 'Levier', 'KPI', 'Semaine', 'Mois', 'Actual', 'Objectif']);
        styleHeaderRow(sheet);
        data?.forEach((s) => {
          const row = sheet.addRow([s.priority, s.levier, s.kpi_name, s.week, s.month, s.actual, s.objective]);
          const fill = getCondFill(Number(s.actual), Number(s.objective));
          if (fill) row.getCell(6).fill = fill as ExcelJS.Fill;
        });
        sheet.columns.forEach((col) => { col.width = 16; });
      }

      if (tabName === 'Influence & RP') {
        const { data: influence } = await supabase.from('lagostina_influence').select('*').order('week');
        const { data: press } = await supabase.from('lagostina_press').select('*').order('date', { ascending: false });

        const s1 = workbook.addWorksheet('Influence');
        s1.addRow(['Semaine', 'Nb influenceurs', 'Obj', 'Reach (M)', 'Obj', 'Engagement %', 'Obj', 'VTF', 'Obj', 'Conversion %', 'Obj', 'Coût/Reach', 'Obj']);
        styleHeaderRow(s1);
        influence?.forEach((d) => {
          s1.addRow([d.week, d.influencer_count, d.influencer_count_obj, d.reach_millions, d.reach_millions_obj, d.engagement_rate, d.engagement_rate_obj, d.vtf, d.vtf_obj, d.conversion_rate, d.conversion_rate_obj, d.cost_per_reach, d.cost_per_reach_obj]);
        });
        s1.columns.forEach((col) => { col.width = 14; });

        const s2 = workbook.addWorksheet('Revue de presse');
        s2.addRow(['Date', 'Média', 'Titre', 'URL', 'Tonalité', 'Reach estimé', 'Journaliste']);
        styleHeaderRow(s2);
        press?.forEach((p) => {
          s2.addRow([p.date, p.media_name, p.title, p.url, p.tonality, p.estimated_reach, p.journalist_name]);
        });
        s2.columns.forEach((col) => { col.width = 18; });
      }

      if (tabName === 'Médiatisation') {
        const { data } = await supabase.from('lagostina_media_kpis').select('*').order('week');
        const channels = [...new Set(data?.map((d) => d.channel) || [])];

        channels.forEach((channel) => {
          const rows = data?.filter((d) => d.channel === channel) || [];
          const sheetName = channel.toUpperCase().slice(0, 31);
          const sheet = workbook.addWorksheet(sheetName);
          sheet.addRow(['KPI', 'Semaine', 'Actual', 'Objectif', 'Budget alloué', 'Budget dépensé']);
          styleHeaderRow(sheet);
          rows.forEach((r) => {
            const row = sheet.addRow([r.kpi_name, r.week, r.actual, r.objective, r.budget_allocated, r.budget_spent]);
            const fill = getCondFill(Number(r.actual), Number(r.objective));
            if (fill) row.getCell(3).fill = fill as ExcelJS.Fill;
          });
          sheet.columns.forEach((col) => { col.width = 16; });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Lagostina_${tabName.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      toast.success('Export Excel téléchargé');
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExporting(false);
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const exportPdf = async () => {
    if (!chartsContainerId) return;
    setExporting(true);
    try {
      const el = document.getElementById(chartsContainerId);
      if (!el) { toast.error('Zone introuvable'); return; }

      // Detect theme
      const isDark = document.documentElement.classList.contains('dark');
      const bgColor = isDark ? '#0a0e1a' : '#ffffff';

      // Load logos
      const [logoHeader, logoFooter] = await Promise.all([
        loadImage('/logo-hubandup-horizontal.png').catch(() => null),
        loadImage('/logo-hubandup-signature.png').catch(() => null),
      ]);

      const canvas = await html2canvas(el, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentStartY = margin;
      const footerH = 22;
      const footerStartY = pageHeight - margin - footerH;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = footerStartY - contentStartY;

      // Calculate total image height in mm
      const imgWidthMm = usableWidth;
      const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;

      const addHeaderFooter = (pageNum: number, totalPages: number) => {

        // --- FOOTER ---
        const footerY = pageHeight - margin;

        // Separator line
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.line(margin, footerY - footerH, pageWidth - margin, footerY - footerH);

        // DOCUMENT CONFIDENTIEL
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(30, 30, 30);
        pdf.text('DOCUMENT CONFIDENTIEL', margin, footerY - footerH + 5);

        // Legal text
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(5.5);
        pdf.setTextColor(120, 120, 120);
        pdf.text(
          'HUB AND UP S.A.S au Capital de 10 000 € - RCS Lyon B 904 096 435 – TVA : FR52904096435',
          margin, footerY - footerH + 10
        );
        pdf.text(
          '59, chemin du moulin Carron F-69570 Dardilly – tél. 04 72 19 19 78 – contact@hubandup.com',
          margin, footerY - footerH + 14
        );

        // Page number
        pdf.setFontSize(6);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Page ${pageNum}/${totalPages}`, pageWidth / 2, footerY - 2, { align: 'center' });

        // Footer logo bottom-right
        if (logoFooter) {
          const fLogoH = 2.4;
          const fLogoW = (logoFooter.width / logoFooter.height) * fLogoH;
          pdf.addImage(logoFooter, 'PNG', pageWidth - margin - fLogoW, footerY - fLogoH - 4, fLogoW, fLogoH);
        }
      };

      const totalPages = Math.max(1, Math.ceil(imgHeightMm / usableHeight));

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = (page * usableHeight / imgHeightMm) * canvas.height;
        const srcH = Math.min((usableHeight / imgHeightMm) * canvas.height, canvas.height - srcY);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = (srcH / canvas.width) * imgWidthMm;
        pdf.addImage(sliceData, 'PNG', margin, contentStartY, imgWidthMm, sliceHeightMm);

        addHeaderFooter(page + 1, totalPages);
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`Lagostina_${tabName.replace(/\s+/g, '_')}_${dateStr}.pdf`);
      toast.success('Export PDF téléchargé');
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  };

  const btnClass = "flex items-center justify-center h-8 w-8 text-black dark:text-[#E8FF4C] border border-black dark:border-[#E8FF4C] bg-transparent hover:bg-black hover:text-white dark:hover:bg-[#E8FF4C] dark:hover:text-black transition-colors disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => syncFromKDrive()}
        disabled={syncing}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-['Roboto'] font-medium text-black dark:text-[#E8FF4C] border border-black dark:border-[#E8FF4C] bg-transparent hover:bg-black hover:text-white dark:hover:bg-[#E8FF4C] dark:hover:text-black transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Synchronisation…' : 'Mettre à jour les données'}
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
          <TooltipContent>Exporter PDF (vue active)</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
