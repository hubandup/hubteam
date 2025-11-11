import {
  HelpCircle,
  Settings,
  Users,
  FileText,
  ShieldCheck,
  Briefcase,
  CreditCard,
  MessageSquare,
  Zap,
  Calendar,
  Bell,
  Lock,
  type LucideIcon,
} from 'lucide-react';

export interface FaqIconOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const FAQ_ICONS: FaqIconOption[] = [
  { id: 'help-circle', label: 'Aide', icon: HelpCircle },
  { id: 'settings', label: 'Paramètres', icon: Settings },
  { id: 'users', label: 'Utilisateurs', icon: Users },
  { id: 'file-text', label: 'Document', icon: FileText },
  { id: 'shield-check', label: 'Sécurité', icon: ShieldCheck },
  { id: 'briefcase', label: 'Entreprise', icon: Briefcase },
  { id: 'credit-card', label: 'Paiement', icon: CreditCard },
  { id: 'message-square', label: 'Message', icon: MessageSquare },
  { id: 'zap', label: 'Rapide', icon: Zap },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'bell', label: 'Notification', icon: Bell },
  { id: 'lock', label: 'Verrouillage', icon: Lock },
];

export const getIconComponent = (iconId: string): LucideIcon => {
  const iconOption = FAQ_ICONS.find((icon) => icon.id === iconId);
  return iconOption ? iconOption.icon : HelpCircle;
};
