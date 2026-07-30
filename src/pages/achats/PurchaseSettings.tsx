import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { AppSkeleton } from "@/components/AppSkeleton";
import { SupplierImportPanel } from "@/components/achats/SupplierImportPanel";
import {
  useAccountingCategories,
  usePurchaseCategories,
  useVatRates,
  useCompanySettings,
  type PurchaseCategory,
  type VatRate,
} from "@/hooks/usePurchasing";

const SYNC_FLAG_KEY = "po_facturation_pro_sync_enabled";

/** Flag d'activation de l'écriture du n° de PO sur les devis facturation.pro. */
function SyncTab() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_config")
      .select("value")
      .eq("key", SYNC_FLAG_KEY)
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(["true", "1", "on", "yes"].includes(String(data?.value ?? "").toLowerCase()));
        setLoading(false);
      });
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase.from("app_config").upsert(
      {
        key: SYNC_FLAG_KEY,
        value: next ? "true" : "false",
        description: "Écriture du n° de bon de commande sur le devis facturation.pro à l'envoi",
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Enregistrement impossible");
      return;
    }
    setEnabled(next);
    toast.success(next ? "Synchronisation activée" : "Synchronisation désactivée");
  };

  if (loading) return <AppSkeleton />;

  return (
    <div className="space-y-4">
    <div className="rounded-3xl border bg-card p-6 max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-medium">Reporter le n° de PO dans facturation.pro</p>
          <p className="text-sm text-muted-foreground">
            À l'envoi d'un bon de commande, le numéro est ajouté aux notes du devis correspondant.
            En cas d'échec, l'envoi au fournisseur n'est jamais bloqué : le bon de commande est
            marqué « À reporter manuellement » et la synchronisation peut être relancée.
          </p>
        </div>
        <Switch checked={enabled} disabled={saving} onCheckedChange={toggle} />
      </div>
    </div>

    <SupplierImportPanel />
    </div>
  );
}

export default function PurchaseSettings() {
  const { role, loading } = useUserRole();

  if (loading) return <AppSkeleton />;
  if (role !== "admin") return <Navigate to="/achats/fournisseurs" replace />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Paramètres achats"
        subtitle="Catégories, taux de TVA et coordonnées société imprimées sur les bons de commande"
      />

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Catégories d'achat</TabsTrigger>
          <TabsTrigger value="vat">Taux de TVA</TabsTrigger>
          <TabsTrigger value="company">Coordonnées société</TabsTrigger>
          <TabsTrigger value="sync">Synchronisation</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="vat" className="mt-4">
          <VatRatesTab />
        </TabsContent>
        <TabsContent value="company" className="mt-4">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="sync" className="mt-4">
          <SyncTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Message explicite quand la suppression est refusée par une contrainte d'intégrité. */
function isInUseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /foreign key|violates|23503/i.test(message);
}

/* -------------------------------- Catégories -------------------------------- */

function CategoriesTab() {
  const { data: categories = [], isLoading } = usePurchaseCategories();
  const queryClient = useQueryClient();
  const { data: accountingCategories = [], isLoading: loadingAccounting, error: accountingError } =
    useAccountingCategories();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["purchase-categories"] });

  const create = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Le nom est obligatoire");
    if (name.length > 100) return toast.error("Maximum 100 caractères");
    setBusy(true);
    const { error } = await supabase
      .from("purchase_categories")
      .insert({ name, sort_order: categories.length + 1 });
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "Cette catégorie existe déjà" : `Création impossible : ${error.message}`,
      );
      return;
    }
    setNewName("");
    toast.success("Catégorie créée");
    refresh();
  };

  const rename = async (cat: PurchaseCategory, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === cat.name) return;
    const { error } = await supabase
      .from("purchase_categories")
      .update({ name: trimmed })
      .eq("id", cat.id);
    if (error) {
      toast.error(error.code === "23505" ? "Ce nom est déjà utilisé" : error.message);
      return;
    }
    toast.success("Catégorie renommée");
    refresh();
  };

  const setAccountingCategory = async (cat: PurchaseCategory, value: string) => {
    const id = value === "none" ? null : Number(value);
    const { error } = await supabase
      .from("purchase_categories")
      .update({ facturation_pro_category_id: id })
      .eq("id", cat.id);
    if (error) return toast.error(error.message);
    toast.success("Correspondance comptable enregistrée");
    refresh();
  };

  const toggle = async (cat: PurchaseCategory) => {
    const { error } = await supabase
      .from("purchase_categories")
      .update({ is_active: !cat.is_active })
      .eq("id", cat.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = categories[index + direction];
    const current = categories[index];
    if (!target || !current) return;
    await supabase
      .from("purchase_categories")
      .update({ sort_order: target.sort_order })
      .eq("id", current.id);
    await supabase
      .from("purchase_categories")
      .update({ sort_order: current.sort_order })
      .eq("id", target.id);
    refresh();
  };

  const remove = async (cat: PurchaseCategory) => {
    const { error } = await supabase.from("purchase_categories").delete().eq("id", cat.id);
    if (error) {
      toast.error(
        isInUseError(error)
          ? `Suppression refusée : la catégorie « ${cat.name} » est utilisée par au moins un bon de commande. Désactivez-la plutôt.`
          : `Suppression impossible : ${error.message}`,
      );
      return;
    }
    toast.success("Catégorie supprimée");
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newName}
          maxLength={100}
          placeholder="Nouvelle catégorie"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create} disabled={busy}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="w-64">Catégorie comptable</TableHead>
              <TableHead className="w-28">Ordre</TableHead>
              <TableHead className="w-28">Active</TableHead>
              <TableHead className="w-20 text-right">Suppr.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat, index) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <Input
                      defaultValue={cat.name}
                      maxLength={100}
                      onBlur={(e) => rename(cat, e.target.value)}
                      className="max-w-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={
                        cat.facturation_pro_category_id
                          ? String(cat.facturation_pro_category_id)
                          : "none"
                      }
                      onValueChange={(v) => setAccountingCategory(cat, v)}
                      disabled={loadingAccounting || !!accountingError}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            accountingError ? "Comptabilité indisponible" : "Non rattachée"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="none">Non rattachée</SelectItem>
                        {accountingCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === categories.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Switch checked={cat.is_active} onCheckedChange={() => toggle(cat)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(cat)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* -------------------------------- Taux de TVA ------------------------------- */

function VatRatesTab() {
  const { data: rates = [], isLoading } = useVatRates();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [rate, setRate] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["vat-rates"] });

  const create = async () => {
    const value = Number(rate.replace(",", "."));
    if (!label.trim()) return toast.error("Le libellé est obligatoire");
    if (!Number.isFinite(value) || value < 0 || value > 100)
      return toast.error("Taux invalide (0 à 100)");
    const { error } = await supabase
      .from("vat_rates")
      .insert({ label: label.trim(), rate: value, sort_order: rates.length + 1 });
    if (error) return toast.error(`Création impossible : ${error.message}`);
    setLabel("");
    setRate("");
    toast.success("Taux ajouté");
    refresh();
  };

  const update = async (r: VatRate, patch: Partial<VatRate>) => {
    const { error } = await supabase.from("vat_rates").update(patch).eq("id", r.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const setDefault = async (r: VatRate) => {
    await supabase.from("vat_rates").update({ is_default: false }).neq("id", r.id);
    const { error } = await supabase.from("vat_rates").update({ is_default: true }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(`« ${r.label} » est le taux par défaut`);
    refresh();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const current = rates[index];
    const target = rates[index + direction];
    if (!current || !target) return;
    await supabase.from("vat_rates").update({ sort_order: target.sort_order }).eq("id", current.id);
    await supabase.from("vat_rates").update({ sort_order: current.sort_order }).eq("id", target.id);
    refresh();
  };

  const remove = async (r: VatRate) => {
    // Le taux est historisé (snapshot) sur les PO : on refuse la suppression s'il est utilisé.
    const { count, error: countError } = await supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("vat_rate", r.rate);
    if (countError) return toast.error(countError.message);
    if ((count ?? 0) > 0) {
      toast.error(
        `Suppression refusée : le taux « ${r.label} » est utilisé par ${count} bon(s) de commande. Désactivez-le plutôt.`,
      );
      return;
    }
    const { error } = await supabase.from("vat_rates").delete().eq("id", r.id);
    if (error) return toast.error(`Suppression impossible : ${error.message}`);
    toast.success("Taux supprimé");
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={label}
          placeholder="Libellé (ex. TVA 22 % Italie)"
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          value={rate}
          placeholder="Taux (ex. 22)"
          inputMode="decimal"
          className="sm:w-40"
          onChange={(e) => setRate(e.target.value)}
        />
        <Button onClick={create}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead className="w-28">Taux</TableHead>
              <TableHead className="w-32">Par défaut</TableHead>
              <TableHead className="w-28">Ordre</TableHead>
              <TableHead className="w-28">Actif</TableHead>
              <TableHead className="w-20 text-right">Suppr.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : (
              rates.map((r, index) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Input
                      defaultValue={r.label}
                      maxLength={60}
                      className="max-w-xs"
                      onBlur={(e) =>
                        e.target.value.trim() && e.target.value !== r.label
                          ? update(r, { label: e.target.value.trim() })
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(r.rate))} %
                  </TableCell>
                  <TableCell>
                    {r.is_default ? (
                      <Badge>Par défaut</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setDefault(r)}>
                        Définir
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === rates.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={() => update(r, { is_active: !r.is_active })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------------------------- Coordonnées société --------------------------- */

const COMPANY_FIELDS: Array<{ key: string; label: string; colSpan?: boolean }> = [
  { key: "legal_name", label: "Raison sociale", colSpan: true },
  { key: "address_1", label: "Adresse 1", colSpan: true },
  { key: "address_2", label: "Adresse 2", colSpan: true },
  { key: "postal_code", label: "Code postal" },
  { key: "city", label: "Ville" },
  { key: "country", label: "Pays" },
  { key: "siret", label: "SIRET" },
  { key: "vat_number", label: "N° TVA" },
  { key: "phone", label: "Téléphone" },
  { key: "accounting_email", label: "Email comptabilité" },
  { key: "logo_url", label: "URL du logo", colSpan: true },
];

function CompanyTab() {
  const { data: settings, isLoading } = useCompanySettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const next: Record<string, string> = {};
    for (const f of COMPANY_FIELDS) {
      next[f.key] = (settings as unknown as Record<string, string | null>)[f.key] ?? "";
    }
    setForm(next);
  }, [settings]);

  const save = async () => {
    if (!settings) return;
    if (!form.legal_name?.trim()) return toast.error("La raison sociale est obligatoire");
    setSaving(true);
    const payload = Object.fromEntries(
      COMPANY_FIELDS.map((f) => [f.key, form[f.key]?.trim() || null]),
    );
    const { error } = await supabase.from("company_settings").update(payload).eq("id", settings.id);
    setSaving(false);
    if (error) return toast.error(`Enregistrement impossible : ${error.message}`);
    toast.success("Coordonnées enregistrées");
    queryClient.invalidateQueries({ queryKey: ["company-settings"] });
  };

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COMPANY_FIELDS.map((f) => (
          <div key={f.key} className={f.colSpan ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
            <Label htmlFor={`company-${f.key}`}>{f.label}</Label>
            <Input
              id={`company-${f.key}`}
              maxLength={255}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Enregistrer
      </Button>
    </div>
  );
}
