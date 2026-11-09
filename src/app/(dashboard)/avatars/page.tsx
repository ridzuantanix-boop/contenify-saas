'use client';

import { useEffect, useState } from 'react';

type Avatar = { id: string; name: string; description: string | null; gender: string; imageUrl: string; thumbnailUrl?: string; createdAt?: string; official?: boolean; ageGroup?: string; personality?: string };

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [officialAvatars, setOfficialAvatars] = useState<Avatar[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState('faceless');
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const response = await fetch('/api/avatars', { cache: 'no-store' });
    if (!response.ok) throw new Error('Pustaka avatar tidak dapat dibuka.');
    const data = await response.json(); setOfficialAvatars(data.officialAvatars || []); setAvatars(data.avatars || []);
    setLoaded(true);
  }
  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !consent) return;
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.set('image', file); body.set('name', name); body.set('description', description);
      body.set('gender', gender); body.set('consent', 'true');
      const response = await fetch('/api/avatars', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json()).error || 'Muat naik gagal.');
      setName(''); setDescription(''); setFile(null); setConsent(false);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Muat naik gagal.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm('Padam avatar ini daripada pustaka?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/avatars?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Padam gagal.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Padam gagal.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6 max-w-5xl">
    <div><h1 className="text-2xl font-bold">Pustaka Avatar</h1><p className="text-sm text-slate-600 mt-1">Simpan imej presenter dewasa dengan keizinan, kemudian pilih terus dalam Customize di Creator Studio. Keupayaan pengekalan identiti provider tetap dinilai pada setiap ujian sebenar.</p></div>
    {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    <section className="rounded-2xl border border-indigo-100 bg-white p-5"><div className="mb-4"><h2 className="font-bold text-slate-900">Koleksi AffiMatik</h2><p className="text-xs text-slate-500">12 presenter rekaan rasmi. Percuma digunakan dan read-only; pengekalan wajah kekal ciri Beta provider.</p></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{officialAvatars.map((avatar) => <article key={avatar.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatar.thumbnailUrl || avatar.imageUrl} alt={avatar.name} className="aspect-[3/4] w-full object-cover object-top" /><div className="p-3"><h3 className="truncate text-xs font-bold">{avatar.name}</h3><p className="mt-1 text-[10px] capitalize text-slate-500">{avatar.ageGroup} · {avatar.personality}</p></div></article>)}</div></section>
    <form onSubmit={upload} className="bg-white border rounded-xl p-5 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Nama avatar<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm">Jenis<select value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="faceless">Tanpa wajah</option><option value="female">Wanita</option><option value="male">Lelaki</option></select></label>
      <label className="text-sm sm:col-span-2">Penerangan (pilihan)<input maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm sm:col-span-2">Imej JPEG, PNG atau WebP (maksimum 10 MB)<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full" /></label>
      <label className="text-sm sm:col-span-2 flex gap-2"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Saya memiliki hak atau keizinan untuk menyimpan imej ini.</label>
      <button disabled={busy || !consent || !file} className="rounded-lg bg-indigo-600 text-white px-4 py-3 disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan Avatar'}</button>
    </form>
    <section><h2 className="mb-3 font-bold text-slate-900">Milik Saya</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{avatars.map((avatar) => <article key={avatar.id} className="border rounded-xl bg-white overflow-hidden"><div className="h-56 bg-slate-100" style={{ backgroundImage: `url(${avatar.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center top' }} role="img" aria-label={avatar.name} /><div className="p-4"><h2 className="font-semibold">{avatar.name}</h2><p className="text-sm text-slate-600">{avatar.description || avatar.gender}</p>{avatar.createdAt && <p className="text-xs text-slate-400 mt-1">{new Date(avatar.createdAt).toLocaleDateString('ms-MY')}</p>}<button disabled={busy} onClick={() => remove(avatar.id)} className="text-red-700 text-sm mt-3">Padam</button></div></article>)}</div></section>
    {loaded && avatars.length === 0 && <p className="text-sm text-slate-500">Belum ada avatar tersimpan.</p>}
  </div>;
}
