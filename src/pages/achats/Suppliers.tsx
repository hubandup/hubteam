import { useMemo, useState } from "react";
import { PageHeader, Toolbar } from "@/components/layout";
import { PillButton } from "@/components/ui/pill-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, ArrowUpDown, Pencil, Power, Settings2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SupplierFormDialog } from "@/components/achats/SupplierFormDialog";
import {
  useSuppliers,
  useToggleSupplierActive,
  useSupplierPurchaseOrders,
  type Supplier,
} from "@/hooks/usePurchasing";
import { formatEUR, formatDateFR, PO_STATUS_LABELS } from "@/lib/purchasing";

type SortKey = "company_name" | "city" | "created_at";

export default function Suppliers() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const toggleActive = useToggleSupplierActive();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sortKey, setSortKey] = useState<SortKey>("company_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [detail, setDetail] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = suppliers.filter((s) => {
      if (statusFilter === "active" && !s.is_active) return false;
      if (statusFilter === "inactive" && s.is_active) return false;
      if (!q) return true;
      return [s.company_name, s.email, s.city, s.last_name, s.first_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

    return [...list].sort((a, b) => {
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      return sortAsc ? av.localeCompare(bv, "fr") : bv.localeCompare(av, "fr");
    });
  }, [suppliers, search, statusFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      await toggleActive.mutateAsync({ id: supplier.id, is_active: !supplier.is_active });
      toast.success(supplier.is_active ? "Fournisseur désactivé" : "Fournisseur réactivé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fournisseurs"
        subtitle="Annuaire des fournisseurs et historique des bons de commande"
        actions={
          <Toolbar>
            <PillButton variant="outline" asChild>
              <Link to="/achats/parametres">
                <Settings2 className="h-4 w-4" />
                Paramètres
              </Link>
            </PillButton>
            <PillButton
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouveau fournisseur
            </PillButton>
          </Toolbar>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une entreprise, un email, une ville…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="inline-flex items-center gap-1" onClick={() => toggleSort("company_name")}>
                  Entreprise <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">
                <button className="inline-flex items-center gap-1" onClick={() => toggleSort("city")}>
                  Ville <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Aucun fournisseur
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="cursor-pointer"
                  onClick={() => setDetail(supplier)}
                >
                  <TableCell className="font-medium">{supplier.company_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {[supplier.first_name, supplier.last_name].filter(Boolean).join(" ") || "—"}
                    {supplier.email ? (
                      <span className="block text-xs">{supplier.email}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {supplier.city || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.is_active ? "default" : "secondary"}>
                      {supplier.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(supplier);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(supplier)}>
                      <Power className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={editing} />

      <SupplierDetailSheet
        supplier={detail}
        onClose={() => setDetail(null)}
        onEdit={(s) => {
          setDetail(null);
          setEditing(s);
          setFormOpen(true);
        }}
      />
    </div>
  );
}

function SupplierDetailSheet({
  supplier,
  onClose,
  onEdit,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onEdit: (s: Supplier) => void;
}) {
  const { data: orders = [], isLoading } = useSupplierPurchaseOrders(supplier?.id);
  const totalEngaged = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.amount_ht ?? 0), 0);

  return (
    <Sheet open={!!supplier} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {supplier ? (
          <>
            <SheetHeader>
              <SheetTitle>{supplier.company_name}</SheetTitle>
              <SheetDescription>
                {supplier.is_active ? "Fournisseur actif" : "Fournisseur inactif"}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Contact" value={[supplier.first_name, supplier.last_name].filter(Boolean).join(" ")} />
                <Info label="Email" value={supplier.email} />
                <Info label="Téléphone" value={supplier.phone} />
                <Info label="Ville" value={[supplier.postal_code, supplier.city].filter(Boolean).join(" ")} />
                <Info label="Adresse" value={[supplier.address_1, supplier.address_2].filter(Boolean).join(", ")} />
                <Info label="Pays" value={supplier.country} />
                <Info label="N° TVA" value={supplier.vat_number} />
                <Info label="IBAN" value={supplier.iban} />
                <Info label="BIC" value={supplier.bic} />
              </div>

              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Total engagé (HT, hors PO annulés)</p>
                <p className="text-2xl font-bold font-display">{formatEUR(totalEngaged)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {orders.length} bon{orders.length > 1 ? "s" : ""} de commande
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Historique des bons de commande</h3>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun bon de commande rattaché.</p>
                ) : (
                  <div className="rounded-2xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N°</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Montant HT</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">{o.po_number}</TableCell>
                            <TableCell>{formatDateFR(o.validation_date)}</TableCell>
                            <TableCell className="text-right">
                              {formatEUR(o.amount_ht, o.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {PO_STATUS_LABELS[o.status] ?? o.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <Button variant="outline" onClick={() => onEdit(supplier)}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifier le fournisseur
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words">{value || "—"}</p>
    </div>
  );
}
