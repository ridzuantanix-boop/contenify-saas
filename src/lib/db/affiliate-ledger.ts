export function affiliateDb() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Pangkalan data affiliate tidak dikonfigurasi.');
  return { base: base.replace(/\/$/, ''), headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } };
}

export async function affiliateRpc(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { base, headers } = affiliateDb();
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  if (!response.ok) throw new Error(`Pangkalan data menolak tindakan affiliate (HTTP ${response.status}).`);
  return await response.json() as Record<string, unknown>;
}
