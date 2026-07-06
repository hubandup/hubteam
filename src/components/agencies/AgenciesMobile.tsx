import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, ChevronRight, Mail, Phone, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { ProtectedAction } from '@/components/ProtectedAction';
import { AddAgencyDialog } from '@/components/AddAgencyDialog';
import { getLogoFallback } from '@/components/targets/targetUtils';


const NAVY = '#0C1320';
const LIME = '#DDF247';
const CARD_BORDER = '#ECECEE';
const TITLE = '#0F1524';
const MUTED = '#8A8F98';
const ACTIVE = '#1B9E5A';

interface AgencyContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
}

interface Agency {
  id: string;
  name: string;
  active: boolean;
  logo_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  main_contact_id?: string | null;
  tags?: string[] | null;
  agency_contacts?: AgencyContact[];
}

interface Props {
  agencies: Agency[];
  onAgencyAdded: () => void;
  addAgencyOpen: boolean;
  onAddAgencyOpenChange: (open: boolean) => void;
}


function getPrimaryContact(agency: Agency): { name: string; email?: string; phone?: string } {
  const contacts = agency.agency_contacts || [];
  const main = agency.main_contact_id
    ? contacts.find((c) => c.id === agency.main_contact_id)
    : undefined;
  const first = main || contacts[0];
  if (first) {
    const name = `${first.first_name || ''} ${first.last_name || ''}`.trim() || 'Contact';
    return { name, email: first.email || undefined, phone: first.phone || agency.contact_phone || undefined };
  }
  return {
    name: 'Agence partenaire',
    email: agency.contact_email || undefined,
    phone: agency.contact_phone || undefined,
  };
}

export function AgenciesMobile({ agencies, onAgencyAdded, addAgencyOpen, onAddAgencyOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = agencies;
    if (q) {
      out = out.filter((agency) => {
        if (agency.name?.toLowerCase().includes(q)) return true;
        const contact = getPrimaryContact(agency);
        if (contact.name?.toLowerCase().includes(q)) return true;
        if (contact.email?.toLowerCase().includes(q)) return true;
        if (agency.agency_contacts?.some((c) => c.email?.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return [...out].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [agencies, search]);

  const selected = useMemo(
    () => agencies.find((a) => a.id === selectedId) || null,
    [selectedId, agencies],
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header navy */}
      <div
        className="rounded-2xl p-4 flex items-start justify-between gap-3"
        style={{ backgroundColor: NAVY }}
      >
        <div className="min-w-0">
          <h1
            className="text-white text-[26px] leading-tight"
            style={{
              fontFamily: "'Archivo', 'Instrument Sans', system-ui, sans-serif",
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}
          >
            Agences
          </h1>
          <p className="text-white/60 text-[13px] mt-1" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
            {filtered.length} agence{filtered.length > 1 ? 's' : ''} · gère tes partenaires
          </p>

        </div>
        <ProtectedAction module="agencies" action="create">
          <button
            type="button"
            onClick={() => onAddAgencyOpenChange(true)}
            aria-label="Nouvelle agence"
            className="h-11 w-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{ backgroundColor: LIME, color: NAVY }}
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </ProtectedAction>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: MUTED }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une agence, contact, email…"
          className="w-full h-11 pl-9 pr-3 text-[14px] bg-white outline-none"
          style={{
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            color: TITLE,
          }}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[14px]" style={{ color: MUTED }}>
          Aucune agence ne correspond
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((agency) => (
            <AgencySummaryCard key={agency.id} agency={agency} onOpen={() => setSelectedId(agency.id)} />
          ))}
        </ul>
      )}

      {/* Detail sheet */}
      <MobileBottomSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        variant="light"
        ariaLabel={selected ? `Détail ${selected.name}` : undefined}
      >
        {selected && (
          <AgencyDetailContent
            agency={selected}
            onOpenFull={() => {
              setSelectedId(null);
              navigate(`/agency/${selected.id}`);
            }}
          />
        )}
      </MobileBottomSheet>

      <AddAgencyDialog
        open={addAgencyOpen}
        onOpenChange={onAddAgencyOpenChange}
        hideTrigger
        onAgencyAdded={onAgencyAdded}
      />

    </div>
  );
}

/* ---------------- Summary card ---------------- */

function AgencySummaryCard({ agency, onOpen }: { agency: Agency; onOpen: () => void }) {
  const contact = getPrimaryContact(agency);
  const fallback = getLogoFallback(agency.name || '?');

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full bg-white p-3 text-left active:bg-black/[0.02] transition-colors"
        style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
      >
        {/* Row 1 */}
        <div className="flex items-center gap-3 min-h-[44px]">
          <span
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
            style={{ backgroundColor: fallback.bg, color: fallback.text }}
          >
            {fallback.initials}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-semibold truncate" style={{ color: TITLE }}>
              {agency.name}
            </p>
            <p className="text-[12px] truncate" style={{ color: MUTED }}>
              {contact.name}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold shrink-0"
            style={{ backgroundColor: `${ACTIVE}1A`, color: ACTIVE }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACTIVE }} />
            Actif
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
        </div>

        {/* Row 2 */}
        <div
          className="mt-3 pt-3 flex items-center gap-2"
          style={{ borderTop: `1px solid ${CARD_BORDER}` }}
        >
          <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: MUTED }} />
          <span className="text-[12.5px] font-medium truncate" style={{ color: MUTED }}>
            {contact.email || '—'}
          </span>
        </div>
      </button>
    </li>
  );
}

/* ---------------- Detail sheet content ---------------- */

function AgencyDetailContent({ agency, onOpenFull }: { agency: Agency; onOpenFull: () => void }) {
  const contact = getPrimaryContact(agency);
  const fallback = getLogoFallback(agency.name || '?');

  const rows: Array<{ icon: any; label: string; value: string; href?: string }> = [];
  if (contact.email) {
    rows.push({ icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}` });
  }
  if (contact.phone) {
    rows.push({ icon: Phone, label: 'Téléphone', value: contact.phone, href: `tel:${contact.phone}` });
  }

  return (
    <div className="pt-2 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 text-[18px] font-bold"
          style={{ backgroundColor: fallback.bg, color: fallback.text }}
        >
          {fallback.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="text-[22px] leading-tight truncate"
            style={{
              color: TITLE,
              fontFamily: "'Archivo', 'Instrument Sans', system-ui, sans-serif",
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            {agency.name}
          </h2>
          <p className="text-[13px] mt-0.5 truncate" style={{ color: MUTED }}>
            {contact.name}
          </p>
        </div>
      </div>

      {/* Badge */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold"
          style={{ backgroundColor: `${ACTIVE}1A`, color: ACTIVE }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACTIVE }} />
          Actif
        </span>
      </div>

      {/* Rows */}
      <ul
        className="mt-5 bg-white overflow-hidden"
        style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
      >
        {rows.map((r, i) => {
          const Icon = r.icon;
          const content = (
            <div className="flex items-center gap-3 px-3 py-3 min-h-[52px]">
              <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#F4F4F3' }}>
                <Icon className="h-4 w-4" style={{ color: TITLE }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] uppercase tracking-wide" style={{ color: MUTED }}>
                  {r.label}
                </p>
                <p className="text-[14px] font-medium truncate" style={{ color: TITLE }}>
                  {r.value}
                </p>
              </div>
            </div>
          );
          return (
            <li key={`${r.label}-${i}`} style={i > 0 ? { borderTop: `1px solid ${CARD_BORDER}` } : undefined}>
              {r.href ? (
                <a href={r.href} className="block active:bg-black/5">
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-4 py-6 text-center text-[13px]" style={{ color: MUTED }}>
            Aucune information de contact
          </li>
        )}
      </ul>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={contact.phone ? `tel:${contact.phone}` : undefined}
          aria-disabled={!contact.phone}
          onClick={(e) => !contact.phone && e.preventDefault()}
          className="h-12 min-h-[44px] rounded-full flex items-center justify-center gap-2 text-[14px] font-semibold"
          style={{
            backgroundColor: contact.phone ? NAVY : '#E9EAEC',
            color: contact.phone ? 'white' : MUTED,
          }}
        >
          <Phone className="h-4 w-4" strokeWidth={2} />
          Appeler
        </a>
        <a
          href={contact.email ? `mailto:${contact.email}` : undefined}
          aria-disabled={!contact.email}
          onClick={(e) => !contact.email && e.preventDefault()}
          className="h-12 min-h-[44px] rounded-full flex items-center justify-center gap-2 text-[14px] font-semibold"
          style={{
            backgroundColor: contact.email ? LIME : '#E9EAEC',
            color: contact.email ? NAVY : MUTED,
          }}
        >
          <Mail className="h-4 w-4" strokeWidth={2} />
          Email
        </a>
      </div>

      <button
        type="button"
        onClick={onOpenFull}
        className="mt-3 w-full h-11 min-h-[44px] rounded-full flex items-center justify-center gap-2 text-[13px] font-semibold"
        style={{ backgroundColor: 'white', border: `1px solid ${CARD_BORDER}`, color: TITLE }}
      >
        <Building2 className="h-4 w-4" />
        Voir la fiche complète
      </button>
    </div>
  );
}
