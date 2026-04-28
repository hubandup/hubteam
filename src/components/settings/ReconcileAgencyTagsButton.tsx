import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Change {
  agencyId: string;
  agencyName: string;
  before: string[];
  after: string[];
  remappings: { from: string; to: string }[];
  stillUnknown: string[];
}

interface Report {
  dryRun: boolean;
  agenciesScanned: number;
  agenciesAffected: number;
  applied: number;
  uniqueRemappings: { from: string; to: string }[];
  stillUnknown: string[];
  changes: Change[];
}

export function ReconcileAgencyTagsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const runScan = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        'reconcile-agency-tags',
        { body: { dryRun: true } },
      );
      if (error) throw error;
      setReport(data as Report);
      setOpen(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erreur lors du scan');
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'reconcile-agency-tags',
        { body: { dryRun: false } },
      );
      if (error) throw error;
      const r = data as Report;
      toast.success(`${r.applied} agence(s) mise(s) à jour`);
      setReport(r);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erreur lors de l'application");
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={runScan} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Réconcilier les tags d'agences
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Réconciliation des tags d'agences</DialogTitle>
            <DialogDescription>
              {report?.dryRun
                ? 'Aperçu — aucune modification appliquée pour le moment.'
                : 'Appliqué.'}
            </DialogDescription>
          </DialogHeader>

          {report && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="border p-3">
                  <div className="text-muted-foreground">Agences scannées</div>
                  <div className="text-2xl font-semibold">
                    {report.agenciesScanned}
                  </div>
                </div>
                <div className="border p-3">
                  <div className="text-muted-foreground">À mettre à jour</div>
                  <div className="text-2xl font-semibold">
                    {report.agenciesAffected}
                  </div>
                </div>
                <div className="border p-3">
                  <div className="text-muted-foreground">Tags inconnus restants</div>
                  <div className="text-2xl font-semibold">
                    {report.stillUnknown.length}
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[400px] border p-3">
                {report.uniqueRemappings.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h4 className="font-semibold text-sm">
                      Mappings détectés ({report.uniqueRemappings.length})
                    </h4>
                    <div className="space-y-1">
                      {report.uniqueRemappings.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm py-1 border-b border-dashed"
                        >
                          <Badge variant="outline" className="border-dashed">
                            {r.from}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Badge variant="secondary">{r.to}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {report.stillUnknown.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Tags inconnus (conservés tels quels)
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {report.stillUnknown.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="border-dashed text-muted-foreground text-xs"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ajoutez-les manuellement au référentiel pour qu'ils soient
                      reconnus.
                    </p>
                  </div>
                )}

                {report.uniqueRemappings.length === 0 &&
                  report.stillUnknown.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      ✓ Tous les tags d'agences correspondent déjà au référentiel.
                    </p>
                  )}
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fermer
            </Button>
            {report && report.dryRun && report.agenciesAffected > 0 && (
              <Button onClick={apply} disabled={applying}>
                {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Appliquer les {report.agenciesAffected} mise(s) à jour
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
