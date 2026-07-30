import { supabase } from "@/integrations/supabase/client";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";

/**
 * Génère le PDF côté serveur (edge function), le stocke dans le bucket privé
 * `purchase-orders/{année}/{po_number}.pdf` et renvoie son chemin.
 */
export async function generateAndStorePurchaseOrderPdf(
  po: Pick<PurchaseOrder, "id">,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-purchase-order-pdf", {
    body: { poId: po.id },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.path) throw new Error("Génération du PDF impossible");
  return data.path as string;
}

/** URL signée à durée limitée (30 min) pour consulter ou télécharger un PDF. */
export async function getPurchaseOrderPdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("purchase-orders")
    .createSignedUrl(path, 60 * 30);
  if (error) return null;
  return data?.signedUrl ?? null;
}
