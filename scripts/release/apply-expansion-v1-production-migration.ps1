$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$snapshot = @"
SELECT json_build_object(
  'users',(SELECT count(*) FROM auth.users),
  'wallets',(SELECT count(*) FROM public.credit_wallets),
  'wallet_balance',(SELECT coalesce(sum(balance),0) FROM public.credit_wallets),
  'reserved_balance',(SELECT coalesce(sum(reserved_balance),0) FROM public.credit_wallets),
  'ledger',(SELECT count(*) FROM public.credit_ledger),
  'jobs',(SELECT count(*) FROM public.video_jobs),
  'wallet_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||balance::text||'|'||reserved_balance::text,'~' ORDER BY id),'')) FROM public.credit_wallets),
  'job_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||status::text||'|'||required_credits::text,'~' ORDER BY id),'')) FROM public.video_jobs)
)::text;
"@

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  & $psql @args '-1' '-f' (Join-Path $repo 'supabase\migrations\00032_expansion_v1_styles.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migration production 00032 gagal.' }
  $after = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  foreach ($field in @('users','wallets','wallet_balance','reserved_balance','ledger','jobs','wallet_hash','job_hash')) {
    if ($before.$field -ne $after.$field) { throw "Integriti production berubah pada $field." }
  }
  $presets = (& $psql @args '-c' "SELECT json_build_object('count',count(*),'ids',array_agg(id ORDER BY id))::text FROM public.prompt_presets WHERE id BETWEEN 'NX21' AND 'NX30';").Trim() | ConvertFrom-Json
  if ($presets.count -ne 10) { throw "Preset expansion tidak lengkap: $($presets.count)." }
  [pscustomobject]@{ success=$true; migration='00032_expansion_v1_styles.sql'; before=$before; after=$after; presets=$presets; appliedAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Depth 6
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
}
