'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { downloadPrivateMp4 } from '@/lib/download/client-download';

type Video = { id: string; styleId: string; provider: string; durationSeconds: number; durationVerified: boolean; qualityState?: string | null; createdAt: string; imageAssetId?: string; batchId?: string; creatorProfileId?: string; productFolderId?: string; streamUrl: string; downloadUrl: string };
type RewardState = { downloadCount: number; eligible: boolean; claimed: boolean; credits: number };
const qualityCategories = [
  ['cta_cutoff','CTA terpotong'],['dialogue_cutoff','Dialog tak habis'],['robotic_voice','Suara terlalu robotik'],
  ['lip_sync','Lip-sync tak natural'],['visual_motion','Wajah atau pergerakan nampak janggal'],
  ['product_identity','Produk berubah daripada gambar asal'],['niqab_exposure','Niqab berubah atau terbuka'],
  ['audio_broken','Audio hilang atau rosak'],['other','Masalah lain'],
] as const;

export default function LibraryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [reward, setReward] = useState<RewardState | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');
  const [rewardSubmitting, setRewardSubmitting] = useState(false);
  const [reportVideoId, setReportVideoId] = useState('');
  const [reportCategory, setReportCategory] = useState<string>('cta_cutoff');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState('');

  async function submitVideoReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setReportSubmitting(true); setReportMessage('');
    try {
      const response = await fetch('/api/videos/report', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: reportVideoId, category: reportCategory, description: reportDescription }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Laporan tidak dapat dihantar.');
      setReportMessage(result.message); setReportVideoId(''); setReportDescription('');
    } catch (reason) { setReportMessage(reason instanceof Error ? reason.message : 'Laporan tidak dapat dihantar.'); }
    finally { setReportSubmitting(false); }
  }

  async function loadReward() {
    const response = await fetch('/api/review-reward', { cache: 'no-store' });
    if (response.ok) setReward(await response.json());
  }

  async function downloadVideo(video: Video) {
    setDownloadingId(video.id);
    setError('');
    try {
      await downloadPrivateMp4(video.downloadUrl, `affimatik-${video.styleId.toLowerCase()}-${video.id.slice(0, 8)}.mp4`);
      await fetch('/api/review-reward', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_download', videoId: video.id }) }).catch(() => null);
      await loadReward().catch(() => null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video tidak dapat dimuat turun.');
    } finally {
      setDownloadingId('');
    }
  }

  useEffect(() => { setBatchId(new URLSearchParams(window.location.search).get('batchId') || ''); }, []);
  useEffect(() => { void loadReward().catch(() => null); }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/videos?page=${page}${batchId ? `&batchId=${encodeURIComponent(batchId)}` : ''}`, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Pustaka video tidak dapat dimuatkan.');
      const data = await response.json();
      setVideos(data.videos || []);
      setHasMore(Boolean(data.hasMore));
      setError('');
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [page,batchId]);

  const filtered = videos.filter((video) => `${video.styleId} ${video.provider}`.toLowerCase().includes(query.toLowerCase()));
  async function claimReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setRewardSubmitting(true); setRewardMessage('');
    try {
      const response = await fetch('/api/review-reward', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', reviewText, publishedUrl, marketingConsent }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ganjaran tidak dapat diproses.');
      setRewardMessage(data.message); await loadReward();
    } catch (err) { setRewardMessage(err instanceof Error ? err.message : 'Ganjaran tidak dapat diproses.'); }
    finally { setRewardSubmitting(false); }
  }
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold">Video Library</h1><p className="text-sm text-slate-600">MP4 yang disalin ke storan peribadi AffiMatik dan boleh ditonton semula merentas peranti.</p>{batchId&&<p className="mt-2 text-xs font-bold text-indigo-700">Ditapis mengikut Cloud Batch · <button onClick={()=>setBatchId('')} className="underline">Tunjuk semua</button></p>}</div>
    {reward?.eligible && <form onSubmit={claimReward} className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wider text-violet-700">Hadiah pengguna awal</p>
      <h2 className="mt-2 text-xl font-black">Kongsi ulasan, dapat +30 kredit</h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">Anda dah muat turun sekurang-kurangnya dua video. Tulis ulasan jujur sekurang-kurangnya dua baris atau beri link video TikTok/Shopee untuk menerima 30 kredit sekali sahaja—bersamaan tiga video bonus.</p>
      <div className="mt-4 grid gap-3"><textarea value={reviewText} onChange={(event)=>setReviewText(event.target.value)} rows={3} maxLength={2000} placeholder="Contoh: Prosesnya mudah dan saya boleh hasilkan video tanpa rakam muka..." className="rounded-xl border bg-white px-4 py-3 text-sm" aria-label="Ulasan AffiMatik" />
      <input value={publishedUrl} onChange={(event)=>setPublishedUrl(event.target.value)} type="url" inputMode="url" placeholder="Link TikTok/Shopee (pilihan jika anda tulis ulasan)" className="rounded-xl border bg-white px-4 py-3 text-sm" aria-label="Link video TikTok atau Shopee" />
      <label className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={marketingConsent} onChange={(event)=>setMarketingConsent(event.target.checked)} className="mt-1" />Saya benarkan AffiMatik menggunakan ulasan atau link ini sebagai contoh pemasaran tanpa mendedahkan alamat emel saya.</label></div>
      <button disabled={rewardSubmitting || !marketingConsent || (reviewText.trim().length < 40 && !publishedUrl.trim())} className="mt-4 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{rewardSubmitting?'Memproses…':'Hantar & Terima +30 Kredit'}</button>
      {rewardMessage&&<p role="status" className="mt-3 text-sm font-semibold text-violet-800">{rewardMessage}</p>}
    </form>}
    {reward?.claimed && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Terima kasih atas ulasan anda. Ganjaran +30 kredit sekali sahaja telah direkodkan.</div>}
    <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Cari video" placeholder="Cari gaya atau enjin" className="w-full rounded-lg border bg-white px-4 py-3 text-sm" />
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p className="text-sm">Memuatkan video…</p>}
    {!loading && !videos.length && !error && <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">Belum ada MP4 yang disimpan kekal. <Link href="/queue" className="underline text-indigo-700">Semak sejarah tugasan</Link>.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map((video) => <article key={video.id} className="rounded-xl border bg-white overflow-hidden">
      <video controls preload="metadata" playsInline src={video.streamUrl} className="w-full aspect-video bg-black" />
      <div className="p-4 space-y-3"><div><h2 className="font-semibold">{video.styleId} · {video.provider}</h2><p className="text-xs text-slate-500">{new Date(video.createdAt).toLocaleString('ms-MY')} · {video.durationVerified ? 'Tempoh disahkan' : 'Tempoh sasaran'} {Number(video.durationSeconds).toFixed(1)}s{video.batchId?' · Cloud Batch':''}</p>{video.qualityState==='QUALITY_UNCERTAIN'&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Video sudah siap. Sila semak hasil sebelum digunakan. Jika ada masalah audio atau visual, anda boleh laporkannya.</p>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={downloadingId===video.id} onClick={()=>void downloadVideo(video)} className="rounded-lg bg-indigo-600 px-4 py-3 text-white text-sm disabled:opacity-60">{downloadingId===video.id?'Menyediakan MP4…':'Muat Turun MP4'}</button><a href={video.streamUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-3 text-sm">Buka untuk Share/Files</a>{video.imageAssetId && <Link href={`/factory?imageAssetId=${encodeURIComponent(video.imageAssetId)}&styleId=${encodeURIComponent(video.styleId)}`} className="rounded-lg border px-4 py-3 text-sm">Guna Semula</Link>}{video.batchId&&<button onClick={()=>setBatchId(video.batchId||'')} className="rounded-lg border px-4 py-3 text-sm">Batch ini</button>}<button type="button" onClick={()=>{setReportVideoId(video.id);setReportMessage('');}} className="rounded-lg border border-rose-200 px-4 py-3 text-sm text-rose-800">Laporkan Masalah Video</button></div><p className="text-xs text-slate-500">Pada iPhone, jika muat turun tidak muncul, buka video lalu pilih Share → Save to Files.</p></div>
    </article>)}</div>
    {reportVideoId && <div role="dialog" aria-modal="true" aria-label="Laporkan Masalah Video" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 sm:items-center"><form onSubmit={submitVideoReport} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Laporkan Masalah Video</h2><button type="button" onClick={()=>setReportVideoId('')} className="rounded-lg border px-3 py-2" aria-label="Tutup laporan">Tutup</button></div><p className="text-sm text-slate-600">Laporan ini akan disemak. Tiada kredit diberi secara automatik.</p><label className="block text-sm font-semibold">Jenis masalah<select value={reportCategory} onChange={event=>setReportCategory(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-3">{qualityCategories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-semibold">Butiran (pilihan)<textarea value={reportDescription} onChange={event=>setReportDescription(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border px-3 py-3" placeholder="Contoh: CTA terhenti pada saat akhir video" /></label><button disabled={reportSubmitting} className="w-full rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{reportSubmitting?'Menghantar…':'Hantar Laporan'}</button></form></div>}
    {reportMessage&&<p role="status" className="rounded-lg border bg-white p-3 text-sm">{reportMessage}</p>}
    <div className="flex justify-between"><button disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="rounded border px-4 py-2 disabled:opacity-50">Sebelum</button><span className="text-sm text-slate-500">Halaman {page + 1}</span><button disabled={!hasMore} onClick={() => setPage((value) => value + 1)} className="rounded border px-4 py-2 disabled:opacity-50">Seterusnya</button></div>
  </div>;
}
