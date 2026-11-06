export function publicProviderAvailability() {
  return {
    nexabot: process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED === 'true',
    runninghub: process.env.AFFIMATIK_MOTION_PUBLIC_ENABLED === 'true',
  };
}
