import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Tailwind classes appended to the sheet surface. */
  className?: string;
  /** Sheet background variant. `navy` uses #0C1320 with light text, `light` uses white. */
  variant?: 'navy' | 'light';
  /** Optional accessible label. */
  ariaLabel?: string;
  /** Hide the close (×) button (overlay + drag handle still close). */
  hideCloseButton?: boolean;
}

/**
 * Reusable mobile-first bottom sheet.
 * - slide-up animation, max-height 82%
 * - top radius 26px, drag handle, close ✕
 * - overlay click closes, stopPropagation on content
 * - safe-area aware
 *
 * Used by CRM/Projets/Agences detail overlays on mobile.
 */
export function MobileBottomSheet({
  open,
  onOpenChange,
  children,
  className,
  variant = 'light',
  ariaLabel,
  hideCloseButton,
}: MobileBottomSheetProps) {
  // Lock body scroll while open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const isNavy = variant === 'navy';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50 animate-fade-in"
      />

      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full max-w-[640px] flex flex-col animate-slide-in-up',
          isNavy ? 'text-white' : 'text-foreground',
          className,
        )}
        style={{
          backgroundColor: isNavy ? '#0C1320' : '#FFFFFF',
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          maxHeight: '82vh',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
        }}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-1 flex items-center justify-center">
          <div
            className={cn('h-1.5 w-10 rounded-full', isNavy ? 'bg-white/25' : 'bg-black/15')}
          />
        </div>

        {/* Close */}
        {!hideCloseButton && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className={cn(
              'absolute top-3 right-3 h-11 w-11 rounded-full flex items-center justify-center',
              isNavy ? 'text-white/80 hover:bg-white/10' : 'text-foreground/70 hover:bg-black/5',
            )}
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="overflow-y-auto overscroll-contain flex-1 px-4 pb-6">
          {children}
        </div>

      </div>
    </div>
  );
}
