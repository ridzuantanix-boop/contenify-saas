'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Permintaan gagal.');
      setMessage(result.message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Permintaan gagal.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-5">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Mail /></div>
      <div><h1 className="text-xl font-bold text-slate-900">Lupa kata laluan?</h1><p className="mt-1 text-xs leading-relaxed text-slate-500">Masukkan emel akaun. Kami akan menghantar pautan pemulihan yang selamat.</p></div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">{message}</p>}
      <form onSubmit={submit} className="space-y-3"><label className="block text-xs font-semibold text-slate-700">Alamat Emel<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs" /></label><button disabled={busy} className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Menghantar…' : 'Hantar Pautan Pemulihan'}</button></form>
      <Link href="/login" className="block text-center text-xs font-semibold text-indigo-600">Kembali ke Log Masuk</Link>
    </section>
  </main>;
}
