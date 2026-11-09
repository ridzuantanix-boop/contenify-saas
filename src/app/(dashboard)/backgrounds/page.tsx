'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

type Background = { id: string; name: string; description?: string | null; imageUrl: string; thumbnailUrl?: string; category?: string };
type Scene = { id: string; name: string; directive: string };

export default function BackgroundLibraryPage() {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [officialBackgrounds, setOfficialBackgrounds] = useState<Background[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => { const response = await fetch('/api/backgrounds', { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setOfficialBackgrounds(data.officialBackgrounds || []); setBackgrounds(data.backgrounds || []); setScenes(data.builtInScenes || []); }, []);
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  async function upload(file?: File) {
    if (!file) return; const name = window.prompt('Nama latar:')?.trim(); if (!name) return;
    setBusy(true); setMessage('');
    try { const form = new FormData(); form.set('name', name); form.set('image', file); const response = await fetch('/api/backgrounds', { method: 'POST', body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); setMessage('Latar berjaya disimpan.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Upload gagal.'); } finally { setBusy(false); }
  }
  async function remove(item: Background) {
    if (!window.confirm(`Padam latar “${item.name}”? Preset lama akan kekal tetapi perlu memilih latar baharu.`)) return;
    setBusy(true); try { const response = await fetch(`/api/backgrounds?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); setMessage('Latar dipadam.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Padam gagal.'); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-extrabold text-slate-900">Background Library</h1><p className="mt-1 text-sm text-slate-500">Simpan latar peribadi atau gunakan babak teks terbina dalam di Creator Studio.</p></div>
    {message && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">{message}</div>}
    <section className="rounded-2xl border border-indigo-100 bg-white p-5"><div className="mb-4"><h2 className="font-bold text-slate-900">Koleksi AffiMatik</h2><p className="text-xs text-slate-500">18 latar rasmi 9:16 yang ringan, read-only dan tersedia kepada semua pengguna.</p></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{officialBackgrounds.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumbnailUrl || item.imageUrl} alt={item.name} className="aspect-[9/16] w-full object-cover" /><div className="p-3"><div className="truncate text-xs font-bold">{item.name}</div><div className="mt-1 text-[10px] capitalize text-slate-500">{item.category}</div></div></article>)}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Latar Saya</h2><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload Latar</label></div>
      {backgrounds.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Belum ada latar upload.</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{backgrounds.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.name} className="aspect-video w-full object-cover" /><div className="flex items-center justify-between gap-2 p-3"><span className="truncate text-xs font-bold">{item.name}</span><button type="button" onClick={() => remove(item)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Padam"><Trash2 className="h-4 w-4" /></button></div></article>)}</div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-3 font-bold text-slate-900">Babak Terbina Dalam</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{scenes.map((scene) => <div key={scene.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><div className="flex items-center gap-2 text-xs font-bold text-indigo-900"><ImageIcon className="h-4 w-4" />{scene.name}</div><p className="mt-1 text-[11px] leading-relaxed text-slate-600">{scene.directive}</p></div>)}</div></section>
  </div>;
}
