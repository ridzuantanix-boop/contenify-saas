'use client';

import { useEffect, useState } from 'react';

type Candidate = { id: string; provider: string };
type Result = { id: string; recovered: boolean; reason?: string };

export default function RecoveryPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch('/api/admin/recover-videos', { cache: 'no-store' });
    if (!response.ok) throw new Error('Senarai pemulihan tidak tersedia.');
    setCandidates((await response.json()).candidates);
  }
  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);
  async function recover() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/recover-videos?limit=1', { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).error || 'Pemulihan gagal.');
      const data = await response.json() as { results: Result[] };
      setResults((current) => [...data.results, ...current]);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Pemulihan gagal.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5 max-w-3xl"><h1 className="text-2xl font-bold">Pemulihan MP4 lama</h1><p className="text-sm text-slate-600">Import satu tugasan setiap kali. Tidak menjana semula video atau menolak kredit pelanggan. URL pembekal yang telah luput akan dilaporkan.</p>{error && <p role="alert" className="text-red-700">{error}</p>}<p className="text-sm">Calon seterusnya: {candidates.length ? candidates.map((item) => `${item.id} (${item.provider})`).join(', ') : 'Tiada'}</p><button disabled={busy || !candidates.length} onClick={recover} className="rounded bg-indigo-600 px-4 py-3 text-white disabled:opacity-50">{busy ? 'Mengimport…' : 'Import satu MP4'}</button>{results.length > 0 && <ul className="space-y-2 text-sm">{results.map((item, index) => <li key={`${item.id}-${index}`} className="rounded border bg-white p-3">{item.id} · {item.recovered ? 'Berjaya' : item.reason || 'Gagal'}</li>)}</ul>}</div>;
}
