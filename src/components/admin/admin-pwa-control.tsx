'use client';

import { useEffect,useState } from 'react';
import { Download,Share2,Smartphone,Wifi,WifiOff,X } from 'lucide-react';

interface InstallPromptEvent extends Event { prompt():Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> }

export function AdminPwaControl(){
 const[prompt,setPrompt]=useState<InstallPromptEvent|null>(null),[installed,setInstalled]=useState(false),[online,setOnline]=useState(true),[showHelp,setShowHelp]=useState(false);
 useEffect(()=>{
  setOnline(navigator.onLine);
  setInstalled(window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>undefined);
  const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)};
  const connected=()=>setOnline(true),disconnected=()=>setOnline(false),appInstalled=()=>{setInstalled(true);setPrompt(null)};
  window.addEventListener('beforeinstallprompt',capture);window.addEventListener('online',connected);window.addEventListener('offline',disconnected);window.addEventListener('appinstalled',appInstalled);
  return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected);window.removeEventListener('appinstalled',appInstalled)};
 },[]);
 async function install(){if(prompt){await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted'){setInstalled(true);setPrompt(null)}return}setShowHelp(true)}
 return <>
  <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
   <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-indigo-600"/><div><strong>Admin & CRM Mobile</strong><p className="text-[10px] text-indigo-700">Data sensitif sentiasa dimuatkan terus dari pelayan.</p></div></div>
   <div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${online?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{online?<Wifi className="h-3 w-3"/>:<WifiOff className="h-3 w-3"/>}{online?'Online':'Offline'}</span>{!installed&&<button type="button" onClick={install} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white"><Download className="h-3.5 w-3.5"/>Pasang App</button>}{installed&&<span className="rounded-lg bg-white px-3 py-2 font-bold text-indigo-700">App Dipasang</span>}</div>
  </div>
  {showHelp&&<div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Cara pasang AffiMatik Admin"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-bold">Pasang Admin & CRM</h2><button onClick={()=>setShowHelp(false)} aria-label="Tutup" className="p-2"><X className="h-5 w-5"/></button></div><div className="mt-3 space-y-3 text-sm text-slate-700"><p className="flex gap-2"><Share2 className="h-5 w-5 shrink-0 text-indigo-600"/><span><strong>iPhone/iPad:</strong> tekan Share, kemudian pilih “Add to Home Screen”.</span></p><p className="flex gap-2"><Download className="h-5 w-5 shrink-0 text-indigo-600"/><span><strong>Android/Chrome:</strong> buka menu pelayar dan pilih “Install app” atau “Add to Home screen”.</span></p><p className="text-xs text-slate-500">Admin login tetap diperlukan. PWA tidak menyimpan respons API, data pelanggan, kewangan atau media secara offline.</p></div></div></div>}
 </>;
}
