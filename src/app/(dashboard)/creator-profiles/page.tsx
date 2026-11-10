'use client';

import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';

type Settings={avatarId:string;backgroundId:string;niche:string;voicePersonality:string;callToAction:string;scriptMode:string;scriptVariant:string;storyboard:string;audioTreatment:string;styleId:string;creativeInstruction:string};
type Profile={id:string;name:string;version:number;is_default:boolean;settings:Settings};
type Asset={id:string;name:string};
const blank:Settings={avatarId:'',backgroundId:'',niche:'auto',voicePersonality:'friendly',callToAction:'none',scriptMode:'smart',scriptVariant:'style',storyboard:'auto',audioTreatment:'voiceover',styleId:'NX01',creativeInstruction:''};

export default function CreatorProfilesPage(){
 const[profiles,setProfiles]=useState<Profile[]>([]),[avatars,setAvatars]=useState<Asset[]>([]),[backgrounds,setBackgrounds]=useState<Asset[]>([]),[name,setName]=useState(''),[settings,setSettings]=useState<Settings>(blank),[editing,setEditing]=useState<Profile|null>(null),[message,setMessage]=useState('');
 const load=useCallback(async()=>{const[p,a,b]=await Promise.all([fetch('/api/creator-profiles').then(r=>r.json()),fetch('/api/avatars').then(r=>r.json()),fetch('/api/backgrounds').then(r=>r.json())]);setProfiles(p.profiles||[]);setAvatars([...(a.officialAvatars||[]),...(a.avatars||[])]);setBackgrounds([...(b.officialBackgrounds||[]),...(b.backgrounds||[])]);},[]);
 useEffect(()=>{void load()},[load]);
 const set=(key:keyof Settings,value:string)=>setSettings(current=>({...current,[key]:value}));
 async function save(){const method=editing?'PATCH':'POST',body=editing?{id:editing.id,name,settings,version:editing.version}:{name,settings,isDefault:!profiles.length};const response=await fetch('/api/creator-profiles',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();setMessage(response.ok?'Creator Profile disimpan.':result.error||'Profile gagal disimpan.');if(response.ok){setEditing(null);setName('');setSettings(blank);await load()}}
 function edit(profile:Profile){setEditing(profile);setName(profile.name);setSettings({...blank,...profile.settings});window.scrollTo({top:0,behavior:'smooth'})}
 async function action(id:string,type:'duplicate'|'default'|'delete'){if(type==='delete')await fetch(`/api/creator-profiles?id=${id}`,{method:'DELETE'});else if(type==='duplicate'){const source=profiles.find(p=>p.id===id);await fetch('/api/creator-profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`${source?.name||'Profile'} Copy`,duplicateFrom:id})})}else await fetch('/api/creator-profiles',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,isDefault:true})});await load()}
 return <div className="mx-auto max-w-5xl space-y-6 pb-16">
  <header><Link href="/auto-factory" className="text-xs font-bold text-indigo-700">← Auto Factory</Link><h1 className="mt-2 text-2xl font-black">Creator Profile Library</h1><p className="text-sm text-slate-500">Simpan identiti kreatif sekali. Fakta dan skrip khusus produk tidak disimpan dalam profile.</p></header>
  <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
   <input value={name} onChange={event=>setName(event.target.value)} placeholder="Nama profile" className="rounded-xl border p-3"/>
   <select value={settings.avatarId} onChange={event=>set('avatarId',event.target.value)} className="rounded-xl border p-3"><option value="">Avatar Auto / Tiada</option>{avatars.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
   <select value={settings.backgroundId} onChange={event=>set('backgroundId',event.target.value)} className="rounded-xl border p-3"><option value="">Latar Auto / Tiada</option>{backgrounds.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
   <input value={settings.niche} onChange={event=>set('niche',event.target.value)} placeholder="Niche (rumah, kecantikan...)" className="rounded-xl border p-3"/>
   <select value={settings.voicePersonality} onChange={event=>set('voicePersonality',event.target.value)} className="rounded-xl border p-3"><option value="friendly">Mesra</option><option value="calm">Tenang</option><option value="energetic">Bertenaga</option><option value="confident">Yakin</option><option value="auto">Ikut gaya</option></select>
   <select value={settings.callToAction} onChange={event=>set('callToAction',event.target.value)} className="rounded-xl border p-3"><option value="none">Tanpa CTA</option><option value="yellow_bag">TikTok Shop Beg Kuning</option><option value="click_button">Klik Butang</option><option value="learn_more">Ketahui Lebih Lanjut</option></select>
   <select value={settings.scriptMode} onChange={event=>set('scriptMode',event.target.value)} className="rounded-xl border p-3"><option value="smart">Smart Script</option><option value="provider_auto">Provider Auto</option></select>
   <select value={settings.scriptVariant} onChange={event=>set('scriptVariant',event.target.value)} className="rounded-xl border p-3"><option value="style">Ikut gaya</option><option value="short">Pendek</option><option value="story">Story</option></select>
   <select value={settings.storyboard} onChange={event=>set('storyboard',event.target.value)} className="rounded-xl border p-3"><option value="auto">Storyboard Auto</option><option value="problem_solution">Masalah → Penyelesaian</option><option value="demo">Demo</option><option value="review">Review</option></select>
   <select value={settings.audioTreatment} onChange={event=>set('audioTreatment',event.target.value)} className="rounded-xl border p-3"><option value="voiceover">Voice</option><option value="ambient">Ambient</option><option value="asmr">ASMR</option></select>
   <input value={settings.styleId} onChange={event=>set('styleId',event.target.value)} placeholder="Gaya default (NX01)" className="rounded-xl border p-3"/>
   <textarea value={settings.creativeInstruction} onChange={event=>set('creativeInstruction',event.target.value)} placeholder="Arahan kreatif umum" className="min-h-24 rounded-xl border p-3 sm:col-span-2 lg:col-span-3"/>
   <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><button disabled={!name.trim()} onClick={()=>void save()} className="flex-1 rounded-xl bg-indigo-600 p-3 font-bold text-white disabled:opacity-40">{editing?'Simpan Perubahan':'Cipta Creator Profile'}</button>{editing&&<button onClick={()=>{setEditing(null);setName('');setSettings(blank)}} className="rounded-xl border px-5 font-bold">Batal</button>}</div>
  </section>
  {message&&<p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm">{message}</p>}
  <section className="grid gap-3 sm:grid-cols-2">{profiles.map(profile=><article key={profile.id} className="rounded-xl border bg-white p-4"><div className="flex justify-between"><strong>{profile.name}</strong>{profile.is_default&&<span className="text-xs font-bold text-emerald-700">Default</span>}</div><p className="mt-1 text-xs text-slate-500">Versi {profile.version} · {profile.settings?.voicePersonality||'auto'} · {profile.settings?.callToAction||'none'}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold"><button onClick={()=>edit(profile)}>Edit</button><button onClick={()=>void action(profile.id,'duplicate')}>Duplicate</button><button onClick={()=>void action(profile.id,'default')}>Set Default</button><button className="text-rose-700" onClick={()=>void action(profile.id,'delete')}>Delete</button></div></article>)}</section>
 </div>
}
