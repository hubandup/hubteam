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

interface ExportButtonProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
  label?: string;
}

export function ExportButton({ data, columns, filename, label = 'Exporter' }: ExportButtonProps) {
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

  if (data.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting} className="gap-2">
          <Download className="h-4 w-4" />
          {label}
        </Button>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
