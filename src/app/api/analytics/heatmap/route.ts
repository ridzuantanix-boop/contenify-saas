import { NextRequest, NextResponse } from 'next/server';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const thresholds = new Set([25, 50, 75, 90, 100]);
const targetTypes = new Set(['link', 'button', 'video', 'other']);

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const expected = new URL(req.url).origin;
  try {
    return origin === expected && !!referer && new URL(referer).origin === expected && new URL(referer).pathname === '/';
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origin tidak sah.' }, { status: 403 });
  if (Number(req.headers.get('content-length') || 0) > 1600) return NextResponse.json({ error: 'Data terlalu besar.' }, { status: 413 });
  const raw = await req.text().catch(() => '');
  if (raw.length > 1600) return NextResponse.json({ error: 'Data terlalu besar.' }, { status: 413 });
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { /* Invalid JSON is rejected below. */ }
  if (!body || body.consent !== true || typeof body.sessionId !== 'string' || !uuid.test(body.sessionId))
    return NextResponse.json({ error: 'Data tidak sah.' }, { status: 400 });
  const seq = body.seq;
  const kind = body.kind;
  const device = body.device;
  if (!Number.isInteger(seq) || Number(seq) < 1 || Number(seq) > 40 || !['click', 'scroll'].includes(String(kind)) || !['mobile', 'desktop'].includes(String(device)))
    return NextResponse.json({ error: 'Data tidak sah.' }, { status: 400 });

  const point = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  const event: Record<string, unknown> = { session_id: body.sessionId, event_seq: seq, kind, device };
  if (kind === 'click') {
    if (!point(body.x) || !point(body.y) || !targetTypes.has(String(body.targetType)))
      return NextResponse.json({ error: 'Koordinat tidak sah.' }, { status: 400 });
    event.x_pct = body.x;
    event.y_pct = body.y;
    event.target_type = body.targetType;
  } else {
    if (!thresholds.has(Number(body.depth))) return NextResponse.json({ error: 'Scroll tidak sah.' }, { status: 400 });
    event.scroll_pct = body.depth;
  }
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return NextResponse.json({ recorded: false }, { status: 503 });
  const response = await fetch(`${base}/rest/v1/salespage_heatmap_events?on_conflict=session_id,event_seq`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(event),
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) return NextResponse.json({ recorded: false }, { status: 503 });
  return NextResponse.json({ recorded: true }, { status: 201 });
}
