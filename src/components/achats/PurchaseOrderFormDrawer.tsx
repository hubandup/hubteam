import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, Plus, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SupplierFormDialog } from "@/components/achats/SupplierFormDialog";
import {
  useSuppliers,
  usePurchaseCategories,
  useVatRates,
  useCompanySettings,
  type Supplier,
} from "@/hooks/usePurchasing";
import {
  useSavePurchaseOrder,
  useDuplicatePurchaseOrder,
  useDossierCommitment,
  useLogPurchaseOrderEvent,
  useUpdatePurchaseOrderStatus,
  type PurchaseOrder,
} from "@/hooks/usePurchaseOrders";
import {
  purchaseOrderSchema,
  parseFrNumber,
  formatFrNumber,
  formatEUR,
  formatDateFR,
  round2,
  type PurchaseOrderFormValues,
} from "@/lib/purchasing";
import { generateAndStorePurchaseOrderPdf } from "@/lib/po-pdf-service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder | null;
  onSaved?: (po: PurchaseOrder) => void;
}

interface QuoteInfo {
  id: string;
  ref: string;
  title: string;
  customer: string;
  total: number;
  date: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function PurchaseOrderFormDrawer({ open, onOpenChange, purchaseOrder, onSaved }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: categories = [] } = usePurchaseCategories();
  const { data: vatRates = [] } = useVatRates();
  const { data: company } = useCompanySettings();
  const savePo = useSavePurchaseOrder();
  const logEvent = useLogPurchaseOrderEvent();
  const updateStatus = useUpdatePurchaseOrderStatus();

  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [quoteInfo, setQuoteInfo] = useState<QuoteInfo | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "notfound">("idle");
  const [submitting, setSubmitting] = useState<null | "draft" | "pdf">(null);
  const lookupTimer = useRef<number | null>(null);

  const defaultVat = useMemo(
    () => vatRates.find((v) => v.is_default) ?? vatRates[0],
    [vatRates],
  );

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplier_id: "",
      hubup_dossier_ref: "",
      facturation_pro_quote_id: "",
      supplier_quote_ref: "",
      description: "",
      category_id: "",
      validation_date: today(),
      amount_ht_input: "",
      vat_rate: "",
      payment_date: "",
      internal_notes: "",
    },
  });

  const values = form.watch();
  const selectedSupplier = suppliers.find((s) => s.id === values.supplier_id) ?? null;
  const amountHt = parseFrNumber(values.amount_ht_input || "0");
  const vatRateNumber = Number(values.vat_rate || 0);
  const amountVat = Number.isNaN(amountHt) ? 0 : round2((amountHt * vatRateNumber) / 100);
  const amountTtc = Number.isNaN(amountHt) ? 0 : round2(amountHt + amountVat);

  const { data: duplicate } = useDuplicatePurchaseOrder(
    values.supplier_id || undefined,
    values.supplier_quote_ref || undefined,
    purchaseOrder?.id,
  );

  const { data: otherEngaged = 0 } = useDossierCommitment(
    values.hubup_dossier_ref,
    purchaseOrder?.id,
  );

  const budgetWarning = useMemo(() => {
    if (!quoteInfo || !quoteInfo.total) return null;
    const engaged = round2(otherEngaged + (Number.isNaN(amountHt) ? 0 : amountHt));
    if (engaged <= Number(quoteInfo.total)) return null;
    return { engaged, quoteTotal: Number(quoteInfo.total) };
  }, [quoteInfo, otherEngaged, amountHt]);

  /* Initialisation à l'ouverture */
  useEffect(() => {
    if (!open) return;
    setQuoteInfo(null);
    setQuoteState("idle");
    if (purchaseOrder) {
      form.reset({
        supplier_id: purchaseOrder.supplier_id,
        hubup_dossier_ref: purchaseOrder.hubup_dossier_ref,
        facturation_pro_quote_id: purchaseOrder.facturation_pro_quote_id ?? "",
        supplier_quote_ref: purchaseOrder.supplier_quote_ref ?? "",
        description: purchaseOrder.description ?? "",
        category_id: purchaseOrder.category_id,
        validation_date: purchaseOrder.validation_date,
        amount_ht_input: formatFrNumber(Number(purchaseOrder.amount_ht)),
        vat_rate: String(Number(purchaseOrder.vat_rate)),
        payment_date: purchaseOrder.payment_date ?? "",
        internal_notes: purchaseOrder.internal_notes ?? "",
      });
    } else {
      form.reset({
        supplier_id: "",
        hubup_dossier_ref: "",
        facturation_pro_quote_id: "",
        supplier_quote_ref: "",
        description: "",
        category_id: "",
        validation_date: today(),
        amount_ht_input: "",
        vat_rate: defaultVat ? String(Number(defaultVat.rate)) : "",
        payment_date: "",
        internal_notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, purchaseOrder?.id, defaultVat?.id]);

  /* Recherche du devis facturation.pro (debounce 600 ms) */
  const dossierRef = values.hubup_dossier_ref;
  useEffect(() => {
    if (!open) return;
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    const ref = dossierRef?.trim();
    if (!ref || ref.length < 3) {
      setQuoteInfo(null);
      setQuoteState("idle");
      return;
    }
    lookupTimer.current = window.setTimeout(async () => {
      setQuoteState("loading");
      try {
        const { data, error } = await supabase.functions.invoke("facturation-pro-quote-lookup", {
          body: { dossierRef: ref },
        });
        if (error || !data?.found) {
          setQuoteInfo(null);
          setQuoteState("notfound");
          return;
        }
        const quote = data.quote as QuoteInfo;
        setQuoteInfo(quote);
        setQuoteState("idle");
        form.setValue("facturation_pro_quote_id", quote.id);
        if (!form.getValues("description")?.trim() && quote.title) {
          form.setValue("description", quote.title, { shouldValidate: true });
        }
      } catch {
        setQuoteInfo(null);
        setQuoteState("notfound");
      }
    }, 600);
    return () => {
      if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierRef, open]);

  const submit = async (mode: "draft" | "pdf") => {
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Certains champs sont invalides");
      return;
    }
    const v = form.getValues();
    setSubmitting(mode);
    try {
      const saved = await savePo.mutateAsync({
        id: purchaseOrder?.id,
        values: {
          supplier_id: v.supplier_id,
          hubup_dossier_ref: v.hubup_dossier_ref.trim(),
          facturation_pro_quote_id: v.facturation_pro_quote_id || null,
          supplier_quote_ref: v.supplier_quote_ref?.trim() || null,
          validation_date: v.validation_date,
          description: v.description.trim(),
          category_id: v.category_id,
          amount_ht: round2(parseFrNumber(v.amount_ht_input)),
          vat_rate: Number(v.vat_rate),
          payment_date: v.payment_date || null,
          internal_notes: v.internal_notes?.trim() || null,
          quote_total_ht: quoteInfo?.total ?? purchaseOrder?.quote_total_ht ?? null,
        },
      });

      const wasSent = purchaseOrder && purchaseOrder.status !== "draft";
      if (mode === "pdf" || wasSent) {
        const path = await generateAndStorePurchaseOrderPdf({ id: saved.id });
        await updateStatus.mutateAsync({ id: saved.id, pdfPath: path });
        toast.success(
          wasSent
            ? "PDF régénéré — pensez à renvoyer le document au fournisseur"
            : "Bon de commande enregistré et PDF généré",
        );
      } else {
        toast.success("Brouillon enregistré");
      }

      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSubmitting(null);
    }
  };

  const errors = form.formState.errors;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto p-0"
        >
          <div className="p-6 pb-32 space-y-6">
            <SheetHeader className="text-left">
              <SheetTitle>
                {purchaseOrder ? `Modifier ${purchaseOrder.po_number}` : "Nouveau bon de commande"}
              </SheetTitle>
              <SheetDescription>
                {purchaseOrder && purchaseOrder.status !== "draft"
                  ? "Ce bon de commande a déjà été envoyé : toute modification régénère le PDF."
                  : "Renseignez les informations du bon de commande."}
              </SheetDescription>
            </SheetHeader>

            {/* Fournisseur */}
            <div className="space-y-2">
              <Label>Fournisseur *</Label>
              <div className="flex gap-2">
                <Popover open={supplierPickerOpen} onOpenChange={setSupplierPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="flex-1 justify-between rounded-[var(--radius-input,0.75rem)]"
                    >
                      {selectedSupplier?.company_name ?? "Rechercher un fournisseur…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher…" />
                      <CommandList>
                        <CommandEmpty>Aucun fournisseur</CommandEmpty>
                        <CommandGroup>
                          {suppliers
                            .filter((s) => s.is_active || s.id === values.supplier_id)
                            .map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.company_name}
                                onSelect={() => {
                                  form.setValue("supplier_id", s.id, { shouldValidate: true });
                                  setSupplierPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    s.id === values.supplier_id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {s.company_name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupplierDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Nouveau fournisseur
                </Button>
              </div>
              {errors.supplier_id && (
                <p className="text-xs text-destructive">{errors.supplier_id.message}</p>
              )}

              {selectedSupplier && (
                <div className="rounded-2xl border bg-muted/40 p-4 text-sm space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{selectedSupplier.company_name}</p>
                    <button
                      type="button"
                      className="text-xs underline text-muted-foreground"
                      onClick={() => {
                        setEditingSupplier(selectedSupplier);
                        setSupplierDialogOpen(true);
                      }}
                    >
                      Modifier la fiche
                    </button>
                  </div>
                  {(selectedSupplier.first_name || selectedSupplier.last_name) && (
                    <p className="text-muted-foreground">
                      {[selectedSupplier.first_name, selectedSupplier.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  )}
                  {selectedSupplier.address_1 && (
                    <p className="text-muted-foreground">{selectedSupplier.address_1}</p>
                  )}
                  {selectedSupplier.address_2 && (
                    <p className="text-muted-foreground">{selectedSupplier.address_2}</p>
                  )}
                  <p className="text-muted-foreground">
                    {[selectedSupplier.postal_code, selectedSupplier.city, selectedSupplier.country]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  {selectedSupplier.email && (
                    <p className="text-muted-foreground">{selectedSupplier.email}</p>
                  )}
                  {selectedSupplier.phone && (
                    <p className="text-muted-foreground">{selectedSupplier.phone}</p>
                  )}
                  {selectedSupplier.vat_number && (
                    <p className="text-muted-foreground">TVA : {selectedSupplier.vat_number}</p>
                  )}
                  {selectedSupplier.iban && (
                    <p className="text-muted-foreground">
                      IBAN : {selectedSupplier.iban}
                      {selectedSupplier.bic ? ` — BIC : ${selectedSupplier.bic}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* N° de dossier */}
            <div className="space-y-2">
              <Label htmlFor="hubup_dossier_ref">N° de dossier Hub & Up *</Label>
              <div className="relative">
                <Input id="hubup_dossier_ref" {...form.register("hubup_dossier_ref")} />
                {quoteState === "loading" && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {errors.hubup_dossier_ref && (
                <p className="text-xs text-destructive">{errors.hubup_dossier_ref.message}</p>
              )}
              {quoteInfo && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
                  <p className="font-medium">Devis trouvé : {quoteInfo.ref}</p>
                  <p className="text-muted-foreground">
                    {quoteInfo.customer} · {formatEUR(quoteInfo.total)} ·{" "}
                    {formatDateFR(quoteInfo.date)}
                  </p>
                </div>
              )}
              {budgetWarning && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <p>
                    Ce dossier est engagé à {formatEUR(budgetWarning.engaged)} HT pour un devis
                    client de {formatEUR(budgetWarning.quoteTotal)} HT.
                  </p>
                </div>
              )}
              {quoteState === "notfound" && (
                <p className="text-xs text-muted-foreground">
                  Devis introuvable dans facturation.pro
                </p>
              )}
            </div>

            {/* N° devis fournisseur */}
            <div className="space-y-2">
              <Label htmlFor="supplier_quote_ref">N° de devis du fournisseur</Label>
              <Input id="supplier_quote_ref" {...form.register("supplier_quote_ref")} />
              {duplicate && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                  <p>
                    Un bon de commande existe déjà pour ce fournisseur et ce devis :{" "}
                    <Link
                      to={`/achats/bons-de-commande/${duplicate.id}`}
                      className="underline font-medium"
                      onClick={() => onOpenChange(false)}
                    >
                      {duplicate.po_number}
                    </Link>
                    . Vous pouvez tout de même poursuivre.
                  </p>
                </div>
              )}
            </div>

            {/* Descriptif */}
            <div className="space-y-2">
              <Label htmlFor="description">Descriptif *</Label>
              <Textarea id="description" rows={4} {...form.register("description")} />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Catégorie */}
            <div className="space-y-2">
              <Label>Catégorie d'achat *</Label>
              <Select
                value={values.category_id}
                onValueChange={(v) => form.setValue("category_id", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.is_active || c.id === values.category_id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.category_id && (
                <p className="text-xs text-destructive">{errors.category_id.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="validation_date">Date de validation *</Label>
                <Input id="validation_date" type="date" {...form.register("validation_date")} />
                {errors.validation_date && (
                  <p className="text-xs text-destructive">{errors.validation_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_date">Date de règlement</Label>
                <Input id="payment_date" type="date" {...form.register("payment_date")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount_ht_input">Montant HT *</Label>
                <Input
                  id="amount_ht_input"
                  inputMode="decimal"
                  placeholder="1 250,00"
                  {...form.register("amount_ht_input")}
                />
                {errors.amount_ht_input && (
                  <p className="text-xs text-destructive">{errors.amount_ht_input.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Taux de TVA *</Label>
                <Select
                  value={values.vat_rate}
                  onValueChange={(v) => form.setValue("vat_rate", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Taux" />
                  </SelectTrigger>
                  <SelectContent>
                    {vatRates
                      .filter((r) => r.is_active || String(Number(r.rate)) === values.vat_rate)
                      .map((r) => (
                        <SelectItem key={r.id} value={String(Number(r.rate))}>
                          {r.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.vat_rate && (
                  <p className="text-xs text-destructive">{errors.vat_rate.message}</p>
                )}
              </div>
            </div>

            {/* Récapitulatif temps réel */}
            <div className="rounded-2xl border bg-muted/40 p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT</span>
                <span>{formatEUR(Number.isNaN(amountHt) ? 0 : amountHt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  TVA ({formatFrNumber(vatRateNumber)} %)
                </span>
                <span>{formatEUR(amountVat)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t">
                <span>Total TTC</span>
                <span>{formatEUR(amountTtc)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_notes">Notes internes</Label>
              <Textarea id="internal_notes" rows={3} {...form.register("internal_notes")} />
              <p className="text-xs text-muted-foreground">
                Ces notes n'apparaissent pas sur le PDF.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse sm:flex-row gap-2 justify-end border-t bg-background p-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!submitting}>
              Annuler
            </Button>
            <Button variant="outline" onClick={() => submit("draft")} disabled={!!submitting}>
              {submitting === "draft" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer le brouillon
            </Button>
            <Button onClick={() => submit("pdf")} disabled={!!submitting}>
              {submitting === "pdf" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Enregistrer et générer le PDF
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <SupplierFormDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        supplier={editingSupplier}
        onSaved={(supplier) => {
          form.setValue("supplier_id", supplier.id, { shouldValidate: true });
        }}
      />
    </>
  );
}
