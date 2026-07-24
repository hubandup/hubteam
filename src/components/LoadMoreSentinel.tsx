import { forwardRef } from 'react';

interface Props {
  hasMore: boolean;
  onLoadMore: () => void;
  visible: number;
  total: number;
  label?: string;
}

/** Tiny sentinel + fallback "Load more" button used by progressive lists. */
export const LoadMoreSentinel = forwardRef<HTMLDivElement, Props>(function LoadMoreSentinel(
  { hasMore, onLoadMore, visible, total, label = 'Charger plus' },
  ref,
) {
  if (!hasMore) {
    if (total === 0) return null;
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '16px 0 4px',
          fontFamily: "'Instrument Sans', sans-serif",
          fontSize: 12,
          color: 'hsl(var(--muted-foreground))',
        }}
      >
        {visible} / {total}
      </div>
    );
  }
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' }}>
      <button
        type="button"
        onClick={onLoadMore}
        style={{
          fontFamily: "'Instrument Sans', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          padding: '8px 16px',
          borderRadius: 'var(--radius-button, 999px)',
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
      <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
        {visible} / {total}
      </span>
    </div>
  );
});
