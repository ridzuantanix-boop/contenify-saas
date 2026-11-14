'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { trackConversion } from '@/lib/analytics/conversion';

type CallbackState = 'loading' | 'recovery' | 'expired' | 'error' | 'success';

function readableAuthError(code: string, description: string) {
  if (code === 'otp_expired' || /expired|invalid/i.test(description)) {
    return 'Pautan ini tidak sah, telah tamat tempoh atau sudah digunakan. Minta emel baharu dan gunakan pautan yang paling terkini sahaja.';
  }
  return description || 'Pengesahan tidak dapat diselesaikan. Minta emel baharu dan cuba lagi.';
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>('loading');
  const [message, setMessage] = useState('Sedang mengesahkan pautan selamat…');
  const [accessToken, setAccessToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const errorCode = params.get('error_code') || query.get('error_code') || '';
    const errorDescription = params.get('error_description') || query.get('error_description') || '';
    const token = params.get('access_token') || '';
    const type = params.get('type') || query.get('type') || '';
    if (errorCode || params.get('error') || query.get('error')) {
      setMessage(readableAuthError(errorCode, errorDescription));
      setState(errorCode === 'otp_expired' ? 'expired' : 'error');
      return;
    }
    if (!token) {
      setMessage('Pautan pengesahan tidak lengkap. Minta emel baharu dan buka pautan paling terkini.');
      setState('error');
      return;
    }
    setAccessToken(token);
    if (type === 'recovery') {
      setMessage('Identiti disahkan. Tetapkan kata laluan baharu anda.');
      setState('recovery');
      return;
    }
    void (async () => {
      try {
        const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supabaseAccessToken: token }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Sesi AffiMatik tidak dapat dicipta.');
        trackConversion('email_verified', 'signup-email', { source: 'auth_callback' });
        const launchIntent = query.get('intent') === 'launch_pack' || window.localStorage.getItem('affimatik_purchase_intent') === 'launch_pack';
        if (launchIntent) window.localStorage.setItem('affimatik_purchase_intent', 'launch_pack');
        setMessage(launchIntent ? 'Emel berjaya disahkan. Anda sedang dibawa ke Launch Pack.' : 'Emel berjaya disahkan. Anda sedang dibawa ke Dashboard.');
        setState('success');
        window.setTimeout(() => window.location.replace(launchIntent ? '/billing?intent=launch_pack' : '/dashboard'), 800);
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : 'Pengesahan tidak dapat diselesaikan.');
        setState('error');
      }
    })();
  }, []);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setMessage('Kata laluan mestilah sekurang-kurangnya 8 aksara.'); return; }
    if (password !== confirmPassword) { setMessage('Pengesahan kata laluan tidak sepadan.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Kata laluan tidak dapat dikemas kini.');
      setMessage(result.message);
      setState('success');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Kata laluan tidak dapat dikemas kini.'); setState('error'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-5 text-center">
      {state === 'loading' ? <Loader2 className="mx-auto h-11 w-11 animate-spin text-indigo-600" /> : state === 'success' ? <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600" /> : <AlertCircle className="mx-auto h-11 w-11 text-amber-600" />}
      <div><h1 className="text-xl font-bold text-slate-900">{state === 'recovery' ? 'Tetapkan Kata Laluan Baharu' : state === 'success' ? 'Berjaya' : state === 'loading' ? 'Mengesahkan Akaun' : 'Pautan Tidak Dapat Digunakan'}</h1><p role={state === 'error' || state === 'expired' ? 'alert' : 'status'} className="mt-2 text-xs leading-relaxed text-slate-600">{message}</p></div>
      {state === 'recovery' && <form onSubmit={updatePassword} className="space-y-3 text-left"><label className="block text-xs font-semibold text-slate-700">Kata Laluan Baharu<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs" /></label><label className="block text-xs font-semibold text-slate-700">Ulang Kata Laluan<input type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs" /></label><button disabled={busy} className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Mengemas kini…' : 'Simpan Kata Laluan Baharu'}</button></form>}
      {(state === 'expired' || state === 'error') && <div className="space-y-2"><Link href="/register" className="block w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white">Minta Emel Pengesahan Baharu</Link><Link href="/forgot-password" className="block text-xs font-semibold text-indigo-600">Atau pulihkan kata laluan</Link></div>}
      {state === 'success' && <Link href="/login" className="block text-xs font-semibold text-indigo-600">Pergi ke Log Masuk</Link>}
    </section>
  </main>;
}
