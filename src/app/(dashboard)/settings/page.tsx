'use client';

import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [profile, setProfile] = useState<{ email: string; fullName: string; tier: string } | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/auth/profile', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Profil tidak tersedia.');
      const user = (await response.json()).user;
      setProfile(user); setName(user.fullName || '');
    }).catch((err) => setError(err.message));
  }, []);
  async function update(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: name }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Profil tidak dapat disimpan.');
      setProfile((current) => current ? { ...current, fullName: name } : current);
      setMessage('Profil berjaya disimpan. Nama di navigasi akan dikemas kini selepas log masuk semula.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  }
  async function requestDeletion() {
    if (window.prompt('Taip DELETE untuk merekod permohonan pemadaman akaun:') !== 'DELETE') return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request_deletion', deleteConfirmation: 'DELETE' }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Permohonan gagal.');
      setMessage((await response.json()).message);
    } catch (err) { setError(err instanceof Error ? err.message : 'Permohonan gagal.'); }
    finally { setBusy(false); }
  }
  return <div className="max-w-xl space-y-5"><h1 className="text-2xl font-bold">Tetapan Akaun</h1>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}{!profile ? <p>Memuatkan profil…</p> : <><form onSubmit={update} className="rounded-xl border bg-white p-5 space-y-3"><p className="text-sm">Emel: {profile.email}</p><p className="text-sm">Pelan: {profile.tier}</p><label className="block text-sm">Nama paparan<input required minLength={2} maxLength={255} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border p-2" /></label><button disabled={busy} className="rounded bg-indigo-600 text-white px-4 py-3 disabled:opacity-50">Simpan</button></form><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Privasi akaun</h2><p className="text-sm text-slate-600 my-2">Anda boleh merekod permohonan pemadaman untuk semakan pentadbir. Tiada data dipadam secara automatik.</p><button disabled={busy} type="button" onClick={requestDeletion} className="text-sm text-red-700">Mohon pemadaman akaun</button></div></>}</div>;
}
