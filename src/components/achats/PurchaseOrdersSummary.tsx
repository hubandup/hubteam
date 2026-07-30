import { Link } from "react-router-dom";
import { AlertTriangle, TrendingUp, Layers, Building2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEUR, formatDateFR, formatFrNumber } from "@/lib/purchasing";
import {
  usePurchaseOrdersSummary,
  type PurchaseOrderFilters,
} from "@/hooks/usePurchaseOrders";

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function PurchaseOrdersSummary({ filters }: { filters: PurchaseOrderFilters }) {
  const { data, isLoading } = usePurchaseOrdersSummary(filters);

  if (isLoading && !data) {
    return (
      <div className="rounded-3xl border bg-card p-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      {data.overdue.length > 0 && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-5">
          <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {data.overdue.length} bon{data.overdue.length > 1 ? "s" : ""} de commande envoyé
            {data.overdue.length > 1 ? "s" : ""} dont la date de règlement est dépassée sans passage
            au statut « Facturé » · {formatEUR(data.overdueHt)} HT
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.overdue.slice(0, 6).map((po) => (
              <li key={po.id} className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/achats/bons-de-commande/${po.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {po.po_number}
                </Link>
                <span className="text-muted-foreground">{po.supplier_name ?? "—"}</span>
                <span className="text-muted-foreground">
                  échéance {formatDateFR(po.payment_date)}
                </span>
                <Badge variant="secondary" className="bg-amber-200 text-amber-950">
                  +{po.days_late} j
                </Badge>
                <span className="ml-auto font-medium">{formatEUR(po.amount_ht)}</span>
              </li>
            ))}
          </ul>
          {data.overdue.length > 6 && (
            <p className="mt-2 text-xs text-muted-foreground">
              et {data.overdue.length - 6} autre{data.overdue.length - 6 > 1 ? "s" : ""}…
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Total engagé (période filtrée)" icon={<TrendingUp className="h-4 w-4" />}>
          <p className="text-3xl font-semibold tracking-tight">{formatEUR(data.totalHt)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            HT · {formatEUR(data.totalTtc)} TTC · {data.count} bon
            {data.count > 1 ? "s" : ""} (hors annulés)
          </p>
          <div className="mt-4 space-y-1 text-sm">
            {(["draft", "sent", "invoiced"] as const).map((s) => (
              <div key={s} className="flex justify-between">
                <span className="text-muted-foreground">
                  {s === "draft" ? "Brouillons" : s === "sent" ? "Envoyés" : "Facturés"} ·{" "}
                  {data.byStatus[s].count}
                </span>
                <span>{formatEUR(data.byStatus[s].ht)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Répartition par catégorie" icon={<Layers className="h-4 w-4" />}>
          {data.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée</p>
          ) : (
            <ul className="space-y-3">
              {data.byCategory.slice(0, 5).map((c) => (
                <li key={c.name} className="space-y-1">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="truncate">{c.name}</span>
                    <span className="whitespace-nowrap">
                      {formatEUR(c.ht)}{" "}
                      <span className="text-muted-foreground">
                        ({formatFrNumber(Math.round(c.share))} %)
                      </span>
                    </span>
                  </div>
                  <Bar value={c.share} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Top 5 fournisseurs" icon={<Building2 className="h-4 w-4" />}>
          {data.topSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée</p>
          ) : (
            <ol className="space-y-3">
              {data.topSuppliers.map((s, i) => (
                <li key={s.name} className="space-y-1">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="truncate">
                      <span className="text-muted-foreground mr-1">{i + 1}.</span>
                      {s.name}
                    </span>
                    <span className="whitespace-nowrap">
                      {formatEUR(s.ht)}{" "}
                      <span className="text-muted-foreground">
                        ({s.count} PO)
                      </span>
                    </span>
                  </div>
                  <Bar value={s.share} />
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
