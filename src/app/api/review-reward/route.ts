import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isEmailVerificationPending } from '@/lib/auth/session';

const serviceHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
});

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function validPublishedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return host === 'tiktok.com' || host.endsWith('.tiktok.com')
      || host === 'shopee.com.my' || host.endsWith('.shopee.com.my')
      || host === 'shopee.com' || host.endsWith('.shopee.com');
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  if (!configured()) return NextResponse.json({ error: 'Ganjaran ulasan tidak tersedia.' }, { status: 503 });
  const base = process.env.SUPABASE_URL!;
  const headers = serviceHeaders();
  try {
    const [downloadsResponse, claimResponse] = await Promise.all([
      fetch(`${base}/rest/v1/review_reward_downloads?workspace_id=eq.${session.workspaceId}&user_id=eq.${session.userId}&select=id`, { headers, cache: 'no-store' }),
      fetch(`${base}/rest/v1/review_reward_claims?workspace_id=eq.${session.workspaceId}&select=id,credits_granted,status,granted_at&limit=1`, { headers, cache: 'no-store' }),
    ]);
    if (!downloadsResponse.ok || !claimResponse.ok) throw new Error('query failed');
    const downloads = await downloadsResponse.json() as Array<{ id: string }>;
    const claims = await claimResponse.json() as Array<Record<string, unknown>>;
    return NextResponse.json({
      downloadCount: downloads.length,
      eligible: downloads.length >= 2 && claims.length === 0,
      claimed: claims.length > 0,
      claim: claims[0] || null,
      credits: 30,
    });
  } catch { return NextResponse.json({ error: 'Status ganjaran ulasan tidak dapat dimuatkan.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  if (isEmailVerificationPending(session)) {
    return NextResponse.json({ error: 'Sahkan emel sebelum menuntut ganjaran ulasan.' }, { status: 403 });
  }
  if (!configured()) return NextResponse.json({ error: 'Ganjaran ulasan tidak tersedia.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const action = body.action === 'record_download' ? 'record_download' : 'claim';
  const base = process.env.SUPABASE_URL!;
  const headers = serviceHeaders();

  if (action === 'record_download') {
    const videoId = typeof body.videoId === 'string' && /^[0-9a-f-]{36}$/i.test(body.videoId) ? body.videoId : '';
    if (!videoId) return NextResponse.json({ error: 'ID video tidak sah.' }, { status: 400 });
    try {
      const response = await fetch(`${base}/rest/v1/rpc/record_review_reward_download_atomic`, {
        method: 'POST', headers, body: JSON.stringify({ p_workspace_id: session.workspaceId, p_user_id: session.userId, p_video_job_id: videoId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) return NextResponse.json({ error: 'Rekod muat turun tidak dapat disahkan.' }, { status: 400 });
      return NextResponse.json(result);
    } catch { return NextResponse.json({ error: 'Rekod muat turun tidak dapat disimpan.' }, { status: 503 }); }
  }

  const reviewText = typeof body.reviewText === 'string' ? body.reviewText.trim().slice(0, 2000) : '';
  const publishedUrl = typeof body.publishedUrl === 'string' ? body.publishedUrl.trim().slice(0, 1000) : '';
  const consent = body.marketingConsent === true;
  if (reviewText.length < 40 && !publishedUrl) {
    return NextResponse.json({ error: 'Tulis ulasan sekurang-kurangnya 40 aksara atau beri link TikTok/Shopee.' }, { status: 400 });
  }
  if (publishedUrl && !validPublishedUrl(publishedUrl)) {
    return NextResponse.json({ error: 'Gunakan link HTTPS TikTok atau Shopee yang sah.' }, { status: 400 });
  }
  if (!consent) return NextResponse.json({ error: 'Kebenaran penggunaan ulasan diperlukan untuk ganjaran ini.' }, { status: 400 });
  try {
    const response = await fetch(`${base}/rest/v1/rpc/grant_review_reward_atomic`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_workspace_id: session.workspaceId, p_user_id: session.userId,
        p_review_text: reviewText || null, p_published_url: publishedUrl || null, p_marketing_consent: true }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) {
      const message = result.error === 'TWO_DOWNLOADS_REQUIRED'
        ? 'Muat turun sekurang-kurangnya dua video berbeza dahulu.' : 'Ganjaran tidak dapat diproses.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ ...result, message: result.credits_granted === 30
      ? 'Terima kasih! 30 kredit bonus telah dimasukkan ke wallet anda.'
      : 'Ganjaran ini telah dituntut sebelum ini.' });
  } catch { return NextResponse.json({ error: 'Ganjaran tidak dapat diproses sekarang.' }, { status: 503 }); }
}
