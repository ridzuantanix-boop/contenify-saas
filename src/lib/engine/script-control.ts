import { ProductProfile } from './types';
import { VideoStyle } from '../styles/types';
import { PROHIBITED_FABRICATED_PATTERNS, FORBIDDEN_PACKAGING_PROPOSITIONS } from './voiceover-director';

export const SCRIPT_MODES = ['smart', 'custom', 'provider_auto'] as const;
export type ScriptMode = typeof SCRIPT_MODES[number];

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
  tiktok_shop: 'Kalau sesuai, tekan Beg Kuning.',
  click_button: 'Klik butang di bawah untuk maklumat lanjut.',
  tap_button: 'Tekan butang di bawah untuk maklumat lanjut.',
  check_bio: 'Boleh semak pautan di bio.',
  dm_info: 'DM untuk info lanjut.',
  none: '',
};

type CuratedPattern = {
  styleId: string;
  withFact: string;
  neutral: string;
};

/**
 * Human-written V8 pattern library. These are style examples/templates, not a
 * universal fixed script and not an AI scriptwriter. Only customer-confirmed
 * facts are interpolated into {fact}.
 */
export const CURATED_STYLE_SCRIPT_PATTERNS: Record<string, CuratedPattern> = {
  NX01: { styleId: 'NX01', withFact: 'Kalau tengah cari {product}, yang penting {fact}. Pilih ikut keperluan sendiri.', neutral: 'Kalau tengah tengok {product}, semak fungsi pada label dan pilih ikut keperluan sendiri.' },
  NX02: { styleId: 'NX02', withFact: '{product} ini diterangkan dengan ringkas: {fact}. Itu perkara utama untuk dipertimbangkan.', neutral: '{product} ini boleh dinilai melalui fungsi yang dinyatakan pada label. Semak dulu sebelum memilih.' },
  NX03: { styleId: 'NX03', withFact: 'Oh, menarik juga {product} ini. Maklumat yang disahkan ialah {fact}.', neutral: 'Oh, ini {product}. Menarik untuk tengok fungsi pada label sebelum buat pilihan.' },
  NX05: { styleId: 'NX05', withFact: 'Bila perlukan pilihan yang sesuai, {product} ini ada satu perkara relevan: {fact}.', neutral: 'Bila perlukan pilihan yang sesuai, tengok dulu tujuan {product} ini dan padankan dengan keperluan.' },
  NX07: { styleId: 'NX07', withFact: 'Apa yang perlu tahu tentang {product}? Fakta yang disahkan ialah {fact}.', neutral: 'Apa yang perlu tahu tentang {product}? Semak tujuan dan arahan pada label sebelum memilih.' },
  NX09: { styleId: 'NX09', withFact: 'Untuk pertimbangan harian, {product} ini mempunyai maklumat disahkan: {fact}.', neutral: 'Untuk pertimbangan harian, lihat tujuan {product} ini dan semak maklumat pada label.' },
  NX10: { styleId: 'NX10', withFact: 'Pada label {product}, perkara yang sudah disahkan ialah {fact}. Gunakan maklumat itu untuk menilai kesesuaian.', neutral: 'Untuk {product} ini, baca maklumat yang jelas pada label dan nilai kesesuaiannya.' },
  RH01: { styleId: 'RH01', withFact: '{product} ini ditunjukkan secara dekat. Maklumat yang disahkan: {fact}.', neutral: '{product} ini ditunjukkan secara dekat supaya bentuk dan labelnya boleh dilihat dengan jelas.' },
  RH02: { styleId: 'RH02', withFact: 'Dari sudut ini, {product} kekal jelas. Fakta yang disahkan ialah {fact}.', neutral: 'Dari sudut ini, bentuk dan label {product} boleh dilihat tanpa mengubah rupanya.' },
  RH03: { styleId: 'RH03', withFact: 'Bila diangkat, skala {product} nampak lebih jelas. Maklumat disahkan: {fact}.', neutral: 'Bila diangkat dan diletak semula, skala sebenar {product} nampak lebih jelas.' },
  RH04: { styleId: 'RH04', withFact: '{product} ini berada dalam konteks yang sesuai. Fakta yang disahkan ialah {fact}.', neutral: '{product} ini ditunjukkan dalam konteks biasa supaya mudah dinilai sebelum memilih.' },
  RH17: { styleId: 'RH17', withFact: 'Untuk ruang kerja, {product} ini ada maklumat disahkan: {fact}.', neutral: 'Untuk ruang kerja, pertimbangkan {product} ini mengikut fungsi yang dinyatakan pada label.' },
  RH19: { styleId: 'RH19', withFact: 'Dalam cahaya siang, {product} nampak jelas. Fakta yang disahkan ialah {fact}.', neutral: 'Dalam cahaya siang, warna, bentuk dan label {product} boleh dilihat dengan lebih jelas.' },
  NX11: { styleId: 'NX11', withFact: 'Sesuai tak {product} ini untuk keperluan anda? Fakta yang disahkan ialah {fact}.', neutral: 'Sesuai tak {product} ini? Semak tujuan pada label dan padankan dengan keperluan anda.' },
  NX12: { styleId: 'NX12', withFact: 'Eh, jumpa {product} ini. Perkara yang sudah disahkan ialah {fact}.', neutral: 'Eh, jumpa {product} ini. Boleh tengok fungsi pada label sebelum tentukan kesesuaiannya.' },
  NX13: { styleId: 'NX13', withFact: 'Untuk kegunaan dapur, {product} ini ada maklumat disahkan: {fact}.', neutral: 'Untuk kegunaan dapur, semak tujuan dan arahan {product} ini sebelum menggunakannya.' },
  NX14: { styleId: 'NX14', withFact: 'Kalau tengah kemaskan meja kerja, {product} ini mempunyai fakta disahkan: {fact}.', neutral: 'Kalau tengah kemaskan meja kerja, nilai {product} ini berdasarkan fungsi yang dinyatakan.' },
  NX15: { styleId: 'NX15', withFact: 'Kadang-kadang kita cuma perlukan pilihan yang jelas. Untuk {product}, fakta disahkan ialah {fact}.', neutral: 'Kadang-kadang kita cuma perlukan pilihan yang jelas. Semak tujuan {product} ini sebelum memilih.' },
  NX16: { styleId: 'NX16', withFact: 'Kalau {product} ini sesuai dengan keperluan anda, fakta yang disahkan ialah {fact}.', neutral: 'Kalau {product} ini sesuai dengan keperluan anda, semak maklumat pada label dahulu.' },
  NX17: { styleId: 'NX17', withFact: 'Teringat nak tunjuk {product} ini. Satu perkara yang disahkan ialah {fact}.', neutral: 'Teringat nak tunjuk {product} ini. Tengok tujuan pada label dan nilai ikut keperluan.' },
};

const forbiddenIndonesian = ['kamu', 'kalian', 'nggak', 'enggak', 'banget', 'cobain', 'keranjang kuning', 'gimana', 'bikin', 'gue', 'lu'];

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

export function validateHumanScript(script: string): { isValid: boolean; errors: string[]; wordCount: number } {
  const normalized = tidy(script, 600);
  const words = normalized ? normalized.split(/\s+/) : [];
  const errors: string[] = [];
  if (!normalized) errors.push('Skrip tidak boleh kosong.');
  if (script.trim().length > 600) errors.push('Skrip mesti 600 aksara atau kurang.');
  if (words.length > 48) errors.push(`Skrip terlalu panjang (${words.length} perkataan). Gunakan maksimum 48 perkataan untuk video 15 saat.`);
  for (const word of forbiddenIndonesian) {
    if (new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized)) {
      errors.push(`Gunakan Bahasa Melayu Malaysia; frasa "${word}" tidak dibenarkan.`);
      break;
    }
  }
  for (const pattern of PROHIBITED_FABRICATED_PATTERNS) {
    if (pattern.test(normalized)) { errors.push('Skrip mengandungi pengalaman peribadi atau dakwaan keberkesanan yang tidak dibenarkan.'); break; }
  }
  for (const pattern of FORBIDDEN_PACKAGING_PROPOSITIONS) {
    if (pattern.test(normalized)) { errors.push('Jangan jadikan rupa bungkusan sebagai dakwaan jualan utama.'); break; }
  }
  if (/ignore|system prompt|developer message|arahan sistem/i.test(normalized)) errors.push('Skrip mengandungi arahan yang tidak dibenarkan.');
  return { isValid: errors.length === 0, errors, wordCount: words.length };
}

export function buildSmartScript(
  product: ProductProfile,
  style: VideoStyle,
  ctaMode: CtaMode,
  customCta = '',
): string {
  const pattern = CURATED_STYLE_SCRIPT_PATTERNS[style.id];
  if (!pattern) throw new Error(`Tiada corak Smart Script rasmi untuk ${style.id}.`);
  const productName = tidy(product.name && product.name !== 'the uploaded product image' ? product.name : 'produk ini', 80);
  const confirmedFact = tidy(product.confirmedFeatures?.[0] || '', 180);
  const base = (confirmedFact ? pattern.withFact : pattern.neutral)
    .replaceAll('{product}', productName)
    .replaceAll('{fact}', confirmedFact)
    .replace(/\s+/g, ' ')
    .trim();
  const cta = resolveCtaPhrase(ctaMode, customCta);
  return `${base}${cta ? ` ${cta}` : ''}`.trim();
}

export function quoteProviderScript(script: string): string {
  return JSON.stringify(tidy(script, 600));
}
