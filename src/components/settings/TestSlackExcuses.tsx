import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ResultItem = { client: string; status: 'sent' | 'error'; error?: string; ideas?: string[] };

export function TestSlackExcuses() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultItem[] | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-slack-excuses', {
        body: { source: 'manual-test' },
      });
      if (error) throw error;

      const items: ResultItem[] = data?.results ?? [];
      setResults(items);

      if (data?.success && data?.sent > 0) {
        toast.success(`✅ ${data.sent}/${data.total} client(s) envoyé(s) sur #hubteam_sales`);
      } else if (data?.success && data?.sent === 0) {
        toast.info(data.message || 'Aucun client Target éligible (ni CR ni URL).');
      } else if (data?.error) {
        toast.error(`Échec : ${data.error}`, { duration: 8000 });
      }
    } catch (e) {
      const msg = (e as Error).message || 'Erreur inconnue';
      toast.error(`Échec : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Test — Idées de relance Slack (Targets)
        </CardTitle>
        <CardDescription>
          Génère pour chaque client <strong>Target</strong> 3 idées de relance basées sur les URLs surveillées,
          les 3 derniers comptes rendus et le site Hub & Up. Un message par client est posté sur{' '}
          <code className="text-xs">#hubteam_sales</code>. Les clients sans CR <em>et</em> sans URL sont ignorés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleTrigger} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Tester maintenant
            </>
          )}
        </Button>

        {results && results.length > 0 && (
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold mb-2">
                  {r.status === 'sent' ? '✅' : '❌'} {r.client}
                </p>
                {r.status === 'sent' && r.ideas ? (
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    {r.ideas.map((idea, j) => (
                      <li key={j}>{idea}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-destructive">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
