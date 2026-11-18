'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, Film, LoaderCircle, Play, Plus, RefreshCw, Sparkles } from 'lucide-react';

type Job = { id:string; styleId:string; styleName:string; status:string; createdAt:string; videoUrl?:string; nextRetryAt?:string; retryCount?:number };
const ACTIVE_STATUSES = ['QUEUED','SUBMITTING','PROCESSING','QA_PENDING'];

function formatDate(value:string) {
  return new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
}
function activeLabel(job:Job) {
  if(job.nextRetryAt)return 'Auto Retry Aktif';
  if(job.status==='QUEUED')return 'Dalam Giliran';
  if(job.status==='QA_PENDING')return 'Menyiapkan Video';
  return 'Sedang Menjana';
}

export default function QueuePage(){
  const[jobs,setJobs]=useState<Job[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
  async function refresh(silent=false){
    if(!silent)setRefreshing(true);
    try{const response=await fetch('/api/jobs?list=1',{cache:'no-store'});if(!response.ok)throw new Error('Senarai video tidak dapat dimuatkan.');setJobs((await response.json()).jobs||[]);setError('');}
    catch(err){setError(err instanceof Error?err.message:'Senarai video tidak tersedia.');}
    finally{setLoading(false);setRefreshing(false);}
  }
  useEffect(()=>{void refresh(true);const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh(true);},30000);return()=>window.clearInterval(timer);},[]);
  const activeJobs=jobs.filter(job=>ACTIVE_STATUSES.includes(job.status));
  const completedJobs=jobs.filter(job=>job.status==='COMPLETED');
  const recovering=activeJobs.filter(job=>Boolean(job.nextRetryAt)).length;

  return <main className="mx-auto w-full max-w-5xl space-y-7 pb-12">
    <header className="overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-white via-violet-50 to-indigo-50 p-5 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600"><Sparkles className="h-4 w-4"/>AffiMatik Studio</div><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Video Saya</h1><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Pantau video yang sedang dijana dan buka hasil yang telah siap.</p></div><button type="button" onClick={()=>void refresh()} disabled={refreshing} aria-label="Segarkan senarai video" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-violet-100 bg-white text-violet-700 shadow-sm transition hover:border-violet-300 disabled:opacity-60"><RefreshCw className={`h-5 w-5 ${refreshing?'animate-spin':''}`}/></button></div>
      <div className="mt-5 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-100"><LoaderCircle className="h-4 w-4 text-violet-600"/>{activeJobs.length} sedang diproses</span><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-100"><CheckCircle2 className="h-4 w-4 text-emerald-600"/>{completedJobs.length} video terkini siap</span></div>
    </header>

    {recovering>0&&<section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm"><p className="font-bold">{recovering} video sedang dicuba semula secara automatik</p><p className="mt-1 text-xs leading-5 text-amber-800">Tak perlu jana semula atau biarkan browser terbuka. Kredit kekal selamat dan sistem cloud akan teruskan proses.</p></section>}
    {error&&<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</div>}
    {loading?<div className="grid gap-3" aria-label="Memuatkan video">{[0,1,2].map(item=><div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100"/>)}</div>:<>
      <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Dalam Proses</p><h2 className="mt-1 text-lg font-black text-slate-950">Video sedang dijana</h2></div><Link href="/factory" className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-violet-200"><Plus className="h-4 w-4"/>Jana Video</Link></div>
        {!activeJobs.length?<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-7 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-6 w-6"/></div><p className="mt-3 font-bold text-slate-900">Tiada video sedang diproses</p><p className="mt-1 text-sm text-slate-500">Semua generation terkini telah selesai.</p></div>:activeJobs.map(job=><article key={job.id} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm"><LoaderCircle className="h-6 w-6 animate-spin"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-slate-950">{job.styleName}</h3><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700">{activeLabel(job)}</span></div><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5"/>{formatDate(job.createdAt)}</p>{job.nextRetryAt&&<p className="mt-2 text-xs font-medium text-amber-700">Sistem akan sambung secara automatik · Cubaan {job.retryCount||1}</p>}</div></div></article>)}
      </section>

      <section className="space-y-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Hasil Terkini</p><h2 className="mt-1 text-lg font-black text-slate-950">Video yang telah siap</h2></div>
        {!completedJobs.length?<div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">Belum ada video siap. <Link href="/factory" className="font-bold text-violet-700">Jana video pertama</Link>.</div>:<div className="grid gap-3 sm:grid-cols-2">{completedJobs.map(job=><article key={job.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex gap-4 p-4"><a href={job.videoUrl} target="_blank" rel="noreferrer" className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-violet-900">{job.videoUrl?<video src={job.videoUrl} muted playsInline preload="metadata" className="h-full w-full object-cover"/>:<Film className="absolute inset-0 m-auto h-7 w-7 text-white/70"/>}<span className="absolute inset-0 grid place-items-center bg-black/15"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-violet-700 shadow"><Play className="h-4 w-4 fill-current"/></span></span></a><div className="min-w-0 flex-1 py-0.5"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700"><CheckCircle2 className="h-3 w-3"/>Siap</span><h3 className="mt-2 line-clamp-2 font-black leading-5 text-slate-950">{job.styleName}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(job.createdAt)}</p></div></div><a href={job.videoUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black text-violet-700 transition group-hover:bg-violet-50"><Play className="h-4 w-4 fill-current"/>Tonton & Muat Turun</a></article>)}</div>}
        {completedJobs.length>0&&<Link href="/library" className="flex min-h-12 items-center justify-center rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-black text-violet-700">Buka Semua Video</Link>}
      </section>
    </>}
  </main>;
}
