import { z } from "zod";

/** Formats FR — montants et dates */
export const formatEUR = (value: number | null | undefined, currency = "EUR") =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const formatDateFR = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

/** Contrôles syntaxiques (aucune vérification bancaire) */
export const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;
export const BIC_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
export const VAT_REGEX = /^[A-Za-z]{2}[A-Za-z0-9]{2,13}$/;

const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, { message: `Maximum ${max} caractères` })
    .optional()
    .or(z.literal(""));

export const supplierSchema = z.object({
  company_name: z
    .string()
    .trim()
    .nonempty({ message: "L'entreprise est obligatoire" })
    .max(150, { message: "Maximum 150 caractères" }),
  last_name: optionalText(100),
  first_name: optionalText(100),
  email: z
    .string()
    .trim()
    .max(255, { message: "Maximum 255 caractères" })
    .email({ message: "Adresse e-mail invalide" })
    .optional()
    .or(z.literal("")),
  phone: optionalText(30),
  address_1: optionalText(200),
  address_2: optionalText(200),
  postal_code: optionalText(20),
  city: optionalText(100),
  vat_number: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || VAT_REGEX.test(v), {
      message: "Format attendu : 2 lettres puis alphanumérique (ex. FR12345678901)",
    })
    .optional()
    .or(z.literal("")),
  iban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => v === "" || IBAN_REGEX.test(v), {
      message: "IBAN invalide (ex. FR7630006000011234567890189)",
    })
    .optional()
    .or(z.literal("")),
  bic: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => v === "" || BIC_REGEX.test(v), {
      message: "BIC invalide (8 ou 11 caractères, ex. AGRIFRPP)",
    })
    .optional()
    .or(z.literal("")),
  notes: optionalText(2000),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const emptySupplierForm: SupplierFormValues = {
  company_name: "",
  last_name: "",
  first_name: "",
  email: "",
  phone: "",
  address_1: "",
  address_2: "",
  postal_code: "",
  city: "",
  vat_number: "",
  iban: "",
  bic: "",
  notes: "",
};

export const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  invoiced: "Facturé",
  cancelled: "Annulé",
};
