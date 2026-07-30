import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useSuppliers } from "@/hooks/usePurchasing";

type MatchKind = "id" | "api_custom" | "name" | "new";

interface Proposal {
  fp_id: number;
  fp_company_name: string;
  fp_city: string | null;
  match: MatchKind;
  hub_id: string | null;
  hub_company_name: string | null;
}

const MATCH_LABEL: Record<MatchKind, string> = {
  id: "Déjà lié",
  api_custom: "Rapproché (identifiant)",
  name: "Rapproché (nom)",
  new: "Nouveau",
};

/** Import initial des fournisseurs depuis la comptabilité, avec confirmation avant fusion. */
export function SupplierImportPanel() {
  const queryClient = useQueryClient();
  const { data: suppliers = [] } = useSuppliers();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    if (!proposals) return null;
    let merge = 0;
    let create = 0;
    let skip = 0;
    for (const p of proposals) {
      const d = decisions[String(p.fp_id)] ?? (p.hub_id ?? "new");
      if (d === "skip") skip++;
      else if (d === "new") create++;
      else merge++;
    }
    return { merge, create, skip };
  }, [proposals, decisions]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-suppliers-facturation", {
        body: { mode: "preview" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setProposals((data?.proposals ?? []) as Proposal[]);
      setDecisions({});
      toast.success(`${data?.total ?? 0} fournisseur(s) trouvé(s) en comptabilité`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!proposals) return;
    setApplying(true);
    try {
      const payload: Record<string, string> = {};
      for (const p of proposals) payload[String(p.fp_id)] = decisions[String(p.fp_id)] ?? (p.hub_id ?? "new");
      const { data, error } = await supabase.functions.invoke("import-suppliers-facturation", {
        body: { mode: "apply", decisions: payload },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(
        `${data.created} créé(s), ${data.updated} mis à jour, ${data.skipped} ignoré(s)`,
      );
      if (Array.isArray(data.errors) && data.errors.length) {
        toast.warning(`${data.errors.length} erreur(s) : ${data.errors[0]}`);
      }
      setProposals(null);
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-3xl border bg-card p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">Importer les fournisseurs de la comptabilité</p>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Récupère l'annuaire fournisseurs de la comptabilité. Les doublons éventuels sont
            rapprochés par identifiant puis par nom d'entreprise ; vous confirmez chaque fusion
            avant application.
          </p>
        </div>
        <Button onClick={loadPreview} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Analyser
        </Button>
      </div>

      {proposals ? (
        <>
          {counts ? (
            <p className="text-sm text-muted-foreground">
              {counts.create} création(s) · {counts.merge} fusion(s) · {counts.skip} ignoré(s)
            </p>
          ) : null}

          <div className="rounded-2xl border overflow-hidden max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comptabilité</TableHead>
                  <TableHead className="hidden sm:table-cell">Rapprochement</TableHead>
                  <TableHead className="w-72">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => {
                  const value = decisions[String(p.fp_id)] ?? (p.hub_id ?? "new");
                  return (
                    <TableRow key={p.fp_id}>
                      <TableCell>
                        <span className="font-medium">{p.fp_company_name}</span>
                        {p.fp_city ? (
                          <span className="block text-xs text-muted-foreground">{p.fp_city}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={p.match === "new" ? "secondary" : "outline"}>
                          {MATCH_LABEL[p.match]}
                        </Badge>
                        {p.hub_company_name ? (
                          <span className="block text-xs text-muted-foreground">
                            {p.hub_company_name}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={value}
                          onValueChange={(v) =>
                            setDecisions((prev) => ({ ...prev, [String(p.fp_id)]: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            <SelectItem value="new">Créer un nouveau fournisseur</SelectItem>
                            <SelectItem value="skip">Ignorer</SelectItem>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                Fusionner avec « {s.company_name} »
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setProposals(null)} disabled={applying}>
              Annuler
            </Button>
            <Button onClick={apply} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmer l'import
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
