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
    let pageVariant = 'pending';
    let bonusViewed = false;
    let sectionObserver: IntersectionObserver | null = null;
    const detectVariant = () => {
      const marker = document.querySelector<HTMLElement>('[data-heatmap-variant]');
      const next = marker?.dataset.heatmapVariant;
      if (next !== 'bonus_v1' && next !== 'base_v1') return false;
      pageVariant = next;
      if (next === 'bonus_v1' && marker && !sectionObserver) {
        sectionObserver = new IntersectionObserver(entries => {
          if (bonusViewed || !entries.some(entry => entry.isIntersecting)) return;
          bonusViewed = true;
          send({ kind: 'section_view', regionKey: 'bonus' });
          sectionObserver?.disconnect();
        }, { threshold: 0.4 });
        sectionObserver.observe(marker);
      }
      return true;
    };
    const send = (payload: Record<string, unknown>) => {
      if (++seq > 40) return;
      void fetch('/api/analytics/heatmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous: true, sessionId, seq, device: window.innerWidth < 768 ? 'mobile' : 'desktop', pageVariant, ...payload }),
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
      const regionKey = target.closest('[data-heatmap-region="bonus"]') ? 'bonus' : undefined;
      const targetKey = node?.getAttribute('data-heatmap-action') || undefined;
      const width = Math.max(1, document.documentElement.scrollWidth);
      const height = Math.max(1, document.documentElement.scrollHeight);
      send({ kind: 'click', x: Math.min(1, Math.max(0, event.pageX / width)), y: Math.min(1, Math.max(0, event.pageY / height)), targetType, regionKey, targetKey });
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

    const variantObserver = new MutationObserver(() => { if (detectVariant()) variantObserver.disconnect(); });
    if (!detectVariant()) variantObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-heatmap-variant'] });
    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('scroll', onScroll);
      variantObserver.disconnect();
      sectionObserver?.disconnect();
    };
  }, []);

  return null;
}
