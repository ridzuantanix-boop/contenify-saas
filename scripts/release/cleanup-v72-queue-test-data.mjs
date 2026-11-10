const base='https://oudxnvazrdmnxdndpgmy.supabase.co';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw new Error('Service-role key tiada.');
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'};
async function request(path,init={}){const response=await fetch(`${base}${path}`,{...init,headers:{...headers,...init.headers}});const text=await response.text();const data=text?JSON.parse(text):null;if(!response.ok)throw new Error(`Cleanup HTTP ${response.status}: ${path}`);return data;}
const profiles=await request('/rest/v1/profiles?full_name=eq.Codex%20V7.2%20Queue%20QA&select=id,email,default_workspace_id');
if(profiles.length>10)throw new Error(`Bilangan QA luar jangka: ${profiles.length}`);
let objects=0;
for(const profile of profiles){
  if(!/^codex\.v72\.queue\.v72-queue-.*@example\.com$/i.test(profile.email))throw new Error(`Target cleanup tidak sah: ${profile.email}`);
  const workspaceId=profile.default_workspace_id;
  const [products,videos]=await Promise.all([request(`/rest/v1/product_images?workspace_id=eq.${workspaceId}&select=r2_key`),request(`/rest/v1/video_jobs?workspace_id=eq.${workspaceId}&result_video_r2_key=not.is.null&select=result_video_r2_key`)]);
  for(const path of [...products.map(x=>x.r2_key),...videos.map(x=>x.result_video_r2_key)].filter(Boolean)){await request('/storage/v1/object/affimatik-assets',{method:'DELETE',body:JSON.stringify({prefixes:[path]})});objects++;}
  await request(`/rest/v1/workspaces?id=eq.${workspaceId}&owner_id=eq.${profile.id}`,{method:'DELETE'});
  await request(`/rest/v1/profiles?id=eq.${profile.id}`,{method:'DELETE'});
  await request(`/auth/v1/admin/users/${profile.id}`,{method:'DELETE'});
}
console.log(JSON.stringify({deletedAccounts:profiles.length,deletedObjects:objects}));
