import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

type BankLine = {
  id: string;
  line_date: string | null;
  label: string;
  raw_text: string;
  amount: number | null;
  matched_invoice_id: string | null;
};

type Invoice = {
  id: string;
  supplier: string;
  amount_ttc: number | null;
  invoice_date: string | null;
};

// Heuristic: extract a clean supplier name from a bank line label.
const NOISE = new Set([
  "vir", "virement", "prlv", "prelvt", "prelvmt", "prelevement", "sepa",
  "fact", "facture", "multi", "pro", "cb", "carte", "paiement",
  "europeen", "european", "eur", "ref", "rum", "mandat", "dont", "tva",
  "du", "le", "de", "la", "les", "et", "pour", "par",
]);

const cleanSupplier = (label: string): string => {
  const tokens = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s,;:/|()\-_.]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !/^\d+[.,]?\d*$/.test(t)) // pure numbers
    .filter((t) => !/^[A-Z0-9]{6,}$/.test(t) || /[A-Z]{4,}/.test(t)) // long codes
    .filter((t) => !NOISE.has(t.toLowerCase()))
    .filter((t) => !/^\d/.test(t)) // tokens starting with digit
    .filter((t) => t.length >= 2);

  const out = tokens.slice(0, 4).join(" ").toUpperCase();
  return out || "INCONNU";
};

const normKey = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");

export function SuppliersList() {
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "complete">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: lines }, { data: invs }, { data: aliasRows }] = await Promise.all([
        supabase
          .from("bank_statement_lines")
          .select("id, line_date, label, raw_text, amount, matched_invoice_id")
          .order("line_date", { ascending: false }),
        supabase
          .from("supplier_invoices")
          .select("id, supplier, amount_ttc, invoice_date"),
        supabase
          .from("supplier_name_aliases")
          .select("key, display_name"),
      ]);

      const aliasMap: Record<string, string> = {};
      for (const a of (aliasRows as { key: string; display_name: string }[] ?? [])) {
        aliasMap[a.key] = a.display_name;
      }
      setAliases(aliasMap);

      // Keep only debit lines (supplier expenses). Bank statements store amounts
      // as positive numbers; the debit/credit info lives in raw_text columns.
      // A debit row has a "-<number>" token (e.g. "| -126.2 |"). Exclude solde rows.
      const isDebit = (l: BankLine): boolean => {
        const lbl = (l.label || "").toLowerCase();
        if (lbl.startsWith("solde") || lbl.includes("solde au ")) return false;
        return /\|\s*-\s*\d/.test(l.raw_text || "");
      };

      // Dedupe identical rows (same date + label + amount) coming from
      // overlapping bank statements.
      const seen = new Set<string>();
      const filtered: BankLine[] = [];
      for (const l of ((lines as BankLine[]) ?? [])) {
        if (!isDebit(l)) continue;
        const key = `${l.line_date ?? ""}|${(l.label ?? "").trim()}|${Number(l.amount ?? 0).toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        filtered.push(l);
      }

      setBankLines(filtered);
      setInvoices((invs as Invoice[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const suppliers = useMemo(() => {
    type Row = {
      key: string;
      name: string;
      total: number;
      txCount: number;
      lines: BankLine[];
      matchedInvoiceIds: Set<string>;
      missingLines: BankLine[];
      invoices: Invoice[];
    };
    const map = new Map<string, Row>();

    // Group bank lines
    for (const l of bankLines) {
      const name = cleanSupplier(l.label);
      const key = normKey(name);
      if (!key) continue;
      const r = map.get(key) ?? {
        key,
        name,
        total: 0,
        txCount: 0,
        lines: [],
        matchedInvoiceIds: new Set<string>(),
        missingLines: [],
        invoices: [],
      };
      r.total += Number(l.amount ?? 0);
      r.txCount += 1;
      r.lines.push(l);
      if (l.matched_invoice_id) r.matchedInvoiceIds.add(l.matched_invoice_id);
      else r.missingLines.push(l);
      map.set(key, r);
    }

    // Attach invoices (matched by id OR by supplier-name normalisation)
    const invById = new Map(invoices.map((i) => [i.id, i]));
    for (const r of map.values()) {
      for (const id of r.matchedInvoiceIds) {
        const inv = invById.get(id);
        if (inv) r.invoices.push(inv);
      }
    }
    for (const inv of invoices) {
      const k = normKey(inv.supplier || "");
      if (!k) continue;
      // find a row whose key contains or is contained in invoice key
      for (const r of map.values()) {
        if (r.invoices.some((i) => i.id === inv.id)) continue;
        if (r.key.includes(k) || k.includes(r.key)) {
          r.invoices.push(inv);
          break;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [bankLines, invoices]);

  const displayNameOf = (key: string, fallback: string) => aliases[key] ?? fallback;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return suppliers.filter((s) => {
      const dn = (aliases[s.key] ?? s.name).toLowerCase();
      if (q && !dn.includes(q) && !s.name.toLowerCase().includes(q)) return false;
      if (filter === "missing" && s.missingLines.length === 0) return false;
      if (filter === "complete" && s.missingLines.length > 0) return false;
      return true;
    });
  }, [suppliers, search, filter, aliases]);

  const startEdit = (key: string, currentName: string) => {
    setEditingKey(key);
    setEditValue(currentName);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const saveEdit = async (key: string, originalName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }
    if (trimmed === originalName) {
      const { error } = await supabase
        .from("supplier_name_aliases")
        .delete()
        .eq("key", key);
      if (error) {
        toast.error("Erreur lors de la suppression de l'alias");
        return;
      }
      setAliases((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      const { error } = await supabase
        .from("supplier_name_aliases")
        .upsert({ key, display_name: trimmed, updated_at: new Date().toISOString() });
      if (error) {
        toast.error("Erreur lors du renommage");
        return;
      }
      setAliases((prev) => ({ ...prev, [key]: trimmed }));
    }
    toast.success("Fournisseur renommé");
    cancelEdit();
  };

  const stats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const withMissing = suppliers.filter((s) => s.missingLines.length > 0).length;
    const totalMissing = suppliers.reduce((acc, s) => acc + s.missingLines.length, 0);
    const totalMissingAmount = suppliers.reduce(
      (acc, s) => acc + s.missingLines.reduce((a, l) => a + Number(l.amount ?? 0), 0),
      0,
    );
    return { totalSuppliers, withMissing, totalMissing, totalMissingAmount };
  }, [suppliers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Fournisseurs</div>
          <div className="text-2xl font-bold mt-1">{stats.totalSuppliers}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Avec factures manquantes</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{stats.withMissing}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Lignes sans facture</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{stats.totalMissing}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Montant non justifié</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{eur(stats.totalMissingAmount)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un fournisseur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-none"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "missing", "complete"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs border ${
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              {f === "all" ? "Tous" : f === "missing" ? "Factures manquantes" : "Complets"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="text-right">Dépenses totales</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Factures</TableHead>
              <TableHead className="text-right">Manquantes</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun fournisseur trouvé.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const isOpen = expanded === s.key;
                const missingAmount = s.missingLines.reduce((a, l) => a + Number(l.amount ?? 0), 0);
                return (
                  <Fragment key={s.key}>
                    <TableRow
                      key={s.key}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpanded(isOpen ? null : s.key)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                          {editingKey === s.key ? (
                            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(s.key, s.name);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                autoFocus
                                className="h-7 text-sm rounded-none"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-none"
                                onClick={() => saveEdit(s.key, s.name)}
                                title="Enregistrer"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-none"
                                onClick={cancelEdit}
                                title="Annuler"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span>{displayNameOf(s.key, s.name)}</span>
                              {aliases[s.key] && aliases[s.key] !== s.name && (
                                <span className="text-xs text-muted-foreground italic">({s.name})</span>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 rounded-none opacity-50 hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(s.key, displayNameOf(s.key, s.name));
                                }}
                                title="Renommer"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{eur(s.total)}</TableCell>
                      <TableCell className="text-right">{s.txCount}</TableCell>
                      <TableCell className="text-right">{s.invoices.length}</TableCell>
                      <TableCell className="text-right">
                        {s.missingLines.length > 0 ? (
                          <span className="text-red-600 font-semibold">
                            {s.missingLines.length} ({eur(missingAmount)})
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.missingLines.length > 0 ? (
                          <Badge variant="outline" className="border-red-600 text-red-600 rounded-none">
                            <AlertCircle className="h-3 w-3 mr-1" /> Incomplet
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-600 text-green-600 rounded-none">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={s.key + "-detail"} className="bg-muted/30">
                        <TableCell colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Missing invoices */}
                            <div>
                              <div className="text-xs uppercase font-semibold mb-2 text-red-600">
                                Factures manquantes ({s.missingLines.length})
                              </div>
                              {s.missingLines.length === 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  Aucune facture manquante.
                                </div>
                              ) : (
                                <div className="space-y-1 max-h-64 overflow-auto">
                                  {s.missingLines.map((l) => (
                                    <div
                                      key={l.id}
                                      className="flex justify-between gap-2 text-xs border-b border-border/60 py-1.5"
                                    >
                                      <span className="text-muted-foreground">
                                        {l.line_date
                                          ? format(new Date(l.line_date + "T00:00:00"), "dd/MM/yyyy")
                                          : "—"}
                                      </span>
                                      <span className="flex-1 truncate" title={l.label}>
                                        {l.label}
                                      </span>
                                      <span className="font-semibold">{eur(Number(l.amount ?? 0))}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Known invoices */}
                            <div>
                              <div className="text-xs uppercase font-semibold mb-2 text-green-600">
                                Factures connues ({s.invoices.length})
                              </div>
                              {s.invoices.length === 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  Aucune facture enregistrée pour ce fournisseur.
                                </div>
                              ) : (
                                <div className="space-y-1 max-h-64 overflow-auto">
                                  {s.invoices.map((i) => (
                                    <div
                                      key={i.id}
                                      className="flex justify-between gap-2 text-xs border-b border-border/60 py-1.5"
                                    >
                                      <span className="text-muted-foreground">
                                        {i.invoice_date
                                          ? format(new Date(i.invoice_date + "T00:00:00"), "dd/MM/yyyy")
                                          : "—"}
                                      </span>
                                      <span className="flex-1 truncate" title={i.supplier}>
                                        {i.supplier}
                                      </span>
                                      <span className="font-semibold">
                                        {eur(Number(i.amount_ttc ?? 0))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
