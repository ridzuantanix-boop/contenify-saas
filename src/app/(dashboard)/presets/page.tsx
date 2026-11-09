'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Pencil, Play, Star, Trash2 } from 'lucide-react';

type Preset = { id: string; name: string; isDefault: boolean; settings: { styleId: string; niche: string; voicePersonality: string; storyboard: string; avatarId: string | null; backgroundId: string | null } };

export default function PresetLibraryPage() {
  const [presets, setPresets] = useState<Preset[]>([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch('/api/creator-presets', { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setPresets(data.presets || []); }, []);
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);
  async function mutate(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, query = '') { setBusy(true); setMessage(''); try { const response = await fetch(`/api/creator-presets${query}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); return true; } catch (error) { setMessage(error instanceof Error ? error.message : 'Tindakan gagal.'); return false; } finally { setBusy(false); } }
  async function rename(item: Preset) { const name = window.prompt('Nama baharu:', item.name)?.trim(); if (name && await mutate('PATCH', { id: item.id, name })) setMessage('Nama preset dikemas kini.'); }
  async function duplicate(item: Preset) { const name = window.prompt('Nama salinan:', `${item.name} Copy`)?.trim(); if (name && await mutate('POST', { name, duplicateFrom: item.id })) setMessage('Preset diduplikasi.'); }
  async function remove(item: Preset) { if (window.confirm(`Padam preset “${item.name}”?`) && await mutate('DELETE', undefined, `?id=${encodeURIComponent(item.id)}`)) setMessage('Preset dipadam.'); }
  async function makeDefault(item: Preset) { if (await mutate('PATCH', { id: item.id, isDefault: true })) setMessage('Preset default ditetapkan.'); }
  return <div className="mx-auto max-w-5xl space-y-6"><div><h1 className="text-2xl font-extrabold text-slate-900">Preset Library</h1><p className="mt-1 text-sm text-slate-500">Gunakan semula avatar, latar, gaya dan arahan dengan produk berbeza.</p></div>{message && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">{message}</div>}
    {presets.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="text-sm text-slate-500">Belum ada preset. Buka Customize dalam Creator Studio untuk menyimpan yang pertama.</p><Link href="/factory" className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">Buka Creator Studio</Link></div> : <div className="grid gap-4 sm:grid-cols-2">{presets.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold text-slate-900">{item.name}</h2><p className="mt-1 text-[11px] text-slate-500">{item.settings.styleId} · {item.settings.niche} · {item.settings.storyboard}</p></div>{item.isDefault && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Default</span>}</div><div className="mt-4 grid grid-cols-5 gap-1">
          <Link href={`/factory?presetId=${encodeURIComponent(item.id)}`} title="Jana Lagi Dengan Setup Ini" aria-label="Jana Lagi Dengan Setup Ini" className="flex justify-center rounded-lg bg-indigo-600 p-2 text-white"><Play className="h-4 w-4" /></Link>
          <button disabled={busy} onClick={() => rename(item)} title="Edit nama" className="flex justify-center rounded-lg bg-slate-100 p-2"><Pencil className="h-4 w-4" /></button>
          <button disabled={busy} onClick={() => duplicate(item)} title="Duplikasi" className="flex justify-center rounded-lg bg-slate-100 p-2"><Copy className="h-4 w-4" /></button>
          <button disabled={busy || item.isDefault} onClick={() => makeDefault(item)} title="Jadikan default" className="flex justify-center rounded-lg bg-slate-100 p-2 disabled:opacity-40"><Star className="h-4 w-4" /></button>
          <button disabled={busy} onClick={() => remove(item)} title="Padam" className="flex justify-center rounded-lg bg-rose-50 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
        </div></article>)}</div>}
  </div>;
}
