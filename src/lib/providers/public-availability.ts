export function publicProviderAvailability() {
  return {
    nexabot: process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED === 'true',
    // RunningHub is retired from public generation until a separately reviewed
    // release restores it. Historical jobs still use the adapter for polling.
    runninghub: false,
  };
}
