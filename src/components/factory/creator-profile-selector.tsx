'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { CheckCircle2, Edit3, Plus, Sparkles, Upload, UserRound } from 'lucide-react';
import { useState } from 'react';

export type CreatorAsset = { id: string; name: string; imageUrl: string; thumbnailUrl?: string; official?: boolean };
export type FactoryCreatorProfile = {
  id: string;
  name: string;
  version: number;
  is_default: boolean;
  settings: {
    avatarId?: string | null;
    backgroundId?: string | null;
    voicePersonality?: string;
    styleId?: string;
    niche?: string;
    creativeInstruction?: string;
  };
};

type Props = {
  profiles: FactoryCreatorProfile[];
  selectedProfileId: string;
  avatars: CreatorAsset[];
  backgrounds: CreatorAsset[];
  avatarId: string;
  backgroundId: string;
  voicePersonality: string;
  busy: boolean;
  compatibilityError?: string;
  onSelectProfile: (profile: FactoryCreatorProfile | null) => void;
  onAvatarChange: (id: string) => void;
  onBackgroundChange: (id: string) => void;
  onVoiceChange: (value: string) => void;
  onAvatarUpload: (file?: File) => void;
  onBackgroundUpload: (file?: File) => void;
  onSaveProfile: (name: string) => Promise<void>;
};

const imageFor = (items: CreatorAsset[], id?: string | null) => items.find((item) => item.id === id);

export function CreatorProfileSelector(props: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState('');
  const selected = props.profiles.find((profile) => profile.id === props.selectedProfileId);

  async function save() {
    if (!name.trim()) return;
    try {
      await props.onSaveProfile(name.trim());
      setName('');
      setComposerOpen(false);
    } catch {
      // Parent displays the actionable server error without discarding inputs.
    }
  }

  return <section id="creator-step" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="creator-profile-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">3</span><h3 id="creator-profile-heading" className="text-sm font-black text-slate-900">Pilih Creator & Background</h3></div><p className="mt-1 text-[11px] text-slate-500">Guna profile tersimpan, atau pilih avatar dan latar sendiri di sini.</p></div>
      <button type="button" onClick={() => setComposerOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-black text-indigo-700"><Plus className="h-4 w-4" /> Cipta Profile Baru</button>
    </div>

    <div className="mt-4 flex gap-2 overflow-x-auto pb-2" data-testid="creator-profile-cards">
      <button type="button" onClick={() => props.onSelectProfile(null)} className={`min-h-24 min-w-32 rounded-2xl border p-3 text-left text-xs ${!props.selectedProfileId ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200'}`}><Sparkles className="mb-2 h-5 w-5 text-indigo-600"/><strong className="block">Tanpa Profile</strong><span className="mt-1 block text-[10px] text-slate-500">Pilih sendiri atau biar automatik</span></button>
      {props.profiles.map((profile) => {
        const avatar = imageFor(props.avatars, profile.settings?.avatarId);
        const background = imageFor(props.backgrounds, profile.settings?.backgroundId);
        const active = profile.id === props.selectedProfileId;
        return <button type="button" key={profile.id} onClick={() => props.onSelectProfile(profile)} className={`relative min-h-24 min-w-48 rounded-2xl border p-3 text-left ${active ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2">{avatar ? <img src={avatar.thumbnailUrl || avatar.imageUrl} alt="" className="h-11 w-11 rounded-xl object-cover object-top"/> : <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100"><UserRound className="h-5 w-5 text-slate-400"/></div>}<div className="min-w-0"><strong className="block truncate text-xs text-slate-900">{profile.name}</strong><span className="block text-[10px] text-slate-500">{profile.settings?.voicePersonality || 'auto'}{profile.is_default ? ' · Default' : ''}</span></div></div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500"><span>{background ? `Latar: ${background.name}` : 'Latar automatik'}</span>{active && <CheckCircle2 className="ml-auto h-4 w-4 text-indigo-600"/>}</div>
        </button>;
      })}
    </div>

    {selected && <div role="status" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><strong>Creator Profile digunakan: {selected.name}</strong><Link href={`/creator-profiles?edit=${encodeURIComponent(selected.id)}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 font-bold"><Edit3 className="h-3.5 w-3.5"/> Edit Profile</Link></div>}
    {props.compatibilityError && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{props.compatibilityError}</div>}

    {composerOpen && <div className="mt-4 space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4" data-testid="inline-profile-composer">
      <div><h4 className="text-sm font-black text-slate-900">Cipta profile tanpa tinggalkan video ini</h4><p className="text-[11px] text-slate-500">Produk dan gaya yang telah dipilih tidak akan hilang.</p></div>
      <label className="block text-xs font-bold text-slate-700">Nama Profile<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Contoh: Creator Ridzuan" className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"/></label>
      <AssetGrid title="Avatar" items={props.avatars} selectedId={props.avatarId} emptyLabel="Tanpa Avatar" onChange={props.onAvatarChange} uploadLabel="Upload Avatar" onUpload={props.onAvatarUpload}/>
      <AssetGrid title="Background" items={props.backgrounds} selectedId={props.backgroundId} emptyLabel="Background Automatik" onChange={props.onBackgroundChange} uploadLabel="Upload Background" onUpload={props.onBackgroundUpload}/>
      <label className="block text-xs font-bold text-slate-700">Personaliti suara<select value={props.voicePersonality} onChange={(event) => props.onVoiceChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"><option value="auto">Ikut gaya video</option><option value="friendly">Mesra</option><option value="confident">Yakin</option><option value="calm">Tenang</option><option value="energetic">Bertenaga</option><option value="helpful">Membantu</option><option value="premium">Premium</option></select></label>
      <button type="button" disabled={props.busy || !name.trim() || Boolean(props.compatibilityError)} onClick={() => void save()} className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-black text-white disabled:opacity-50">Simpan & Gunakan Profile Ini</button>
    </div>}
  </section>;
}

function AssetGrid({title,items,selectedId,emptyLabel,onChange,uploadLabel,onUpload}:{title:string;items:CreatorAsset[];selectedId:string;emptyLabel:string;onChange:(id:string)=>void;uploadLabel:string;onUpload:(file?:File)=>void}) {
  return <div><div className="mb-2 text-xs font-black text-slate-700">{title}</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-5"><button type="button" onClick={() => onChange('')} className={`min-h-24 rounded-xl border p-2 text-[10px] font-bold ${!selectedId?'border-indigo-500 bg-indigo-50':'border-slate-200 bg-white'}`}><Sparkles className="mx-auto mb-2 h-5 w-5"/>{emptyLabel}</button>{items.map((item)=><button type="button" key={item.id} onClick={()=>onChange(item.id)} className={`rounded-xl border p-1.5 text-[10px] font-bold ${selectedId===item.id?'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100':'border-slate-200 bg-white'}`}><img src={item.thumbnailUrl||item.imageUrl} alt={item.name} className="aspect-[3/4] w-full rounded-lg object-cover object-top"/><span className="mt-1 block truncate">{item.name}</span></button>)}<label className="cursor-pointer rounded-xl border border-dashed border-slate-300 bg-white p-2 text-center text-[10px] font-bold text-slate-500"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event)=>{onUpload(event.target.files?.[0]);event.target.value=''}}/><span className="flex aspect-[3/4] items-center justify-center rounded-lg bg-slate-50"><Upload className="h-5 w-5"/></span><span className="mt-1 block">{uploadLabel}</span></label></div></div>;
}
