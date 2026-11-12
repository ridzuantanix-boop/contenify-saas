export const CTA_MODES = [
  'tiktok_shop',
  'click_button',
  'tap_button',
  'check_bio',
  'dm_info',
  'none',
  'custom',
] as const;

export type CtaMode = typeof CTA_MODES[number];

export const APPROVED_CTA_PHRASES: Record<Exclude<CtaMode, 'custom'>, string> = {
  tiktok_shop: 'Kalau nak tengok detail, tekan Beg Kuning sekarang.',
  click_button: 'Nak tengok detail? Klik butang dekat bawah.',
  tap_button: 'Kalau nak tahu lagi, tekan butang dekat bawah.',
  check_bio: 'Detail lanjut korang boleh semak dekat bio.',
  dm_info: 'Kalau nak tanya lagi, boleh DM.',
  none: '',
};

function tidy(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

export function validateCustomerFact(value: string): string[] {
  const fact = tidy(value, 180);
  if (!fact) return [];
  const errors: string[] = [];
  if (value.trim().length > 180) errors.push('Fakta produk mesti 180 aksara atau kurang.');
  if (/https?:\/\/|www\./i.test(fact)) errors.push('Fakta produk tidak boleh mengandungi pautan web.');
  if (/\b(sembuh|merawat|menyembuhkan|dijamin|gerenti|100%|pasti berkesan)\b/i.test(fact)) {
    errors.push('Fakta produk mengandungi dakwaan keberkesanan atau perubatan yang tidak dibenarkan.');
  }
  return errors;
}

export function validateCustomCta(value: string): string[] {
  const cta = tidy(value, 80);
  const errors: string[] = [];
  if (!cta) errors.push('Masukkan ayat Custom CTA.');
  if (value.trim().length > 80) errors.push('Custom CTA mesti 80 aksara atau kurang.');
  if (/https?:\/\/|www\./i.test(cta)) errors.push('Custom CTA tidak boleh mengandungi pautan web.');
  if (/ignore|system prompt|developer message|arahan sistem/i.test(cta)) errors.push('Custom CTA mengandungi arahan yang tidak dibenarkan.');
  if (/\b(dijamin|gerenti|100%|pasti berkesan|termurah|nombor satu)\b/i.test(cta)) errors.push('Custom CTA tidak boleh mengandungi janji atau superlatif yang tidak disahkan.');
  return errors;
}

export function resolveCtaPhrase(mode: CtaMode, customCta = ''): string {
  return mode === 'custom' ? tidy(customCta, 80) : APPROVED_CTA_PHRASES[mode];
}
