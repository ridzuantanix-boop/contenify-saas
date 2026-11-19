'use client';

import { useEffect } from 'react';

/**
 * First-party, page-scoped interaction measurement.
 * No account identifier, form value, typed text, screen recording or persistent
 * browser identifier is collected. The random session ID expires with this mount.
 */
export function HeatmapTracker() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('heatmap_preview') === '1') return;

    const sessionId = crypto.randomUUID();
    let seq = 0;
    let clicks = 0;
    const reached = new Set<number>();
    const send = (payload: Record<string, unknown>) => {
      if (++seq > 40) return;
      void fetch('/api/analytics/heatmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous: true, sessionId, seq, device: window.innerWidth < 768 ? 'mobile' : 'desktop', ...payload }),
        credentials: 'same-origin',
        keepalive: true,
      }).catch(() => {});
    };

    const onClick = (event: MouseEvent) => {
      if (++clicks > 30) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const node = target.closest('a, button, video');
      const targetType = node?.tagName.toLowerCase() || 'other';
      const width = Math.max(1, document.documentElement.scrollWidth);
      const height = Math.max(1, document.documentElement.scrollHeight);
      send({ kind: 'click', x: Math.min(1, Math.max(0, event.pageX / width)), y: Math.min(1, Math.max(0, event.pageY / height)), targetType });
    };

    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        const remaining = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const depth = Math.min(100, Math.round(window.scrollY / remaining * 100));
        for (const threshold of [25, 50, 75, 90, 100]) {
          if (depth >= threshold && !reached.has(threshold)) {
            reached.add(threshold);
            send({ kind: 'scroll', depth: threshold });
          }
        }
      });
    };

    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
}
