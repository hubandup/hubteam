import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Progressive/lazy rendering for long lists.
 * Reveals `pageSize` items at a time and auto-loads more when a sentinel
 * enters the viewport (or via the returned `loadMore()` fn).
 *
 * Avoids rendering hundreds of cards up-front — huge win on Projects/CRM.
 */
export function useProgressiveList<T>(items: T[], pageSize = 24) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset when the underlying dataset shrinks or identity changes meaningfully.
  const total = items.length;
  useEffect(() => {
    setVisibleCount((prev) => Math.min(Math.max(pageSize, prev), Math.max(pageSize, total)));
  }, [total, pageSize]);

  const visible = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < total;

  const loadMore = () => setVisibleCount((c) => Math.min(c + pageSize, total));

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, visibleCount, total]);

  return { visible, visibleCount, total, hasMore, loadMore, sentinelRef };
}
