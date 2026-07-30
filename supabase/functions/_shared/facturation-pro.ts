/**
 * Client typé pour l'API facturation.pro (https://facturation.dev)
 *
 * - Base : https://www.facturation.pro/firms/{FIRM_ID}/....json
 * - Auth : HTTP Basic (identifiant API / clé API)
 * - User-Agent obligatoire, sans caracteres accentues
 * - Ecriture : Content-Type: application/json; charset=utf-8, POST (201) / PATCH (200)
 * - Quotas : 600 req / 5 min, 10 000 / jour -> gestion du 429 (Retry-After + backoff exponentiel)
 * - Pagination : en-tete X-Pagination + parametre page=N
 */

export const FP_BASE_URL = "https://www.facturation.pro";
// Sans accents : impose par la documentation, sous peine de suspension d'acces.
export const FP_USER_AGENT = "HubTeam (contact@hubandup.com)";

export interface FpCredentials {
  apiId: string;
  apiKey: string;
  firmId: string;
}

export interface FpQuote {
  id: number;
  quote_ref?: string | null;
  full_quote_ref?: string | null;
  title?: string | null;
  total?: string | number | null;
  quote_date?: string | null;
  accepted_date?: string | null;
  customer_identity?: string | null;
  customer_short_name?: string | null;
  /** Note interne, jamais imprimee sur le document commercial. */
  internal_note?: string | null;
  /** Champ libre API, 255 caracteres maximum. */
  api_custom?: string | null;
}

/**
 * Champs STRICTEMENT interdits en ecriture sur un devis :
 * - purchase_number : « Bon de commande » DU CLIENT, imprime sur le devis client.
 * - items / total / total_with_vat / customer_id : contenu commercial du devis.
 * Seuls internal_note et api_custom sont autorises (voir FpQuoteWritableFields).
 */
export type FpQuoteWritableFields = Pick<FpQuote, "internal_note" | "api_custom">;

export const FP_QUOTE_API_CUSTOM_MAX = 255;


export interface FpSupplier {
  id: number;
  company_name?: string | null;
  civility?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /** Adresse sur un seul champ (retours a la ligne autorises). */
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
  /** Code ISO 2 lettres en majuscules. */
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  vat_number?: string | null;
  siret?: string | null;
  /** Lisibles uniquement avec la cle API de l'administrateur de l'entreprise. */
  sepa_iban?: string | null;
  sepa_bic?: string | null;
  notes?: string | null;
  /** Champ libre utilise comme cle de rapprochement (uuid HubTeam). */
  api_custom?: string | null;
}

export interface FpCategory {
  id: number;
  title?: string | null;
  name?: string | null;
  label?: string | null;
}


export interface FpPurchase {
  id: number;
  title?: string | null;
  /** Montant HT — LECTURE SEULE côté facturation.pro (recalculé). */
  total?: string | number | null;
  total_with_vat?: string | number | null;
  vat_amount?: string | number | null;
  supplier_id?: number | null;
  invoice_ref?: string | null;
  ref?: string | null;
  api_custom?: string | null;
  category_id?: number | null;
  invoiced_on?: string | null;
  term_on?: string | null;
  notes?: string | null;
  /** Champs de règlement / annulation renvoyés par facturation.pro. */
  paid_on?: string | null;
  balance?: string | number | null;
  total_paid?: string | number | null;
  cancelled?: boolean | null;
  cancelled_on?: string | null;
  status?: string | null;
}


export interface FpPagination {
  page: number;
  perPage: number | null;
  totalPages: number | null;
  totalEntries: number | null;
}

export interface FpResponse<T> {
  status: number;
  data: T;
  pagination: FpPagination | null;
}

export class FpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(message: string, status: number, body = "") {
    super(message);
    this.name = "FpError";
    this.status = status;
    this.body = body;
  }
}

export function readCredentials(): FpCredentials {
  const apiId = Deno.env.get("FACTURATION_PRO_API_ID");
  const apiKey = Deno.env.get("FACTURATION_PRO_API_KEY");
  const firmId = Deno.env.get("FACTURATION_PRO_FIRM_ID");
  if (!apiId || !apiKey || !firmId) {
    throw new FpError("Identifiants facturation.pro manquants", 500);
  }
  return { apiId, apiKey, firmId };
}

function authHeader({ apiId, apiKey }: FpCredentials): string {
  return `Basic ${btoa(`${apiId}:${apiKey}`)}`;
}

function parsePagination(header: string | null, page: number): FpPagination | null {
  if (!header) return null;
  // Format documente : {"page":1,"per_page":25,"total_pages":4,"total_entries":92}
  try {
    const raw = JSON.parse(header) as Record<string, unknown>;
    const num = (v: unknown): number | null =>
      typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : null;
    return {
      page: num(raw.page) ?? page,
      perPage: num(raw.per_page),
      totalPages: num(raw.total_pages),
      totalEntries: num(raw.total_entries),
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FpRequestOptions {
  method?: "GET" | "POST" | "PATCH";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
  /** Nombre de tentatives supplementaires en cas de 429 / 5xx. */
  maxRetries?: number;
}

/** Appel typé de l'API, avec gestion du 429 (Retry-After + backoff exponentiel). */
export async function fpRequest<T>(
  creds: FpCredentials,
  path: string,
  options: FpRequestOptions = {},
): Promise<FpResponse<T>> {
  const { method = "GET", query, body, timeoutMs = 12000, maxRetries = 3 } = options;

  const url = new URL(`${FP_BASE_URL}/firms/${creds.firmId}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Authorization: authHeader(creds),
    Accept: "application/json",
    "User-Agent": FP_USER_AGENT,
  };
  if (method !== "GET") headers["Content-Type"] = "application/json; charset=utf-8";

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 429 || res.status >= 500) {
      const text = await res.text().catch(() => "");
      if (attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "");
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2 ** attempt * 1000, 8000);
        attempt++;
        await sleep(backoff);
        continue;
      }
      throw new FpError(
        res.status === 429
          ? "Quota facturation.pro atteint, reessayez plus tard"
          : `facturation.pro indisponible (${res.status})`,
        res.status,
        text.slice(0, 300),
      );
    }

    const rawText = await res.text();
    if (!res.ok) {
      throw new FpError(`facturation.pro a refuse la requete (${res.status})`, res.status, rawText.slice(0, 300));
    }

    const pageParam = Number(url.searchParams.get("page") ?? "1");
    let data: T;
    try {
      data = (rawText ? JSON.parse(rawText) : null) as T;
    } catch {
      data = null as unknown as T;
    }
    return {
      status: res.status,
      data,
      pagination: parsePagination(res.headers.get("X-Pagination"), pageParam),
    };
  }
}

function asList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

/**
 * Recherche EXACTE d'un devis par son numéro complet.
 * GET /quotes.json?full_quote_ref={numero}&with_details=1
 * Remplace l'ancien parcours page par page (jusqu'a 10 appels par recherche).
 */
export async function findQuoteByRef(
  creds: FpCredentials,
  ref: string,
  timeoutMs = 12000,
): Promise<FpQuote | null> {
  const trimmed = ref.trim();
  // Certaines refs renvoient 404 sur le filtre exact : on retombe alors sur quote_ref.
  const attempts: Record<string, string | number>[] = [
    { full_quote_ref: trimmed, with_details: 1 },
    { quote_ref: trimmed, with_details: 1 },
  ];
  for (const query of attempts) {
    try {
      const { data } = await fpRequest<unknown>(creds, "/quotes.json", { query, timeoutMs });
      const quotes = asList<FpQuote>(data, "quotes");
      if (quotes[0]) return quotes[0];
    } catch (error) {
      // 404 = aucun devis correspondant, ce n'est pas une erreur serveur.
      if (error instanceof FpError && error.status === 404) continue;
      throw error;
    }
  }
  return null;
}

export async function getQuote(creds: FpCredentials, quoteId: string | number): Promise<FpQuote> {
  const { data } = await fpRequest<FpQuote>(creds, `/quotes/${quoteId}.json`);
  return data;
}

/**
 * PATCH /quotes/{id}.json — seuls les champs transmis sont modifies (retour 200).
 * Volontairement limite a internal_note / api_custom : ne JAMAIS ecrire
 * purchase_number, items, total, total_with_vat ni customer_id.
 */
export async function patchQuote(
  creds: FpCredentials,
  quoteId: string | number,
  payload: Partial<FpQuoteWritableFields>,
): Promise<FpQuote> {
  const forbidden = ["purchase_number", "items", "total", "total_with_vat", "customer_id"];
  for (const key of Object.keys(payload)) {
    if (forbidden.includes(key)) throw new FpError(`Champ interdit en ecriture : ${key}`, 400);
  }
  const { data } = await fpRequest<FpQuote>(creds, `/quotes/${quoteId}.json`, {
    method: "PATCH",
    body: payload,
  });
  return data;
}

/**
 * POST /quotes/{id}/upload.json — piece jointe multipart (variable `upload_file`).
 * `visible` est volontairement omis : la piece jointe reste interne.
 */
export async function uploadQuoteAttachment(
  creds: FpCredentials,
  quoteId: string | number,
  file: Uint8Array,
  filename: string,
  timeoutMs = 20000,
): Promise<{ id?: number; document_name?: string }> {
  const url = new URL(
    `${FP_BASE_URL}/firms/${creds.firmId}/quotes/${quoteId}/upload.json`,
  );
  url.searchParams.set("filename", filename);

  const form = new FormData();
  form.append("upload_file", new Blob([file], { type: "application/pdf" }), filename);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      Accept: "application/json",
      "User-Agent": FP_USER_AGENT,
    },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new FpError(`Envoi de la piece jointe refuse (${res.status})`, res.status, text.slice(0, 300));
  }
  try {
    return JSON.parse(text) as { id?: number; document_name?: string };
  } catch {
    return {};
  }
}


/** GET /suppliers.json (pagine). */
export async function listSuppliers(creds: FpCredentials, page = 1): Promise<FpResponse<FpSupplier[]>> {
  const res = await fpRequest<unknown>(creds, "/suppliers.json", { query: { page } });
  return { ...res, data: asList<FpSupplier>(res.data, "suppliers") };
}

/** POST /suppliers.json (retour 201). */
export async function createSupplier(
  creds: FpCredentials,
  payload: Partial<FpSupplier>,
): Promise<FpSupplier> {
  const { data } = await fpRequest<FpSupplier>(creds, "/suppliers.json", { method: "POST", body: payload });
  return data;
}

/** PATCH /suppliers/{id}.json (retour 200). */
export async function patchSupplier(
  creds: FpCredentials,
  supplierId: string | number,
  payload: Partial<FpSupplier>,
): Promise<FpSupplier> {
  const { data } = await fpRequest<FpSupplier>(creds, `/suppliers/${supplierId}.json`, {
    method: "PATCH",
    body: payload,
  });
  return data;
}

/** GET /purchases.json (pagine). */
export async function listPurchases(creds: FpCredentials, page = 1): Promise<FpResponse<FpPurchase[]>> {
  const res = await fpRequest<unknown>(creds, "/purchases.json", { query: { page } });
  return { ...res, data: asList<FpPurchase>(res.data, "purchases") };
}

/** POST /purchases.json (retour 201). */
export async function createPurchase(
  creds: FpCredentials,
  payload: Record<string, unknown>,
): Promise<FpPurchase> {
  const { data } = await fpRequest<FpPurchase>(creds, "/purchases.json", { method: "POST", body: payload });
  return data;
}

/** GET /purchases/{id}.json */
export async function getPurchase(
  creds: FpCredentials,
  id: string | number,
): Promise<FpPurchase> {
  const { data } = await fpRequest<FpPurchase>(creds, `/purchases/${id}.json`);
  return data;
}

/**
 * Traduit l'état d'un achat facturation.pro vers le statut d'un bon de commande HubTeam.
 * L'énumération HubTeam ne contient que draft / sent / invoiced / cancelled.
 */
export function mapPurchaseStatusToPoStatus(
  purchase: FpPurchase | null | undefined,
): "invoiced" | "cancelled" {
  if (!purchase) return "invoiced";
  const raw = String(purchase.status ?? "").toLowerCase();
  if (purchase.cancelled === true || purchase.cancelled_on || raw.includes("cancel") || raw.includes("annul")) {
    return "cancelled";
  }
  return "invoiced";
}

/** GET /suppliers/{id}.json */
export async function getSupplier(creds: FpCredentials, id: string | number): Promise<FpSupplier> {
  const { data } = await fpRequest<FpSupplier>(creds, `/suppliers/${id}.json`);
  return data;
}

/** GET /categories.json (categories comptables d'achat). */
export async function listCategories(creds: FpCredentials, page = 1): Promise<FpResponse<FpCategory[]>> {
  const res = await fpRequest<unknown>(creds, "/categories.json", { query: { page } });
  return { ...res, data: asList<FpCategory>(res.data, "categories") };
}

/* ------------------------- Correspondance fournisseurs ------------------------ */

export interface HubSupplier {
  id: string;
  company_name: string;
  civility?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  vat_number?: string | null;
  siret?: string | null;
  iban?: string | null;
  bic?: string | null;
  notes?: string | null;
  facturation_pro_id?: number | null;
}

const ISO_BY_COUNTRY: Record<string, string> = {
  france: "FR",
  belgique: "BE",
  suisse: "CH",
  luxembourg: "LU",
  italie: "IT",
  espagne: "ES",
  allemagne: "DE",
  "pays-bas": "NL",
  portugal: "PT",
  "royaume-uni": "GB",
  irlande: "IE",
  "etats-unis": "US",
};

const stripAccents = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Nom normalise (casse et accents ignores) pour le rapprochement des doublons. */
export function normalizeCompanyName(value: string | null | undefined): string {
  return stripAccents(String(value ?? "").trim().toLowerCase()).replace(/\s+/g, " ");
}

/** Pays HubTeam -> code ISO 2 lettres majuscules. */
export function toIsoCountry(value: string | null | undefined): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return ISO_BY_COUNTRY[stripAccents(raw.toLowerCase())] ?? undefined;
}

const ISO_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_BY_COUNTRY).map(([label, iso]) => [
    iso,
    label.charAt(0).toUpperCase() + label.slice(1),
  ]),
);

export function fromIsoCountry(value: string | null | undefined): string | undefined {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return undefined;
  return ISO_TO_LABEL[raw] ?? raw;
}

/** address_1 + address_2 -> street (un seul champ, separe par un retour a la ligne). */
export function joinStreet(a1?: string | null, a2?: string | null): string | undefined {
  const lines = [a1, a2].map((v) => String(v ?? "").trim()).filter(Boolean);
  return lines.length ? lines.join("\n") : undefined;
}

/** street -> address_1 / address_2 (scission inverse). */
export function splitStreet(street?: string | null): { address_1: string | null; address_2: string | null } {
  const lines = String(street ?? "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  return {
    address_1: lines[0] ?? null,
    address_2: lines.slice(1).join(" ") || null,
  };
}

/** Fournisseur HubTeam -> charge utile facturation.pro. */
export function toFpSupplierPayload(s: HubSupplier): Partial<FpSupplier> {
  const payload: Partial<FpSupplier> = {
    company_name: s.company_name,
    civility: s.civility || undefined,
    first_name: s.first_name || undefined,
    last_name: s.last_name || undefined,
    street: joinStreet(s.address_1, s.address_2),
    zip_code: s.postal_code || undefined,
    city: s.city || undefined,
    country: toIsoCountry(s.country),
    phone: s.phone || undefined,
    email: s.email || undefined,
    vat_number: s.vat_number || undefined,
    siret: s.siret || undefined,
    notes: s.notes || undefined,
    api_custom: s.id,
  };
  // Coordonnees bancaires : envoyees uniquement si renseignees cote HubTeam.
  if (s.iban) payload.sepa_iban = s.iban;
  if (s.bic) payload.sepa_bic = s.bic;
  return payload;
}

/**
 * Fournisseur facturation.pro -> champs HubTeam.
 * `existing` sert a ne JAMAIS ecraser un IBAN/BIC deja stocke lorsque l'API
 * renvoie des valeurs vides (lecture reservee a l'administrateur de l'entreprise).
 */
export function fromFpSupplier(
  fp: FpSupplier,
  existing?: { iban?: string | null; bic?: string | null } | null,
): Record<string, unknown> {
  const { address_1, address_2 } = splitStreet(fp.street);
  const out: Record<string, unknown> = {
    company_name: (fp.company_name || [fp.first_name, fp.last_name].filter(Boolean).join(" ") || "Sans nom").trim(),
    civility: fp.civility || null,
    first_name: fp.first_name || null,
    last_name: fp.last_name || null,
    address_1,
    address_2,
    postal_code: fp.zip_code || null,
    city: fp.city || null,
    country: fromIsoCountry(fp.country) ?? "France",
    phone: fp.phone || null,
    email: fp.email || null,
    vat_number: fp.vat_number || null,
    siret: fp.siret || null,
    notes: fp.notes || null,
    facturation_pro_id: fp.id,
  };
  if (fp.sepa_iban) out.iban = fp.sepa_iban;
  else if (existing?.iban) out.iban = existing.iban;
  if (fp.sepa_bic) out.bic = fp.sepa_bic;
  else if (existing?.bic) out.bic = existing.bic;
  return out;
}
