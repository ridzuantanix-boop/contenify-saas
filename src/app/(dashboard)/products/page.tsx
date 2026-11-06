'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Asset = { id: string; productId: string; name: string; category: string; notes: string; filename: string; createdAt: string; imageUrl: string };

export default function ProductsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', category: '', notes: '' });

  useEffect(() => {
    fetch('/api/products', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Pustaka produk tidak dapat dimuatkan.');
      setAssets((await response.json()).assets || []);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const filtered = assets.filter((asset) => `${asset.name} ${asset.category} ${asset.notes}`.toLowerCase().includes(query.toLowerCase()));
  async function save(productId: string) {
    try {
      const response = await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, ...draft }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Kemas kini gagal.');
      setAssets((current) => current.map((asset) => asset.productId === productId ? { ...asset, ...draft } : asset));
      setEditing(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Kemas kini gagal.'); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl font-bold">Product Library</h1><p className="text-sm text-slate-600">Imej asal yang tersimpan dalam storan peribadi akaun anda.</p></div><Link href="/factory" className="rounded-lg bg-indigo-600 px-4 py-3 text-white text-sm">Muat Naik di Factory</Link></div>
    <input aria-label="Cari produk" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, kategori atau nota" className="w-full rounded-lg border bg-white px-4 py-3 text-sm" />
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p className="text-sm">Memuatkan produk…</p>}
    {!loading && !assets.length && !error && <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">Belum ada produk tersimpan. Muat naik imej di Video Factory.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((asset) => <article key={asset.id} className="rounded-xl border bg-white overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.imageUrl} alt={asset.name} className="h-48 w-full object-contain bg-slate-50" />
      <div className="p-4 space-y-2">{editing === asset.productId ? <div className="space-y-2"><input aria-label="Nama produk" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full border rounded p-2 text-sm" /><input aria-label="Kategori produk" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="w-full border rounded p-2 text-sm" /><textarea aria-label="Nota produk" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="w-full border rounded p-2 text-sm" /><button onClick={() => save(asset.productId)} className="text-indigo-700 text-sm">Simpan</button><button onClick={() => setEditing(null)} className="ml-3 text-sm">Batal</button></div> : <><h2 className="font-semibold break-words">{asset.name}</h2><p className="text-xs text-slate-500">{asset.category || 'Tiada kategori'} · {new Date(asset.createdAt).toLocaleDateString('ms-MY')}</p><p className="text-xs text-slate-500 truncate">Fail asal: {asset.filename}</p><button type="button" onClick={() => { setEditing(asset.productId); setDraft({ name: asset.name, category: asset.category, notes: asset.notes }); }} className="text-sm text-indigo-700">Ubah butiran</button></>}<div><Link href={`/factory?imageAssetId=${encodeURIComponent(asset.id)}`} className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Guna Untuk Video</Link></div></div>
    </article>)}</div>
  </div>;
}
