/**
 * Design tokens — single source of truth for card visuals.
 *
 * RULE: any new card (or refactor) MUST consume these tokens.
 * Never inline status colors, urgency colors, logo sizes, or spacing values
 * inside components. If a new variant is needed, add it here first.
 */

export type StatusKey =
  // CRM / Targets
  | "prospect"
  | "client"
  | "relancer"
  // Generic active/inactive (Agences)
  | "active"
  | "inactive"
  // Projects
  | "project_active"
  | "project_planning"
  | "project_reco"
  | "project_completed"
  | "project_lost"
  | "project_urgent";

export interface StatusToken {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

export const STATUS_TOKENS: Record<StatusKey, StatusToken> = {
  prospect:          { label: "Prospect",     bg: "#EFF6FF", text: "#1D4ED8", dot: "#2563EB" },
  client:            { label: "Client actif", bg: "#ECFDF5", text: "#047857", dot: "#059669" },
  relancer:          { label: "À relancer",   bg: "#FFF7ED", text: "#C2410C", dot: "#EA580C" },

  active:            { label: "Actif",        bg: "#ECFDF5", text: "#047857", dot: "#059669" },
  inactive:          { label: "Inactif",      bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },

  project_active:    { label: "En cours",     bg: "#ECFDF5", text: "#047857", dot: "#059669" },
  project_planning:  { label: "À faire",      bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  project_reco:      { label: "Reco",         bg: "#F3E8FF", text: "#6B21A8", dot: "#9333EA" },
  project_completed: { label: "Terminé",      bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  project_lost:      { label: "Perdu",        bg: "#FEF2F2", text: "#B91C1C", dot: "#DC2626" },
  project_urgent:    { label: "Urgent",       bg: "#FEF2F2", text: "#B91C1C", dot: "#DC2626" },
};

/** Urgency text color used by the alert row on cards. */
export const URGENCY_TOKENS = {
  late:  "#DC2626",
  week:  "#EA580C",
  month: "#65748B",
  none:  "",
} as const;

export type UrgencyKey = keyof typeof URGENCY_TOKENS;

/** Logo box sizes used by EntityCard (Tailwind classes). */
export const LOGO_SIZE = {
  md: "w-16 h-16", // 64px — CRM / Agences / Targets
  xl: "w-20 h-20", // 80px — Projects
} as const;

/** Card internal spacing (Tailwind classes) — keep aligned with EntityCard. */
export const CARD_SPACING = {
  padX: "px-6",
  padY: "pb-6",
  padTop: "pt-5",
  gapStack: "mb-4",
  footerPad: "pt-4",
} as const;
