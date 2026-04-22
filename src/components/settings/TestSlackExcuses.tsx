import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function TestSlackExcuses() {
  const [loading, setLoading] = useState(false);
  const [lastExcuses, setLastExcuses] = useState<string[] | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setLastExcuses(null);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-slack-excuses', {
        body: { source: 'manual-test' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const excuses: string[] = data?.excuses ?? [];
      setLastExcuses(excuses);
      toast.success(`✅ ${excuses.length} excuse(s) publiées sur #hubteam_sales`);
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
          <MessageSquare className="h-5 w-5" />
          Test — Excuses Slack hebdomadaires
        </CardTitle>
        <CardDescription>
          Déclenche manuellement la génération et l'envoi de 3 excuses sur le canal{' '}
          <code className="text-xs">#hubteam_sales</code>. La déduplication des semaines précédentes est appliquée.
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

        {lastExcuses && lastExcuses.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-4">
            <p className="text-sm font-medium mb-2">Dernières excuses envoyées :</p>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {lastExcuses.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
