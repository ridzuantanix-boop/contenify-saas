const base = 'https://oudxnvazrdmnxdndpgmy.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('Service-role key tiada.');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await response.text(); const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Cleanup HTTP ${response.status} pada ${path.split('?')[0]}`);
  return data;
}
const profiles = await request('/rest/v1/profiles?select=id,email,full_name,default_workspace_id,created_at');
const targets = profiles.filter((profile) => profile.full_name === 'Codex V7 QA' && (
  /^codex\.v7\.qa\.\d+@example\.com$/i.test(profile.email) || profile.email === 'codex.v7.qa@affimatik.online'
));
if (targets.length < 1 || targets.length > 10) throw new Error(`Bilangan target QA luar jangka: ${targets.length}`);
let deletedObjects = 0;
for (const target of targets) {
  const workspaceId = target.default_workspace_id;
  if (!workspaceId) throw new Error('Target QA tiada workspace.');
  const [productImages, avatars, backgrounds] = await Promise.all([
    request(`/rest/v1/product_images?workspace_id=eq.${workspaceId}&select=r2_key`),
    request(`/rest/v1/avatars?workspace_id=eq.${workspaceId}&select=image_r2_key`),
    request(`/rest/v1/background_assets?workspace_id=eq.${workspaceId}&select=image_r2_key`),
  ]);
  const paths = [...productImages.map((row) => row.r2_key), ...avatars.map((row) => row.image_r2_key), ...backgrounds.map((row) => row.image_r2_key)];
  for (const objectPath of paths) {
    await request('/storage/v1/object/affimatik-assets', { method: 'DELETE', body: JSON.stringify({ prefixes: [objectPath] }) });
    deletedObjects++;
  }
  await request(`/rest/v1/workspaces?id=eq.${workspaceId}&owner_id=eq.${target.id}`, { method: 'DELETE' });
  await request(`/rest/v1/profiles?id=eq.${target.id}`, { method: 'DELETE' });
  await request(`/auth/v1/admin/users/${target.id}`, { method: 'DELETE' });
}
const remaining = await request('/rest/v1/profiles?select=id,email,full_name');
if (remaining.some((profile) => profile.full_name === 'Codex V7 QA' && (profile.email === 'codex.v7.qa@affimatik.online' || /^codex\.v7\.qa\.\d+@example\.com$/i.test(profile.email)))) {
  throw new Error('Masih ada profil V7 QA selepas cleanup.');
}
console.log(JSON.stringify({ deletedTestAccounts: targets.length, deletedTestStorageObjects: deletedObjects }));
