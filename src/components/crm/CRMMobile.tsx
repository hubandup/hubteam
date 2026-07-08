import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  ChevronRight,
  Star,
  Phone,
  Mail,
  Calendar,
  Wallet,
  Clock,
  Building2,
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useClients } from '@/hooks/useClients';
import { useUserRole } from '@/hooks/useUserRole';
import { useTargets, useToggleTarget } from '@/hooks/useTargets';
import { prefetchClientDetails } from '@/hooks/usePrefetchAppData';
import { AddClientDialog } from '@/components/AddClientDialog';
import { ProtectedAction } from '@/components/ProtectedAction';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { LogoAvatar } from '@/components/targets/LogoAvatar';
import { getUrgency, getStatusBucket, getLogoFallback, formatCa, formatShortFrDate } from '@/components/targets/targetUtils';

import {
  PROJECT_STATUS_LABELS,
  type ClientProjectFilterKey,
  type ProjectStatusKey,
} from '@/lib/project-status';

const NAVY = '#0C1320';
const LIME = '#DDF247';
const CARD_BORDER = '#ECECEE';
const TITLE = '#0F1524';
const MUTED = '#8A8F98';
const DANGER = '#E5484D';

const STATUS_META: Record<
  'client' | 'prospect' | 'relancer',
  { label: string; color: string }
> = {
  client: { label: 'Client actif', color: '#1B9E5A' },
  prospect: { label: 'Prospect', color: '#3B6FE0' },
  relancer: { label: 'À relancer', color: '#E0912B' },
};

const CHIPS: Array<{ key: ClientProjectFilterKey; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'planning', label: 'À faire' },
  { key: 'reco_in_progress', label: 'Reco' },
  { key: 'active', label: 'En cours' },
  { key: 'completed', label: 'Terminés' },
  { key: 'lost', label: 'Perdus' },
];

const PROJECT_TAG_COLOR: Record<ProjectStatusKey, string> = {
  planning: '#3B6FE0',
  reco_in_progress: '#7C4DD6',
  active: '#1B9E5A',
  completed: '#8A8F98',
  lost: '#E5484D',
  archived: '#8A8F98',
};

type Client = ReturnType<typeof useClients>['data'] extends Array<infer T> | undefined ? T : never;

interface Props {
  addClientOpen: boolean;
  onAddClientOpenChange: (open: boolean) => void;
}

export function CRMMobile({ addClientOpen, onAddClientOpenChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClients();
  const { isAgency } = useUserRole();
  const showRevenue = !isAgency;
  const { data: targets } = useTargets();
  const toggleTarget = useToggleTarget();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientProjectFilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let out = clients.filter((c) => c.active === true);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (c) =>
          c.company?.toLowerCase().includes(q) ||
          c.first_name?.toLowerCase().includes(q) ||
          c.last_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q),
      );
    }
    if (filter !== 'all') {
      out = out.filter((c) =>
        (c.projectStatuses || []).includes(filter as ProjectStatusKey),
      );
    }
    return [...out].sort((a, b) =>
      (a.company || '').toLowerCase().localeCompare((b.company || '').toLowerCase()),
    );
  }, [clients, search, filter]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) || clients.find((c) => c.id === selectedId) || null,
    [selectedId, filtered, clients],
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
            CRM
          </h1>
          <p className="text-white/60 text-[13px] mt-1" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
            {filtered.length} client{filtered.length > 1 ? 's' : ''} · gère prospects & clients
          </p>
        </div>
        <ProtectedAction module="crm" action="create">
          <button
            type="button"
            onClick={() => onAddClientOpenChange(true)}
            aria-label="Nouveau client"
            className="h-11 w-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{ backgroundColor: LIME, color: NAVY }}
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </ProtectedAction>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: MUTED }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client, contact, email…"
          className="w-full h-11 pl-9 pr-3 text-[14px] bg-white outline-none"
          style={{
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            color: TITLE,
          }}
        />
      </div>

      {/* Chips */}
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max pb-1">
          {CHIPS.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className="h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors min-h-[36px]"
                style={{
                  backgroundColor: active ? NAVY : 'white',
                  color: active ? 'white' : TITLE,
                  border: `1px solid ${active ? NAVY : CARD_BORDER}`,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[14px]" style={{ color: MUTED }}>
          Aucun client ne correspond
        </div>
      ) : (
        <ul className="flex flex-col gap-2 w-full min-w-0">
          {filtered.map((client) => (
            <ClientSummaryCard
              key={client.id}
              client={client}
              isStarred={!!targets?.has(client.id)}
              onOpen={() => {
                setSelectedId(client.id);
                prefetchClientDetails(queryClient, client.id);
              }}
              onToggleStar={() =>
                toggleTarget.mutate({
                  clientId: client.id,
                  starred: !!targets?.has(client.id),
                })
              }
            />
          ))}
        </ul>
      )}

      {/* Detail sheet */}
      <MobileBottomSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        variant="light"
        ariaLabel={selected ? `Détail ${selected.company}` : undefined}
      >
        {selected && (
          <ClientDetailContent
            client={selected}
            showRevenue={showRevenue}
            onOpenFull={() => {
              setSelectedId(null);
              navigate(`/client/${selected.id}?tab=commercial`);
            }}
          />
        )}
      </MobileBottomSheet>

      <AddClientDialog
        open={addClientOpen}
        onOpenChange={onAddClientOpenChange}
        onClientAdded={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
      />
    </div>
  );
}

/* -------------------- Summary card -------------------- */

function ClientSummaryCard({
  client,
  isStarred,
  onOpen,
  onToggleStar,
}: {
  client: any;
  isStarred: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
}) {
  return (
    <li className="w-full min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="w-full min-w-0 max-w-full bg-white p-3 text-left active:bg-black/[0.02] transition-colors overflow-hidden flex flex-col items-stretch justify-start"
        style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
      >
        <div className="flex items-center gap-3 min-h-[44px]">
          <LogoAvatar url={client.logo_url} name={client.company || `${client.first_name || ''} ${client.last_name || ''}`.trim() || '?'} size={40} />
          <span
            className="flex-1 min-w-0 truncate text-[15px] font-semibold uppercase"
            style={{ color: TITLE }}
          >
            {client.company || `${client.first_name || ''} ${client.last_name || ''}`.trim()}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            aria-label={isStarred ? 'Retirer des Targets' : 'Ajouter aux Targets'}
            className="h-11 w-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center -m-2"
          >
            <Star
              className="h-[18px] w-[18px]"
              style={{
                color: isStarred ? '#F5C518' : MUTED,
                fill: isStarred ? '#F5C518' : 'transparent',
              }}
            />
          </button>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
        </div>
      </button>
    </li>
  );
}


/* -------------------- Detail sheet content -------------------- */

function ClientDetailContent({
  client,
  showRevenue,
  onOpenFull,
}: {
  client: any;
  showRevenue: boolean;
  onOpenFull: () => void;
}) {
  const fallback = getLogoFallback(client.company || client.first_name || '?');
  const bucket = getStatusBucket(client.kanban_stage, client.follow_up_date);
  const status = STATUS_META[bucket];
  const contactName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
  const ca = client.revenue_current_year ?? client.revenue ?? 0;
  const tags: ProjectStatusKey[] = (client.projectStatuses || []).filter(
    (k: ProjectStatusKey) => k !== 'archived',
  );

  const followupLate = client.follow_up_date && isPast(new Date(client.follow_up_date));

  const rows: Array<{ icon: any; label: string; value: string; href?: string; danger?: boolean }> = [];
  if (client.email) {
    rows.push({ icon: Mail, label: 'Email', value: client.email, href: `mailto:${client.email}` });
  }
  if (client.phone) {
    rows.push({ icon: Phone, label: 'Téléphone', value: client.phone, href: `tel:${client.phone}` });
  }
  if (showRevenue && Number(ca) > 0) {
    rows.push({ icon: Wallet, label: 'Chiffre d\'affaires', value: formatCa(Number(ca)) });
  }
  if (client.follow_up_date) {
    rows.push({
      icon: Calendar,
      label: 'Prochaine échéance',
      value: format(new Date(client.follow_up_date), 'd MMMM yyyy', { locale: fr }),
      danger: !!followupLate,
    });
  }
  if (client.last_contact) {
    rows.push({
      icon: Clock,
      label: 'Dernier contact',
      value: format(new Date(client.last_contact), 'd MMMM yyyy', { locale: fr }),
    });
  }

  return (
    <div className="pt-2 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LogoAvatar url={client.logo_url} name={client.company || contactName || '?'} size={64} className="!rounded-2xl" />

        <div className="min-w-0 flex-1">
          <h2
            className="text-[22px] leading-tight uppercase truncate"
            style={{
              color: TITLE,
              fontFamily: "'Archivo', 'Instrument Sans', system-ui, sans-serif",
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            {client.company || contactName || 'Client'}
          </h2>
          {contactName && client.company && (
            <p className="text-[13px] mt-0.5 truncate" style={{ color: MUTED }}>
              {contactName}
            </p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold"
          style={{ backgroundColor: `${status.color}1A`, color: status.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
          {status.label}
        </span>
        {tags.map((k) => (
          <span
            key={k}
            className="inline-flex items-center h-7 px-3 rounded-full text-[12px] font-semibold"
            style={{
              backgroundColor: `${PROJECT_TAG_COLOR[k]}1A`,
              color: PROJECT_TAG_COLOR[k],
            }}
          >
            {PROJECT_STATUS_LABELS[k]}
          </span>
        ))}
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
              <span
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#F4F4F3' }}
              >
                <Icon className="h-4 w-4" style={{ color: TITLE }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] uppercase tracking-wide" style={{ color: MUTED }}>
                  {r.label}
                </p>
                <p
                  className="text-[14px] font-medium truncate"
                  style={{ color: r.danger ? DANGER : TITLE }}
                >
                  {r.value}
                </p>
              </div>
            </div>
          );
          return (
            <li
              key={`${r.label}-${i}`}
              style={i > 0 ? { borderTop: `1px solid ${CARD_BORDER}` } : undefined}
            >
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
          href={client.phone ? `tel:${client.phone}` : undefined}
          aria-disabled={!client.phone}
          onClick={(e) => !client.phone && e.preventDefault()}
          className="h-12 min-h-[44px] rounded-full flex items-center justify-center gap-2 text-[14px] font-semibold"
          style={{
            backgroundColor: client.phone ? NAVY : '#E9EAEC',
            color: client.phone ? 'white' : MUTED,
          }}
        >
          <Phone className="h-4 w-4" strokeWidth={2} />
          Appeler
        </a>
        <a
          href={client.email ? `mailto:${client.email}` : undefined}
          aria-disabled={!client.email}
          onClick={(e) => !client.email && e.preventDefault()}
          className="h-12 min-h-[44px] rounded-full flex items-center justify-center gap-2 text-[14px] font-semibold"
          style={{
            backgroundColor: client.email ? LIME : '#E9EAEC',
            color: client.email ? NAVY : MUTED,
          }}
        >
          <Mail className="h-4 w-4" strokeWidth={2} />
          Email
        </a>
      </div>

      {/* Open full profile */}
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
