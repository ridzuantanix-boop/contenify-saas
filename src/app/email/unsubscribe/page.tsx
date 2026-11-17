'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function UnsubscribeForm() {
  const token = useSearchParams().get('token') || '';
  const [state,setState] = useState<'idle'|'busy'|'done'|'error'>('idle');
  const [message,setMessage] = useState('');
  async function unsubscribe(){setState('busy');const response=await fetch('/api/email/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const body=await response.json().catch(()=>({}));setMessage(body.message||body.error||'Permintaan tidak dapat diproses.');setState(response.ok?'done':'error');}
  return <main className="min-h-screen bg-slate-50 px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl border bg-white p-8 shadow-sm"><p className="font-black text-violet-700">AffiMatik by Pawarna</p><h1 className="mt-4 text-2xl font-black">Berhenti menerima e-mel pemasaran</h1><p className="mt-3 text-sm leading-6 text-slate-600">E-mel akaun, keselamatan, pembayaran dan notifikasi perkhidmatan penting tidak terjejas.</p>{state==='done'?<p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p>:<><button type="button" disabled={state==='busy'||!token} onClick={unsubscribe} className="mt-6 min-h-12 rounded-xl bg-slate-900 px-5 font-bold text-white disabled:opacity-50">{state==='busy'?'Memproses…':'Sahkan berhenti langgan'}</button>{state==='error'&&<p className="mt-4 text-sm text-red-700">{message}</p>}</>}</section></main>;
}

export default function UnsubscribePage(){return <Suspense fallback={<main className="min-h-screen bg-slate-50"/>}><UnsubscribeForm/></Suspense>}
