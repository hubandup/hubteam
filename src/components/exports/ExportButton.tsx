import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ExportColumn {
  key: string;
  label: string;
  formatter?: (value: any, row: any) => string | number;
}

export interface ExportSheet {
  name: string;
  rows: Record<string, any>[];
}

interface ExportButtonProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
  label?: string;
  renderTrigger?: (opts: { isExporting: boolean }) => React.ReactNode;
  /** Optional loader for related data exported as additional Excel sheets */
  extraSheets?: () => Promise<ExportSheet[]>;
  extraSheetsLabel?: string;
}

export function ExportButton({ data, columns, filename, label = 'Exporter', renderTrigger, extraSheets, extraSheetsLabel = 'Export complet (Excel)' }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const formatData = () => {
    return data.map(row => {
      const formatted: Record<string, any> = {};
      columns.forEach(col => {
        const value = col.key.split('.').reduce((obj, key) => obj?.[key], row);
        formatted[col.label] = col.formatter ? col.formatter(value, row) : (value ?? '');
      });
      return formatted;
    });
  };

  const exportCSV = () => {
    try {
      setIsExporting(true);
      const formattedData = formatData();
      const headers = columns.map(c => c.label);
      const csvRows = [
        headers.join(';'),
        ...formattedData.map(row => 
          headers.map(h => {
            const val = String(row[h] ?? '');
            return val.includes(';') || val.includes('"') || val.includes('\n')
              ? `"${val.replace(/"/g, '""')}"` 
              : val;
          }).join(';')
        )
      ];
      const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for Excel UTF-8
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export CSV généré');
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error("Erreur lors de l'export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const exportExcel = () => {
    // Si des données associées existent, on exporte toujours le classeur complet
    if (extraSheets) return exportFull();
    try {
      setIsExporting(true);
      const formattedData = formatData();
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const widths = columns.map(col => ({ wch: Math.max(col.label.length + 2, 15) }));
      worksheet['!cols'] = widths;
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
      XLSX.writeFile(workbook, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Export Excel généré');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  // Excel limite une cellule à 32767 caractères
  const CELL_LIMIT = 32000;
  const sanitizeRows = (rows: Record<string, any>[]) =>
    rows.map(row => {
      const out: Record<string, any> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > CELL_LIMIT) {
          out[key] = value.slice(0, CELL_LIMIT) + '… [texte tronqué]';
        } else {
          out[key] = value;
        }
      });
      return out;
    });

  const exportFull = async () => {
    if (!extraSheets) return;
    try {
      setIsExporting(true);
      toast.info('Préparation de l\'export complet…');
      const sheets = await extraSheets();
      const workbook = XLSX.utils.book_new();

      const mainSheet = XLSX.utils.json_to_sheet(sanitizeRows(formatData()));
      mainSheet['!cols'] = columns.map(col => ({ wch: Math.max(col.label.length + 2, 15) }));
      XLSX.utils.book_append_sheet(workbook, mainSheet, 'Clients');

      sheets.forEach(sheet => {
        const rows = sanitizeRows(sheet.rows.length ? sheet.rows : [{ 'Aucune donnée': '' }]);
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = Object.keys(rows[0]).map(key => ({ wch: Math.max(key.length + 2, 20) }));
        XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31));
      });

      XLSX.writeFile(workbook, `${filename}-complet-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Export complet généré');
    } catch (error) {
      console.error('Full export error:', error);
      toast.error("Erreur lors de l'export complet");
    } finally {
      setIsExporting(false);
    }
  };

  if (data.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger({ isExporting })
        ) : (
          <Button variant="outline" disabled={isExporting} className="gap-2">
            <Download className="h-4 w-4" />
            {label}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>
          <FileText className="h-4 w-4 mr-2" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </DropdownMenuItem>
        {extraSheets && (
          <DropdownMenuItem onClick={exportFull}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {extraSheetsLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
