'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Variant = 'bonus_v1' | 'base_v1' | 'legacy';
type Report = { days: number; device: 'mobile' | 'desktop'; variant: Variant; sessions: number; clicks: number; scroll: Array<{ depth: number; sessions: number }>; types: Record<string, number>; bins: Array<{ x: number; y: number; count: number }>; bonusFunnel: Record<string, number>; capped: boolean; generatedAt: string };

export default function HeatmapPage() {
  const [days, setDays] = useState<7 | 30>(7);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [variant, setVariant] = useState<Variant>('bonus_v1');
  const [previewVariant, setPreviewVariant] = useState('pending');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState(390);
  const [pageHeight, setPageHeight] = useState(800);
  const container = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const previewCleanup = useRef<() => void>(() => {});
  const sourceWidth = device === 'mobile' ? 390 : 1280;
  const scale = Math.min(1, containerWidth / sourceWidth);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/heatmap?days=${days}&device=${device}&variant=${variant}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Data heatmap belum dapat dimuatkan. Semak migrasi dan sambungan database.');
      setReport(await response.json() as Report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ralat heatmap.'); }
    finally { setLoading(false); }
  }, [days, device, variant]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setContainerWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => previewCleanup.current(), []);
  const measurePage = () => {
    previewCleanup.current();
    try {
      const doc = iframe.current?.contentDocument;
      if (!doc) return;
      const update = () => {
        setPageHeight(doc.documentElement.scrollHeight || 800);
        setPreviewVariant(doc.querySelector<HTMLElement>('[data-heatmap-variant]')?.dataset.heatmapVariant || 'pending');
      };
      update();
      const mutation = new MutationObserver(update);
      mutation.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-heatmap-variant'] });
      const resize = new ResizeObserver(update);
      resize.observe(doc.documentElement);
      previewCleanup.current = () => { mutation.disconnect(); resize.disconnect(); };
    } catch { setPageHeight(800); setPreviewVariant('pending'); }
  };
  const canOverlay = variant !== 'legacy' && variant === previewVariant;

  return <main className="mx-auto max-w-6xl space-y-5 pb-20 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin" className="text-xs font-bold text-violet-700">← Dashboard admin</Link><h1 className="mt-2 text-2xl font-black">Heatmap salespage AffiMatik</h1><p className="mt-1 text-sm text-slate-600">Klik dan scroll anonim, dipisahkan mengikut susun atur halaman dan peranti.</p></div><button onClick={() => void refresh()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold">Muat semula</button></div>
    <div className="flex flex-wrap gap-2">{(['bonus_v1', 'base_v1', 'legacy'] as const).map(value => <button key={value} onClick={() => setVariant(value)} className={`rounded-xl px-4 py-2 text-xs font-bold ${variant === value ? 'bg-amber-400 text-slate-950' : 'bg-white text-slate-700'}`}>{value === 'bonus_v1' ? 'Bonus 100 kredit' : value === 'base_v1' ? 'Tanpa bonus' : 'Data lama'}</button>)}{(['mobile', 'desktop'] as const).map(value => <button key={value} onClick={() => setDevice(value)} className={`rounded-xl px-4 py-2 text-xs font-bold ${device === value ? 'bg-violet-600 text-white' : 'bg-white text-slate-700'}`}>{value === 'mobile' ? 'Telefon' : 'Desktop'}</button>)}{([7, 30] as const).map(value => <button key={value} onClick={() => setDays(value)} className={`rounded-xl px-4 py-2 text-xs font-bold ${days === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>{value} hari</button>)}</div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Sesi dengan acara</p><p className="text-3xl font-black">{report?.sessions ?? '—'}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Klik direkod</p><p className="text-3xl font-black">{report?.clicks ?? '—'}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Klik pautan / butang</p><p className="text-3xl font-black">{report ? (report.types.link || 0) + (report.types.button || 0) : '—'}</p></div></div>
    {loading && <p className="text-sm text-slate-500">Memuatkan data…</p>}
    {report?.capped && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Paparan terhad kepada 5,000 acara terkini. Pilih tempoh lebih pendek untuk analisis yang lebih tepat.</p>}
    {report && report.sessions < 20 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Sampel masih kecil. Tunggu lebih banyak sesi anonim sebelum ubah iklan atau susun atur halaman berdasarkan heatmap.</p>}
    {variant === 'bonus_v1' && <section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Laluan bonus 100 kredit</h2><p className="mt-1 text-xs text-slate-500">Bilangan sesi unik. Ini mengukur paparan dan klik, bukan claim berjaya, pendaftaran atau pembelian.</p><div className="mt-4 grid gap-3 sm:grid-cols-5">{([['section_view', 'Lihat bonus'], ['bonus_claim', 'Klik claim'], ['bonus_register', 'Klik daftar'], ['bonus_help_open', 'Buka bantuan'], ['bonus_help_submit', 'Klik hantar bantuan']] as const).map(([key, label]) => <div key={key} className="rounded-xl bg-violet-50 p-3"><p className="text-xs text-slate-600">{label}</p><p className="text-2xl font-black">{report?.bonusFunnel?.[key] ?? '—'}</p></div>)}</div></section>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Kedalaman scroll</h2><p className="mt-1 text-xs text-slate-500">Bilangan sesi yang mencapai ambang ini. Pengiraan hanya meliputi sesi yang ada dalam data terpapar.</p><div className="mt-4 space-y-3">{(report?.scroll || []).map(item => <div key={item.depth} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3 text-xs"><span className="font-bold">{item.depth}%</span><div className="h-4 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${report?.sessions ? item.sessions / report.sessions * 100 : 0}%` }} /></div><span className="text-right font-bold">{item.sessions}</span></div>)}</div></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-black">Peta klik pada halaman</h2><p className="mt-1 text-xs text-slate-500">Titik hanya dipaparkan apabila versi halaman pratonton sepadan dengan data.</p>{!canOverlay && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Pratonton kini {previewVariant === 'bonus_v1' ? 'dengan bonus' : previewVariant === 'base_v1' ? 'tanpa bonus' : 'sedang dimuatkan'}. Peta klik {variant === 'legacy' ? 'lama' : variant === 'bonus_v1' ? 'bonus' : 'tanpa bonus'} disembunyikan untuk elak kedudukan yang salah.</p>}<div ref={container} className="relative mx-auto mt-5 w-full max-w-[1000px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ height: Math.max(300, pageHeight * scale) }}><div className="absolute left-0 top-0" style={{ width: sourceWidth, height: pageHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}><iframe ref={iframe} title="Pratonton salespage AffiMatik untuk heatmap" src="/?heatmap_preview=1" onLoad={measurePage} className="pointer-events-none block border-0" style={{ width: sourceWidth, height: pageHeight }} tabIndex={-1} /><div className="pointer-events-none absolute inset-0">{canOverlay && report?.bins.map(bin => <div key={`${bin.x}:${bin.y}`} className="absolute rounded-full bg-red-500/55 blur-[3px]" style={{ left: `${(bin.x + .5) / 12 * 100}%`, top: `${(bin.y + .5) / 80 * 100}%`, width: Math.min(120, 30 + bin.count * 14), height: Math.min(120, 30 + bin.count * 14), transform: 'translate(-50%,-50%)' }} title={`${bin.count} klik`} />)}</div></div></div></section>
    <p className="text-xs text-slate-500">Data baharu bermula selepas fungsi ini diterbitkan. Heatmap tidak merakam teks, input borang atau video skrin. Masa kemas kini: {report ? new Date(report.generatedAt).toLocaleString('ms-MY') : '—'}.</p>
  </main>;
}
