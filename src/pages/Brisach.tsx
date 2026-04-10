import { useState, useMemo, useCallback } from 'react';
import { useBrisachAccess } from '@/hooks/useBrisachAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Clock, FolderKanban, Calendar, Trash2, Flame, FileDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const FORFAIT_DAYS_PER_MONTH = 2;
const HOURS_PER_DAY = 7;
const FORFAIT_HOURS_PER_MONTH = FORFAIT_DAYS_PER_MONTH * HOURS_PER_DAY;

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function Brisach() {
  const { hasAccess, isLoading: accessLoading } = useBrisachAccess();
  const { role } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = role === 'admin' || role === 'team';

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [durationHours, setDurationHours] = useState('');
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['brisach-pao-entries', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brisach_pao_entries')
        .select('*')
        .gte('entry_date', `${selectedYear}-01-01`)
        .lte('entry_date', `${selectedYear}-12-31`)
        .order('entry_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('brisach_pao_entries').insert({
        entry_date: entryDate,
        duration_hours: parseFloat(durationHours),
        description: description || null,
        project_name: projectName || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brisach-pao-entries'] });
      toast.success('Entrée ajoutée');
      setDialogOpen(false);
      setDurationHours('');
      setDescription('');
      setProjectName('');
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brisach_pao_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brisach-pao-entries'] });
      toast.success('Entrée supprimée');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthEntries = entries.filter(e => parseISO(e.entry_date).getMonth() === i);
      const totalHours = monthEntries.reduce((sum, e) => sum + Number(e.duration_hours), 0);
      const projects = new Set(monthEntries.map(e => e.project_name).filter(Boolean));
      return {
        month: MONTHS[i],
        shortMonth: MONTHS[i].slice(0, 3),
        totalHours,
        totalDays: +(totalHours / HOURS_PER_DAY).toFixed(2),
        remaining: +(FORFAIT_HOURS_PER_MONTH - totalHours).toFixed(2),
        remainingDays: +((FORFAIT_HOURS_PER_MONTH - totalHours) / HOURS_PER_DAY).toFixed(2),
        projectCount: projects.size,
        overBudget: totalHours > FORFAIT_HOURS_PER_MONTH,
      };
    });
  }, [entries]);

  const yearTotals = useMemo(() => {
    const totalHours = entries.reduce((sum, e) => sum + Number(e.duration_hours), 0);
    const projects = new Set(entries.map(e => e.project_name).filter(Boolean));
    const forfaitAnnuel = FORFAIT_HOURS_PER_MONTH * 12;
    const activeMonths = monthlyData.filter(m => m.totalHours > 0).length;
    const avgDaysPerMonth = activeMonths > 0 ? +(totalHours / HOURS_PER_DAY / activeMonths).toFixed(2) : 0;
    const avgHoursPerMonth = activeMonths > 0 ? +(totalHours / activeMonths).toFixed(1) : 0;
    return {
      totalHours,
      totalDays: +(totalHours / HOURS_PER_DAY).toFixed(2),
      forfaitDays: FORFAIT_DAYS_PER_MONTH * 12,
      forfaitHours: forfaitAnnuel,
      remaining: +(forfaitAnnuel - totalHours).toFixed(2),
      remainingDays: +((forfaitAnnuel - totalHours) / HOURS_PER_DAY).toFixed(2),
      projectCount: projects.size,
      avgDaysPerMonth,
      avgHoursPerMonth,
      activeMonths,
    };
  }, [entries, monthlyData]);

  const exportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - margin * 2;

      // -- Header bar --
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, pageW, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Brisach — Suivi Forfait PAO', margin, 26);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Année ${selectedYear}  •  Forfait : ${FORFAIT_DAYS_PER_MONTH}j / mois (${FORFAIT_HOURS_PER_MONTH}h)`, margin, 35);

      // -- KPI Section --
      let y = 52;
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');

      const kpis = [
        { label: 'Consommé', days: `${yearTotals.totalDays}j`, hours: `${yearTotals.totalHours}h` },
        { label: 'Forfait annuel', days: `${yearTotals.forfaitDays}j`, hours: `${yearTotals.forfaitHours}h` },
        { label: 'Restant', days: `${yearTotals.remainingDays}j`, hours: `${yearTotals.remaining}h` },
        { label: 'Projets', days: `${yearTotals.projectCount}`, hours: '' },
        { label: 'Moyenne / mois', days: `${yearTotals.avgDaysPerMonth}j`, hours: `${yearTotals.avgHoursPerMonth}h` },
      ];

      const kpiW = contentW / kpis.length;
      kpis.forEach((kpi, i) => {
        const x = margin + i * kpiW;
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, y, kpiW - 4, 24, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(kpi.label, x + 5, y + 8);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        if (kpi.label === 'Restant' && yearTotals.remaining < 0) {
          doc.setTextColor(220, 50, 50);
        } else {
          doc.setTextColor(30, 30, 30);
        }
        doc.text(kpi.days, x + 5, y + 17);
        if (kpi.hours) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text(kpi.hours, x + 5, y + 22);
        }
      });

      // -- Chart capture --
      y = 84;
      const chartEl = document.getElementById('brisach-chart');
      if (chartEl) {
        const canvas = await html2canvas(chartEl, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const imgH = (contentW * canvas.height) / canvas.width;
        doc.addImage(imgData, 'PNG', margin, y, contentW, imgH);
        y += imgH + 8;
      }

      // -- Monthly table --
      if (y > pageH - 80) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Détail par mois', margin, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Mois', 'Consommé', 'Forfait', 'Restant', 'Projets']],
        body: [
          ...monthlyData.map(m => [
            m.month,
            `${m.totalDays}j (${m.totalHours}h)`,
            `${FORFAIT_DAYS_PER_MONTH}j`,
            `${m.remainingDays}j`,
            String(m.projectCount),
          ]),
          [
            'Moyenne / mois',
            `${yearTotals.avgDaysPerMonth}j (${yearTotals.avgHoursPerMonth}h)`,
            `${FORFAIT_DAYS_PER_MONTH}j`,
            '',
            '',
          ],
          [
            'Total',
            `${yearTotals.totalDays}j (${yearTotals.totalHours}h)`,
            `${yearTotals.forfaitDays}j`,
            `${yearTotals.remainingDays}j`,
            String(yearTotals.projectCount),
          ],
        ],
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        styles: { cellPadding: 3 },
        didParseCell: (data) => {
          const rowIdx = data.row.index;
          const isAvgRow = rowIdx === monthlyData.length;
          const isTotalRow = rowIdx === monthlyData.length + 1;
          if (isAvgRow) {
            data.cell.styles.fontStyle = 'italic';
            data.cell.styles.fillColor = [235, 245, 255];
            data.cell.styles.textColor = [60, 60, 60];
          }
          if (isTotalRow) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 230, 230];
            data.cell.styles.textColor = [20, 20, 20];
          }
          if (data.column.index === 3 && data.section === 'body' && !isAvgRow) {
            const m = monthlyData[rowIdx];
            if (m && m.remaining < 0) {
              data.cell.styles.textColor = [220, 50, 50];
              data.cell.styles.fontStyle = 'bold';
            }
            if (isTotalRow && yearTotals.remaining < 0) {
              data.cell.styles.textColor = [220, 50, 50];
            }
          }
        },
      });

      // -- Page 2: Détail des projets --
      doc.addPage();
      let y2 = 20;

      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Détail des entrées par projet', margin, 20);

      y2 = 40;

      // Group entries by project
      const projectGroups: Record<string, typeof entries> = {};
      entries.forEach(e => {
        const pName = e.project_name || 'Sans projet';
        if (!projectGroups[pName]) projectGroups[pName] = [];
        projectGroups[pName].push(e);
      });

      const projectSummary = Object.entries(projectGroups).map(([name, items]) => {
        const totalH = items.reduce((s, e) => s + Number(e.duration_hours), 0);
        return {
          name,
          entries: items.length,
          totalHours: +totalH.toFixed(1),
          totalDays: +(totalH / HOURS_PER_DAY).toFixed(2),
        };
      }).sort((a, b) => b.totalHours - a.totalHours);

      // Project summary table
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Récapitulatif par projet', margin, y2);
      y2 += 4;

      autoTable(doc, {
        startY: y2,
        margin: { left: margin, right: margin },
        head: [['Projet', 'Entrées', 'Temps (jours)', 'Temps (heures)', '% du total']],
        body: projectSummary.map(p => [
          p.name,
          String(p.entries),
          `${p.totalDays}j`,
          `${p.totalHours}h`,
          yearTotals.totalHours > 0 ? `${((p.totalHours / yearTotals.totalHours) * 100).toFixed(1)}%` : '0%',
        ]),
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        styles: { cellPadding: 3 },
      });

      // Detailed entries table
      const afterSummary = (doc as any).lastAutoTable?.finalY || y2 + 30;
      let y3 = afterSummary + 12;

      if (y3 > pageH - 40) {
        doc.addPage();
        y3 = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Détail chronologique', margin, y3);
      y3 += 4;

      autoTable(doc, {
        startY: y3,
        margin: { left: margin, right: margin },
        head: [['Date', 'Projet', 'Description', 'Durée']],
        body: entries.map(e => [
          format(parseISO(e.entry_date), 'dd/MM/yyyy'),
          e.project_name || '—',
          e.description || '—',
          `${Number(e.duration_hours).toFixed(1)}h`,
        ]),
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        styles: { cellPadding: 3 },
        columnStyles: {
          2: { cellWidth: 70 },
        },
      });

      // -- Footer --
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Brisach PAO — ${selectedYear}  •  Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}  •  Page ${i}/${pages}`,
          pageW / 2,
          pageH - 8,
          { align: 'center' }
        );
      }

      doc.save(`Brisach_PAO_${selectedYear}.pdf`);
      toast.success('PDF exporté avec succès');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  }, [selectedYear, monthlyData, yearTotals]);

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  const chartData = monthlyData.map(m => ({
    name: m.shortMonth,
    consomme: m.totalDays,
    forfait: FORFAIT_DAYS_PER_MONTH,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Flame className="h-8 w-8 text-orange-500" />
            Brisach — Suivi Forfait PAO
          </h1>
          <p className="text-muted-foreground mt-1">
            Forfait : {FORFAIT_DAYS_PER_MONTH} jours / mois ({FORFAIT_HOURS_PER_MONTH}h)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={exportPdf} disabled={exporting}>
            <FileDown className="h-4 w-4 mr-2" />
            {exporting ? 'Export...' : 'Export PDF'}
          </Button>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter du temps
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter une entrée PAO</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Durée (heures)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Ex: 3.5"
                      value={durationHours}
                      onChange={e => setDurationHours(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Projet associé</Label>
                    <Input
                      placeholder="Nom du projet"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Description du travail effectué..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                  <Button
                    onClick={() => addMutation.mutate()}
                    disabled={!durationHours || !entryDate || addMutation.isPending}
                  >
                    Ajouter
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Consommé (année)</p>
                <p className="text-2xl font-bold">{yearTotals.totalDays}j</p>
                <p className="text-xs text-muted-foreground">{yearTotals.totalHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Forfait annuel</p>
                <p className="text-2xl font-bold">{yearTotals.forfaitDays}j</p>
                <p className="text-xs text-muted-foreground">{yearTotals.forfaitHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Restant</p>
                <p className={`text-2xl font-bold ${yearTotals.remaining < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {yearTotals.remainingDays}j
                </p>
                <p className="text-xs text-muted-foreground">{yearTotals.remaining}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Moyenne / mois</p>
                <p className="text-2xl font-bold">{yearTotals.avgDaysPerMonth}j</p>
                <p className="text-xs text-muted-foreground">{yearTotals.avgHoursPerMonth}h ({yearTotals.activeMonths} mois actifs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Projets</p>
                <p className="text-2xl font-bold">{yearTotals.projectCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consommation mensuelle (jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <div id="brisach-chart" className="h-[280px] bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value}j`,
                    name === 'consomme' ? 'Consommé' : 'Forfait'
                  ]}
                  contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                />
                <ReferenceLine y={FORFAIT_DAYS_PER_MONTH} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Forfait', position: 'right', fontSize: 11 }} />
                <Bar dataKey="consomme" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.consomme > FORFAIT_DAYS_PER_MONTH ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail par mois</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Consommé</TableHead>
                <TableHead className="text-right">Forfait</TableHead>
                <TableHead className="text-right">Restant</TableHead>
                <TableHead className="text-right">Projets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{m.month}</TableCell>
                  <TableCell className="text-right">{m.totalDays}j ({m.totalHours}h)</TableCell>
                  <TableCell className="text-right">{FORFAIT_DAYS_PER_MONTH}j</TableCell>
                  <TableCell className={`text-right ${m.remaining < 0 ? 'text-destructive font-medium' : ''}`}>
                    {m.remainingDays}j
                  </TableCell>
                  <TableCell className="text-right">{m.projectCount}</TableCell>
                </TableRow>
              ))}
              {/* Average row */}
              <TableRow className="border-t bg-muted/30">
                <TableCell className="font-medium italic">Moyenne / mois</TableCell>
                <TableCell className="text-right italic">{yearTotals.avgDaysPerMonth}j ({yearTotals.avgHoursPerMonth}h)</TableCell>
                <TableCell className="text-right italic">{FORFAIT_DAYS_PER_MONTH}j</TableCell>
                <TableCell className="text-right italic">—</TableCell>
                <TableCell className="text-right italic">—</TableCell>
              </TableRow>
              {/* Total row */}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{yearTotals.totalDays}j ({yearTotals.totalHours}h)</TableCell>
                <TableCell className="text-right">{yearTotals.forfaitDays}j</TableCell>
                <TableCell className={`text-right ${yearTotals.remaining < 0 ? 'text-destructive' : ''}`}>
                  {yearTotals.remainingDays}j
                </TableCell>
                <TableCell className="text-right">{yearTotals.projectCount}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Entries list */}
      {canEdit && entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrées détaillées</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(parseISO(entry.entry_date), 'dd MMM yyyy', { locale: fr })}</TableCell>
                    <TableCell>{entry.project_name || '—'}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{entry.description || '—'}</TableCell>
                    <TableCell className="text-right">{Number(entry.duration_hours)}h</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteMutation.mutate(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
