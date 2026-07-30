import { supabase } from "@/integrations/supabase/client";
import { buildPurchaseOrderPdf, purchaseOrderPdfPath } from "@/lib/po-pdf";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";
import type { CompanySettings, Supplier } from "@/hooks/usePurchasing";

interface GenerateArgs {
  po: PurchaseOrder;
  supplier?: Supplier | null;
  company?: CompanySettings | null;
  categoryName?: string | null;
}

/** Génère le PDF puis le dépose dans le stockage, et renvoie son chemin. */
export async function generateAndStorePurchaseOrderPdf({
  po,
  supplier,
  company,
  categoryName,
}: GenerateArgs): Promise<string> {
  const doc = buildPurchaseOrderPdf({ po, supplier, company, categoryName });
  const blob = doc.output("blob");
  const path = purchaseOrderPdfPath(po);

  const { error } = await supabase.storage
    .from("purchase-orders")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;

  return path;
}

export async function getPurchaseOrderPdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("purchase-orders")
    .createSignedUrl(path, 60 * 30);
  if (error) return null;
  return data?.signedUrl ?? null;
}
