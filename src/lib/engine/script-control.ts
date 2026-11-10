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
  tiktok_shop: 'Kalau nak tengok detail, tekan Beg Kuning sekarang.',
  click_button: 'Nak tengok detail? Klik butang dekat bawah.',
  tap_button: 'Kalau nak tahu lagi, tekan butang dekat bawah.',
  check_bio: 'Detail lanjut korang boleh semak dekat bio.',
  dm_info: 'Kalau nak tanya lagi, boleh DM.',
  none: '',
};

type CuratedPattern = {
  styleId: string;
  withFact: string;
  neutral: string;
};

export const SCRIPT_VARIANTS = ['style', 'direct', 'helpful'] as const;
export type ScriptVariant = typeof SCRIPT_VARIANTS[number];

/**
 * Human-written V8 pattern library. These are style examples/templates, not a
 * universal fixed script and not an AI scriptwriter. Only customer-confirmed
 * facts are interpolated into {fact}.
 */
export const CURATED_STYLE_SCRIPT_PATTERNS: Record<string, CuratedPattern> = {
  NX01: { styleId: 'NX01', withFact: 'Eh korang, kalau tengah survey {product}, yang ni {fact}. {consideration}', neutral: 'Eh korang, kalau memang tengah survey {product}, tengok yang ni dulu. {consideration}' },
  NX02: { styleId: 'NX02', withFact: 'Okay, yang ni {product}. Dia {fact}. {consideration}', neutral: 'Okay, yang ni {product}. Tengok dulu fungsi yang korang perlukan. {consideration}' },
  NX03: { styleId: 'NX03', withFact: 'Haa, baru nampak {product} ni. Rupanya {fact}. {consideration}', neutral: 'Haa, baru nampak {product} ni. Kalau korang tengah cari kategori macam ni, {consideration_lower}' },
  NX05: { styleId: 'NX05', withFact: 'Korang pernah tak, susah nak pilih yang betul-betul sesuai? {product} ni {fact}. {consideration}', neutral: 'Korang pernah tak, pilihan banyak sangat sampai makin pening? Kalau tengok {product} ni, {consideration_lower}' },
  NX07: { styleId: 'NX07', withFact: 'So, apa yang penting dekat {product} ni? Jawapan ringkas dia, produk ni {fact}. {consideration}', neutral: 'So, apa yang patut korang tengok dekat {product} ni? Mula dengan fungsi yang korang perlukan, lepas tu {consideration_lower}' },
  NX09: { styleId: 'NX09', withFact: 'Kalau korang tengah cari {product}, yang ni {fact}. {consideration}', neutral: 'Kalau korang tengah cari {product}, jangan tengok rupa je. {consideration}' },
  NX10: { styleId: 'NX10', withFact: 'Okay, dekat {product} ni dinyatakan {fact}. {consideration}', neutral: 'Okay, kalau nak pilih {product}, baca detail yang dinyatakan dulu. {consideration}' },
  RH01: { styleId: 'RH01', withFact: 'Eh korang, yang tengah cari {product}, yang ni {fact}. {consideration}', neutral: 'Eh korang, yang tengah cari {product}, cuba tengok yang ni dulu. {consideration}' },
  RH02: { styleId: 'RH02', withFact: 'Okay, kalau tengah bandingkan {product}, yang ni {fact}. {consideration}', neutral: 'Okay, kalau tengah bandingkan {product}, mula dengan fungsi yang korang betul-betul perlukan. {consideration}' },
  RH03: { styleId: 'RH03', withFact: 'Korang yang nak guna {product} hari-hari, model ni {fact}. {consideration}', neutral: 'Korang yang nak guna {product} hari-hari, fikir dulu ruang dan rutin korang. {consideration}' },
  RH04: { styleId: 'RH04', withFact: 'Kalau {product} memang ada dalam list korang, yang ni {fact}. {consideration}', neutral: 'Kalau {product} memang ada dalam list korang, tengok kegunaan yang korang cari dulu. {consideration}' },
  RH17: { styleId: 'RH17', withFact: 'Kalau meja kerja memang tempat korang fokus lama, {product} ni {fact}. {consideration}', neutral: 'Kalau meja kerja memang tempat korang fokus lama, {product} macam ni boleh masuk dalam setup. {consideration}' },
  RH19: { styleId: 'RH19', withFact: 'Yang tengah survey {product}, yang ni {fact}. {consideration}', neutral: 'Yang tengah survey {product}, cuba fikir bila korang memang akan guna benda ni. {consideration}' },
  NX11: { styleId: 'NX11', withFact: 'Kalau korang jumpa {product} macam ni, benda pertama nak check ialah {fact}. {consideration}', neutral: 'Kalau korang jumpa {product} macam ni, check dulu apa yang korang betul-betul perlukan. {consideration}' },
  NX12: { styleId: 'NX12', withFact: 'Eh, ternampak {product} ni. Yang menarik, dia {fact}. {consideration}', neutral: 'Eh, ternampak {product} ni. Kalau kategori ni memang dalam list korang, {consideration_lower}' },
  NX13: { styleId: 'NX13', withFact: 'Korang yang suka ruang dapur lebih teratur, {product} ni {fact}. {consideration}', neutral: 'Korang yang selalu pening barang dapur dah penuh, {product} macam ni boleh tengok juga. {consideration}' },
  NX14: { styleId: 'NX14', withFact: 'Kalau setup meja korang perlukan {product}, model ni {fact}. {consideration}', neutral: 'Kalau korang selalu buat kerja dekat meja, {product} macam ni boleh masuk dalam setup. {consideration}' },
  NX15: { styleId: 'NX15', withFact: 'Aku rasa ramai pernah pening nak pilih {product}. Yang ni {fact}. {consideration}', neutral: 'Aku rasa ramai pernah pening nak pilih {product}. Banyak nampak sama, jadi {consideration_lower}' },
  NX16: { styleId: 'NX16', withFact: 'Okay, aku share santai je. {product} ni {fact}. {consideration}', neutral: 'Okay, aku share santai je. Kalau korang memang tengah cari {product}, {consideration_lower}' },
  NX17: { styleId: 'NX17', withFact: 'Eh, korang yang tengah cari {product}, yang ni {fact}. {consideration}', neutral: 'Eh, korang yang tengah cari {product}, yang ni boleh tengok juga. {consideration}' },
};

function buyingConsideration(category: string): string {
  const value = category.toLowerCase();
  if (/supplement|wellness|health|suplemen/.test(value)) return 'Tapi sebelum pilih, semak kandungan dan cara pengambilan dulu.';
  if (/beauty|cosmetic|skin|serum|sunscreen|sun care|spf/.test(value)) return 'Tapi semak dulu kandungan dan cara pakai yang dinyatakan.';
  if (/automotive|car|kereta/.test(value)) return 'Tapi check dulu cara pasang dan kesesuaian dengan kereta korang.';
  if (/kitchen|organizer|dapur|cookware/.test(value)) return 'Tapi ukur dulu ruang yang korang ada, ngam ke tak.';
  if (/gadget|lighting|lamp|office/.test(value)) return 'Tapi check dulu fungsi dan cara sambungan yang dinyatakan.';
  if (/fragrance|mist|pewangi|perfume|haruman/.test(value)) return 'Tapi check dulu jenis bau dan cara guna yang dinyatakan.';
  return 'Tapi check fungsi yang korang perlukan dan cara guna yang dinyatakan.';
}

function variantOpening(variant: ScriptVariant, productName: string, fact: string, consideration: string): string | null {
  if (variant === 'direct') return fact
    ? `Okay, ${productName} ni ${fact}. ${consideration}`
    : `Okay, kalau tengah cari ${productName}, tengok fungsi yang korang perlukan dulu. ${consideration}`;
  if (variant === 'helpful') return fact
    ? `Yang tengah survey ${productName}, model ni ${fact}. ${consideration}`
    : `Yang tengah survey ${productName}, jangan pilih sebab rupa je. ${consideration}`;
  return null;
}

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
  variant: ScriptVariant = 'style',
): string {
  const pattern = CURATED_STYLE_SCRIPT_PATTERNS[style.id];
  if (!pattern) throw new Error(`Tiada corak Smart Script rasmi untuk ${style.id}.`);
  const productName = tidy(product.name && product.name !== 'the uploaded product image' ? product.name : 'produk ini', 80);
  const confirmedFact = tidy(product.confirmedFeatures?.[0] || '', 180);
  const consideration = buyingConsideration(product.category || 'general');
  const alternate = variantOpening(variant, productName, confirmedFact, consideration);
  const base = (alternate || (confirmedFact ? pattern.withFact : pattern.neutral))
    .replaceAll('{product}', productName)
    .replaceAll('{fact}', confirmedFact)
    .replaceAll('{consideration}', consideration)
    .replaceAll('{consideration_lower}', consideration.charAt(0).toLowerCase() + consideration.slice(1))
    .replace(/\s+/g, ' ')
    .trim();
  const cta = resolveCtaPhrase(ctaMode, customCta);
  return `${base}${cta ? ` ${cta}` : ''}`.trim();
}

export function quoteProviderScript(script: string): string {
  return JSON.stringify(tidy(script, 600));
}
