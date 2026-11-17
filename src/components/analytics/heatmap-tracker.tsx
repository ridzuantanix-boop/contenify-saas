'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const choiceKey = 'affimatik_heatmap_choice_v1';

type Choice = 'yes' | 'no' | null;

export function HeatmapTracker() {
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const isPreview = new URLSearchParams(window.location.search).get('heatmap_preview') === '1';
    setPreview(isPreview);
    if (isPreview) return;
    try {
      const stored = window.localStorage.getItem(choiceKey);
      setChoice(stored === 'yes' || stored === 'no' ? stored : null);
    } catch { setChoice(null); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (choice !== 'yes' || preview) return;
    const sessionId = crypto.randomUUID();
    let seq = 0;
    let clicks = 0;
    const reached = new Set<number>();
    const send = (payload: Record<string, unknown>) => {
      if (++seq > 40) return;
      void fetch('/api/analytics/heatmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, sessionId, seq, device: window.innerWidth < 768 ? 'mobile' : 'desktop', ...payload }),
        credentials: 'same-origin',
        keepalive: true,
      }).catch(() => {});
    };
    const onClick = (event: MouseEvent) => {
      if (++clicks > 30) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-heatmap-control], input, textarea, select, [contenteditable="true"]')) return;
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
  }, [choice, preview]);

  if (!ready || preview) return null;
  const choose = (value: 'yes' | 'no') => {
    try { window.localStorage.setItem(choiceKey, value); } catch { /* No persistent consent means no tracking after reload. */ }
    setChoice(value);
    setSettingsOpen(false);
  };
  return <div data-heatmap-control className="fixed bottom-3 right-3 z-50 max-w-[min(23rem,calc(100vw-1.5rem))] text-sm">
    {(choice === null || settingsOpen) ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl">
      <p className="font-black">Analitik laman pilihan anda</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">Benarkan AffiMatik merekod lokasi klik dan tahap scroll untuk membaiki halaman ini? Kami tidak merekod taipan, borang atau rakaman skrin. <Link href="/privacy" className="underline">Notis privasi</Link>.</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={() => choose('yes')} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">Benarkan</button><button type="button" onClick={() => choose('no')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Tolak</button></div>
    </div> : <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-md">Tetapan analitik</button>}
  </div>;
}
