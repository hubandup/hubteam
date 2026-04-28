import { differenceInCalendarDays, format, isSameYear } from 'date-fns';
import { fr } from 'date-fns/locale';

export type UrgencyBucket = 'late' | 'week' | 'month' | 'none';
export type StatusBucket = 'prospect' | 'client' | 'relancer';

export function getUrgency(followUpDate?: string | null): {
  bucket: UrgencyBucket;
  daysDiff: number;
  label: string;
} {
  if (!followUpDate) return { bucket: 'none', daysDiff: 0, label: '' };
  const d = new Date(followUpDate);
  if (isNaN(d.getTime())) return { bucket: 'none', daysDiff: 0, label: '' };

  const diff = differenceInCalendarDays(d, new Date());

  if (diff < 0) {
    const days = Math.abs(diff);
    return { bucket: 'late', daysDiff: diff, label: `En retard de ${days}j` };
  }
  if (diff === 0) return { bucket: 'late', daysDiff: 0, label: "Aujourd'hui" };
  if (diff <= 7) return { bucket: 'week', daysDiff: diff, label: `Dans ${diff}j` };
  if (diff <= 14) return { bucket: 'month', daysDiff: diff, label: `Dans ${diff}j` };
  const weeks = Math.round(diff / 7);
  return { bucket: 'month', daysDiff: diff, label: `Dans ${weeks} semaines` };
}

const PROSPECT_STAGES = new Set(['prospect', 'rdv_a_prendre', 'rdv_hub_date', 'rdv_pris']);
const CLIENT_STAGES = new Set(['reco_en_cours', 'projet_valide', 'a_fideliser']);
const RELANCER_STAGES = new Set(['a_relancer', 'sans_suite']);

export function getStatusBucket(
  kanbanStage?: string | null,
  followUpDate?: string | null,
): StatusBucket {
  // If overdue → toujours "à relancer"
  if (followUpDate) {
    const d = new Date(followUpDate);
    if (!isNaN(d.getTime()) && differenceInCalendarDays(d, new Date()) < 0) {
      return 'relancer';
    }
  }
  if (kanbanStage && RELANCER_STAGES.has(kanbanStage)) return 'relancer';
  if (kanbanStage && CLIENT_STAGES.has(kanbanStage)) return 'client';
  if (kanbanStage && PROSPECT_STAGES.has(kanbanStage)) return 'prospect';
  return 'prospect';
}

export function getStatusStyle(bucket: StatusBucket): {
  bg: string;
  text: string;
  dot: string;
  label: string;
} {
  switch (bucket) {
    case 'prospect':
      return { bg: '#EFF6FF', text: '#1D4ED8', dot: '#2563EB', label: 'Prospect' };
    case 'client':
      return { bg: '#ECFDF5', text: '#047857', dot: '#059669', label: 'Client actif' };
    case 'relancer':
      return { bg: '#FFF7ED', text: '#C2410C', dot: '#EA580C', label: 'À relancer' };
  }
}

const PASTEL_PALETTE = [
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#E0E7FF', text: '#3730A3' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#F3E8FF', text: '#6B21A8' },
  { bg: '#FEF9C3', text: '#854D0E' },
];

export function getLogoFallback(name: string): { bg: string; text: string; initials: string } {
  const cleaned = (name || '').trim();
  const firstChar = cleaned.charAt(0).toUpperCase() || '?';
  const code = firstChar.charCodeAt(0);
  const palette = PASTEL_PALETTE[code % PASTEL_PALETTE.length];
  // 2 first alphabetic letters
  const letters = cleaned.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase() || '??';
  return { ...palette, initials: letters };
}

export function formatShortFrDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const sameYear = isSameYear(d, new Date());
  return sameYear
    ? format(d, 'd MMM', { locale: fr })
    : format(d, 'd MMM yy', { locale: fr });
}

export function formatCa(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}
