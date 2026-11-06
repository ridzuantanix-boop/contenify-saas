'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Video = { id: string; styleId: string; provider: string; durationSeconds: number; createdAt: string; imageAssetId?: string; streamUrl: string; downloadUrl: string };

export default function LibraryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/videos?page=${page}`, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Pustaka video tidak dapat dimuatkan.');
      const data = await response.json();
      setVideos(data.videos || []);
      setHasMore(Boolean(data.hasMore));
      setError('');
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [page]);

  const filtered = videos.filter((video) => `${video.styleId} ${video.provider}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold">Video Library</h1><p className="text-sm text-slate-600">MP4 yang disalin ke storan peribadi AffiMatik dan boleh ditonton semula merentas peranti.</p></div>
    <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Cari video" placeholder="Cari gaya atau enjin" className="w-full rounded-lg border bg-white px-4 py-3 text-sm" />
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p className="text-sm">Memuatkan video…</p>}
    {!loading && !videos.length && !error && <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">Belum ada MP4 yang disimpan kekal. <Link href="/queue" className="underline text-indigo-700">Semak sejarah tugasan</Link>.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map((video) => <article key={video.id} className="rounded-xl border bg-white overflow-hidden">
      <video controls preload="metadata" playsInline src={video.streamUrl} className="w-full aspect-video bg-black" />
      <div className="p-4 space-y-3"><div><h2 className="font-semibold">{video.styleId} · {video.provider}</h2><p className="text-xs text-slate-500">{new Date(video.createdAt).toLocaleString('ms-MY')} · Sasaran {video.durationSeconds}s</p></div><div className="flex flex-wrap gap-2"><a href={video.downloadUrl} className="rounded-lg bg-indigo-600 px-4 py-3 text-white text-sm">Muat Turun MP4</a><a href={video.streamUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-3 text-sm">Buka untuk Share/Files</a>{video.imageAssetId && <Link href={`/factory?imageAssetId=${encodeURIComponent(video.imageAssetId)}&styleId=${encodeURIComponent(video.styleId)}`} className="rounded-lg border px-4 py-3 text-sm">Guna Semula</Link>}</div></div>
    </article>)}</div>
    <div className="flex justify-between"><button disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="rounded border px-4 py-2 disabled:opacity-50">Sebelum</button><span className="text-sm text-slate-500">Halaman {page + 1}</span><button disabled={!hasMore} onClick={() => setPage((value) => value + 1)} className="rounded border px-4 py-2 disabled:opacity-50">Seterusnya</button></div>
  </div>;
}
