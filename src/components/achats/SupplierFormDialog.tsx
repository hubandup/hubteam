import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  supplierSchema,
  emptySupplierForm,
  type SupplierFormValues,
} from "@/lib/purchasing";
import { useSaveSupplier, type Supplier } from "@/hooks/usePurchasing";

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  /** Appelé après enregistrement — permet la sélection automatique dans le formulaire de PO. */
  onSaved?: (supplier: Supplier) => void;
}

type FieldErrors = Partial<Record<keyof SupplierFormValues, string>>;

const FIELDS: Array<{
  name: keyof SupplierFormValues;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  colSpan?: boolean;
}> = [
  { name: "company_name", label: "Entreprise", required: true, colSpan: true },
  { name: "civility", label: "Civilité", placeholder: "M. / Mme" },
  { name: "last_name", label: "Nom" },
  { name: "first_name", label: "Prénom" },
  { name: "email", label: "Email", type: "email", placeholder: "contact@fournisseur.fr" },
  { name: "phone", label: "Téléphone", placeholder: "01 23 45 67 89" },
  { name: "address_1", label: "Adresse 1", colSpan: true },
  { name: "address_2", label: "Adresse 2", colSpan: true },
  { name: "postal_code", label: "Code postal" },
  { name: "city", label: "Ville" },
  {
    name: "vat_number",
    label: "N° TVA intracommunautaire",
    placeholder: "FR12345678901",
    colSpan: true,
  },
  { name: "iban", label: "IBAN", placeholder: "FR7630006000011234567890189", colSpan: true },
  { name: "bic", label: "BIC", placeholder: "AGRIFRPP" },
  { name: "siret", label: "SIRET", placeholder: "12345678901234" },
];

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: SupplierFormDialogProps) {
  const [values, setValues] = useState<SupplierFormValues>(emptySupplierForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useSaveSupplier();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (supplier) {
      setValues({
        company_name: supplier.company_name ?? "",
        civility: supplier.civility ?? "",
        siret: supplier.siret ?? "",
        last_name: supplier.last_name ?? "",
        first_name: supplier.first_name ?? "",
        email: supplier.email ?? "",
        phone: supplier.phone ?? "",
        address_1: supplier.address_1 ?? "",
        address_2: supplier.address_2 ?? "",
        postal_code: supplier.postal_code ?? "",
        city: supplier.city ?? "",
        vat_number: supplier.vat_number ?? "",
        iban: supplier.iban ?? "",
        bic: supplier.bic ?? "",
        notes: supplier.notes ?? "",
      });
    } else {
      setValues(emptySupplierForm);
    }
  }, [open, supplier]);

  const setField = (name: keyof SupplierFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = supplierSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SupplierFormValues;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Merci de corriger les champs en rouge");
      return;
    }

    try {
      const saved = await save.mutateAsync({ id: supplier?.id, values: parsed.data });
      const syncError = (saved as { sync_error?: string | null }).sync_error;
      toast.success(supplier ? "Fournisseur mis à jour" : "Fournisseur créé");
      if (syncError) {
        toast.warning(
          "Fournisseur enregistré mais non synchronisé avec la comptabilité. Vous pouvez relancer la synchronisation depuis la liste.",
        );
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Enregistrement impossible : ${message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          <DialogDescription>
            Les coordonnées sont synchronisées avec la comptabilité. Un échec de
            synchronisation n'empêche jamais l'utilisation du fournisseur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map((field) => (
              <div key={field.name} className={field.colSpan ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label htmlFor={`supplier-${field.name}`}>
                  {field.label}
                  {field.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                <Input
                  id={`supplier-${field.name}`}
                  type={field.type ?? "text"}
                  value={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => setField(field.name, e.target.value)}
                  aria-invalid={!!errors[field.name]}
                  className={errors[field.name] ? "border-destructive" : undefined}
                />
                {errors[field.name] ? (
                  <p className="text-xs text-destructive">{errors[field.name]}</p>
                ) : null}
              </div>
            ))}

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="supplier-notes">Notes</Label>
              <Textarea
                id="supplier-notes"
                rows={3}
                value={values.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {supplier ? "Enregistrer" : "Créer le fournisseur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
