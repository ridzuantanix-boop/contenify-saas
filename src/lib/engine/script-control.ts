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
  NX01: { styleId: 'NX01', withFact: 'Kalau korang tengah cari {product}, yang ni {fact}. Boleh tengok sama ada ngam dengan rutin korang.', neutral: 'Korang tengah tengok {product} ni? Jom tengok dekat-dekat dulu, mana tahu ngam dengan apa yang korang cari.' },
  NX02: { styleId: 'NX02', withFact: '{product} ni {fact}. Aku pegang macam ni supaya korang boleh tengok dengan lebih jelas.', neutral: 'Ni {product}. Aku tunjuk depan-depan dulu supaya korang boleh tengok rupa dan saiz dia.' },
  NX03: { styleId: 'NX03', withFact: 'Eh, baru perasan {product} ni {fact}. Menarik juga kalau itu yang korang tengah cari.', neutral: 'Eh, ni {product} rupanya. Sekali pandang memang buat aku nak tengok dekat sikit.' },
  NX05: { styleId: 'NX05', withFact: 'Kadang susah nak jumpa yang kena dengan keperluan. {product} ni {fact}, jadi boleh tengok yang ni dulu.', neutral: 'Kadang banyak sangat pilihan sampai tak tahu nak tengok yang mana. Ni {product}, kita tengok yang penting dulu.' },
  NX07: { styleId: 'NX07', withFact: '{product} ni ada apa? Yang jelas, {fact}. Ha, itu yang korang boleh tengok dulu.', neutral: '{product} ni macam mana? Jom tengok benda yang jelas pada produk ni dulu, lepas tu baru senang nak pilih.' },
  NX09: { styleId: 'NX09', withFact: 'Ni {product}. Yang ni {fact}. Aku pusing sikit supaya korang boleh tengok dengan lebih jelas.', neutral: 'Ni {product}. Aku gerakkan perlahan sikit supaya korang boleh tengok bentuk dia dari dekat.' },
  NX10: { styleId: 'NX10', withFact: 'Dekat {product} ni memang tertulis {fact}. Aku tunjuk dekat sikit supaya korang nampak.', neutral: 'Kalau nak tengok {product} ni, kita mula dengan apa yang memang tercetak dekat produk dulu.' },
  RH01: { styleId: 'RH01', withFact: 'Ni {product} bila dipegang macam biasa. Yang ni {fact}. Aku gerakkan perlahan bagi nampak jelas.', neutral: 'Ni {product} bila dipegang macam biasa. Aku gerakkan perlahan bagi korang nampak bentuk dia.' },
  RH02: { styleId: 'RH02', withFact: 'Aku sengetkan sikit {product} ni. Yang ni {fact}, jadi korang boleh tengok dari sudut lain.', neutral: 'Aku sengetkan sikit {product} ni, senang korang nak tengok bentuk dia dari sudut lain.' },
  RH03: { styleId: 'RH03', withFact: 'Bila angkat {product} ni, senang nak agak saiz dia. Yang ni {fact}.', neutral: 'Aku angkat {product} ni sekejap, lepas tu letak balik. Senang sikit nak agak saiz dia.' },
  RH04: { styleId: 'RH04', withFact: 'Nampak {product} dekat rak ni? Yang ni {fact}. Aku ambil bagi korang tengok lebih jelas.', neutral: 'Nampak {product} dekat rak ni? Aku ambil sekejap bagi korang tengok lebih jelas.' },
  RH17: { styleId: 'RH17', withFact: 'Untuk setup meja, {product} ni {fact}. Aku letak sini supaya korang boleh bayang ruang dia.', neutral: 'Aku letak {product} dekat meja kerja macam ni, senang korang nak bayang ruang yang dia guna.' },
  RH19: { styleId: 'RH19', withFact: 'Bawah cahaya siang, {product} ni nampak lebih jelas. Yang ni {fact}.', neutral: 'Bawah cahaya siang macam ni, warna dan bentuk {product} nampak lebih jelas.' },
  NX11: { styleId: 'NX11', withFact: 'Kalau jumpa {product} ni, apa korang nak tengok dulu? Yang ni {fact}.', neutral: 'Kalau jumpa {product} ni, apa korang nak tengok dulu? Jom tengok dari sudut pembeli.' },
  NX12: { styleId: 'NX12', withFact: 'Eh, ternampak {product} ni. Rupanya {fact}. Patutlah buat aku berhenti tengok sekejap.', neutral: 'Eh, ternampak {product} ni. Nampak menarik untuk kita tengok dekat sikit.' },
  NX13: { styleId: 'NX13', withFact: 'Kalau dekat dapur, {product} ni {fact}. Aku tunjuk macam mana rupa dia atas kaunter.', neutral: 'Kalau barang dapur macam {product} ni, aku suka tengok dulu macam mana rupa dia atas kaunter.' },
  NX14: { styleId: 'NX14', withFact: 'Untuk setup meja, {product} ni {fact}. Aku tunjuk macam mana rupa dia dekat ruang kerja.', neutral: 'Kalau nak letak {product} dekat meja kerja, jom tengok dulu macam mana rupa dia dalam ruang ni.' },
  NX15: { styleId: 'NX15', withFact: 'Kadang nak pilih barang pun pening sebab banyak sangat pilihan. {product} ni {fact}.', neutral: 'Kadang nak pilih barang pun pening sebab banyak sangat pilihan. Ni {product}, kita tengok satu-satu dulu.' },
  NX16: { styleId: 'NX16', withFact: 'Aku share santai je, {product} ni {fact}. Kalau ngam dengan apa yang korang cari, boleh tengok.', neutral: 'Aku share santai je pasal {product} ni. Kalau nampak ngam dengan apa yang korang cari, boleh tengok.' },
  NX17: { styleId: 'NX17', withFact: 'Eh, tiba-tiba teringat {product} ni. Yang ni {fact}. Boleh tengok kalau memang korang perlukan.', neutral: 'Eh, tiba-tiba teringat {product} ni. Boleh tengok kalau benda ni memang kena dengan apa yang korang cari.' },
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
