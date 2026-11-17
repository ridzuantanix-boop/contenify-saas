import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';

type EventRow = { session_id: string; kind: 'click' | 'scroll'; x_pct: number | null; y_pct: number | null; scroll_pct: number | null; target_type: string | null };

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const days = req.nextUrl.searchParams.get('days') === '30' ? 30 : 7;
  const device = req.nextUrl.searchParams.get('device') === 'desktop' ? 'desktop' : 'mobile';
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return NextResponse.json({ error: 'Database tidak tersedia.' }, { status: 503 });
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows: EventRow[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const query = new URLSearchParams({ select: 'session_id,kind,x_pct,y_pct,scroll_pct,target_type', device: `eq.${device}`, occurred_at: `gte.${since}`, order: 'occurred_at.desc', limit: '1000', offset: String(offset) });
    const response = await fetch(`${base}/rest/v1/salespage_heatmap_events?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return NextResponse.json({ error: 'Data heatmap belum tersedia.' }, { status: 503 });
    const batch = await response.json() as EventRow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  const sessions = new Set(rows.map(row => row.session_id));
  const scroll = [25, 50, 75, 90, 100].map(depth => ({ depth, sessions: new Set(rows.filter(row => row.kind === 'scroll' && row.scroll_pct === depth).map(row => row.session_id)).size }));
  const bins = new Map<string, { x: number; y: number; count: number }>();
  const types: Record<string, number> = { link: 0, button: 0, video: 0, other: 0 };
  let clicks = 0;
  for (const row of rows) {
    if (row.kind !== 'click' || row.x_pct === null || row.y_pct === null) continue;
    clicks++;
    types[row.target_type || 'other'] = (types[row.target_type || 'other'] || 0) + 1;
    const x = Math.min(11, Math.floor(Number(row.x_pct) * 12));
    const y = Math.min(79, Math.floor(Number(row.y_pct) * 80));
    const key = `${x}:${y}`;
    const bin = bins.get(key) || { x, y, count: 0 };
    bin.count++;
    bins.set(key, bin);
  }
  return NextResponse.json({ days, device, sessions: sessions.size, clicks, scroll, types, bins: [...bins.values()], capped: rows.length === 5000, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
}
