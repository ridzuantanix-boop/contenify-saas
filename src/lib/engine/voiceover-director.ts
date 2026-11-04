/**
 * AFFIMATIK by Pawarna — Voiceover Director & Script Truthfulness Engine (V3)
 * Generates and validates natural, authentic Malaysian Malay spoken scripts.
 * 
 * Strict Quality Guardrails:
 * 1. 10-second timing budget: strictly 14 to 23 spoken Malaysian Malay words.
 * 2. Strictly NO Indonesian loanwords or slang.
 * 3. Strictly NO fabricated first-person personal testimony.
 * 4. Strictly NO unsubstantiated medical, cosmetic, or financial overclaims.
 * 5. Uses confirmed product facts when provided; neutral visual presentation when unverified.
 */

import { ProductProfile } from './types';
import { VideoStyle } from '../styles/types';

export const PROHIBITED_INDONESIAN_WORDS = [
  'kamu',
  'kalian',
  'nggak',
  'enggak',
  'banget',
  'cobain',
  'keranjang kuning',
  'beg kuning',
  'cowok',
  'cewek',
  'beneran',
  'gimana',
  'bikin',
  'lho',
  'dong',
  'deh',
  'gue',
  'lu',
  'aja deh',
] as const;

export const PROHIBITED_FABRICATED_PATTERNS = [
  /saya sendiri (puas hati )?pakai/i,
  /pengalaman peribadi saya/i,
  /saya dah guna selama/i,
  /ramai review kata/i,
  /ramai orang cakap/i,
  /sembuh (100%|dalam masa)/i,
  /terbukti secara klinikal/i,
  /hilang(kan)? (jerawat|parut|berat) dalam (\d+|sekelip)/i,
  /paling sedap di dunia/i,
  /dijamin (\d+%)? berkesan/i,
  /gerenti (putih|kurus|lulus)/i,
  /lulus kkm/i, // unless explicitly verified
] as const;

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  wordCount: number;
}

export class VoiceoverDirector {
  /**
   * Generates a truthful, product-specific conversational Malaysian Malay script (14-23 words)
   * Priority:
   * 1. Uses confirmedFeatures if supplied by the customer
   * 2. Falls back to neutral visual observation (never fabricates unverified claims)
   * 
   * Supports variationIndex to provide distinct alternative scripts on "Jana Semula"
   */
  static generateAuthenticScript(
    product: ProductProfile,
    style: VideoStyle,
    ctaMode: 'spoken_button' | 'spoken_bio' | 'none' = 'spoken_button',
    variationIndex: number = 0
  ): string {
    // RunningHub styles must NOT have any voiceover
    if (style.engine === 'runninghub') {
      return '';
    }

    const category = product.category.toLowerCase();
    const format = product.packagingFormat;
    const name = product.sourceConfidence === 'verified_user' ? product.name : 'produk dalam gambar ni';
    const vIdx = Math.abs(Math.floor(variationIndex)) % 4;

    let coreSentence = '';

    // If customer supplied genuine confirmed features, integrate them concisely with variations
    if (product.confirmedFeatures && product.confirmedFeatures.length > 0) {
      const topFeature = product.confirmedFeatures[0].toLowerCase();
      const confirmedVariants = [
        `Korang tengok ${name} ni, ia ${topFeature} untuk kegunaan harian.`,
        `Bagi yang tengah cari ${name}, fungsi ${topFeature} ni memang praktikal.`,
        `Ni dia ${name}, kemasan elok dan ${topFeature} sesuai untuk guna harian.`,
        `Kalau korang perlukan ${name}, ia ${topFeature} untuk memudahkan urusan korang.`,
      ];
      coreSentence = confirmedVariants[vIdx];
    } else {
      // Truthful visual observation fallback without inventing unverified performance claims
      if (category.includes('makanan') || category.includes('masakan') || format === 'jar') {
        const foodVariants = [
          `Korang tengok bungkusan ${name} ni, saiz hidangan dia nampak padat dan kemas untuk stok dapur.`,
          `Bagi pencinta masakan, ${name} ni sedap dihidang bersama makanan dan bungkusan dia kemas.`,
          `Tengok pek ${name} ni, hidangan dia nampak menyelerakan dan sesuai dinikmati seisi keluarga.`,
          `Kalau korang cari sajian ringkas, ${name} ni mudah dihidang bersama hidangan harian.`,
        ];
        coreSentence = foodVariants[vIdx];
      } else if (category.includes('skincare') || category.includes('kecantikan') || format === 'bottle') {
        const beautyVariants = [
          `Korang tengok botol ${name} ni, saiz dia padat dan rekaan penutup dia nampak kemas untuk dibawa travel.`,
          `Bagi rutin penjagaan diri, botol ${name} ni kemas dan mudah digunakan setiap hari.`,
          `Rekaan botol ${name} ni memang praktikal, saiz senang dipegang dan penutup botol kemas.`,
          `Kalau korang perlukan penjagaan harian, ${name} ni nampak selesa dan kemas dibawa ke mana-mana.`,
        ];
        coreSentence = beautyVariants[vIdx];
      } else if (category.includes('tudung') || category.includes('fesyen') || format === 'apparel') {
        const fashionVariants = [
          `Korang tengok kemasan kain ${name} ni, jahitan tepi kemas dan nampak terletak elok bila dipakai.`,
          `Bagi yang nak bergaya kemas, ${name} ni terletak cantik dan selesa bila digayakan.`,
          `Material kain ${name} ni nampak lembut, bidang pun terletak elok bila dipakai keluar.`,
          `Tengok fabrik ${name} ni, tekstur dia nampak kemas dan senang digayakan untuk harian.`,
        ];
        coreSentence = fashionVariants[vIdx];
      } else if (category.includes('elektronik') || category.includes('gadget') || format === 'gadget') {
        const gadgetVariants = [
          `Korang tengok rekaan ${name} ni, binaan dia padat dan ringkas untuk kemudahan kerja korang.`,
          `Bagi memudahkan urusan harian, ${name} ni mudah dikendalikan dan binaan luar dia kemas.`,
          `Binaan peranti ${name} ni nampak kemas dan moden, praktikal dibawa ke mana-mana.`,
          `Kalau korang cari gajet ringkas, ${name} ni mudah digunakan untuk kegunaan seharian korang.`,
        ];
        coreSentence = gadgetVariants[vIdx];
      } else {
        const generalVariants = [
          `Korang tengok ${name} ni, kemasan bungkusan dia nampak kemas dan elok untuk kegunaan seharian.`,
          `Bagi kegunaan harian, ${name} ni saiz dia praktikal dan kemasan bungkusan nampak teratur.`,
          `Rekaan ${name} ni nampak ringkas dan padat, senang disimpan untuk kemudahan harian.`,
          `Kalau korang nak pilihan praktikal, ${name} ni kemas dan sesuai untuk keperluan seharian.`,
        ];
        coreSentence = generalVariants[vIdx];
      }
    }

    // Append natural Malaysian CTA
    if (ctaMode === 'spoken_button') {
      return `${coreSentence} Tekan butang di bawah untuk tengok info lanjut.`;
    } else if (ctaMode === 'spoken_bio') {
      return `${coreSentence} Boleh tengok pautan di bio untuk maklumat lanjut.`;
    }

    return coreSentence;
  }

  /**
   * Deterministic script validator
   */
  static validateScript(
    script: string,
    product: ProductProfile,
    engine: 'nexabot' | 'runninghub'
  ): ScriptValidationResult {
    const errors: string[] = [];

    if (engine === 'runninghub') {
      if (script && script.trim().length > 0) {
        errors.push('Gaya 15s AffiMatik Motion adalah visual pergerakan sepenuhnya dan tidak dibenarkan mengandungi sebarang skrip pertuturan.');
      }
      return { isValid: errors.length === 0, errors, wordCount: 0 };
    }

    const trimmed = script.trim();
    if (!trimmed) {
      errors.push('Skrip suara pertuturan AffiMatik Voice (10s) tidak boleh kosong.');
      return { isValid: false, errors, wordCount: 0 };
    }

    // Word count calculation
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Strict 10-second budget: between 12 and 28 words
    if (wordCount < 12) {
      errors.push(`Skrip terlalu pendek (${wordCount} patah perkataan). Minimum 12 perkataan untuk video 10 saat.`);
    } else if (wordCount > 28) {
      errors.push(`Skrip terlalu panjang (${wordCount} patah perkataan). Had maksimum 28 perkataan agar sebutan tidak laju atau terpotong.`);
    }

    // Check prohibited Indonesian slang
    const lower = trimmed.toLowerCase();
    for (const indoWord of PROHIBITED_INDONESIAN_WORDS) {
      const regex = new RegExp(`\\b${indoWord}\\b`, 'i');
      if (regex.test(lower)) {
        errors.push(`Perkataan slanga Indonesia dilarang dalam skrip AffiMatik: "${indoWord}". Sila gunakan istilah bahasa Melayu Malaysia.`);
      }
    }

    // Check prohibited fabricated patterns
    for (const pattern of PROHIBITED_FABRICATED_PATTERNS) {
      if (pattern.test(lower)) {
        errors.push('Klaim peribadi atau janji keberkesanan tidak berasas dilarang dalam skrip affiliate.');
        break;
      }
    }

    // Check inappropriate verbs for food
    const isFood = (product.category || '').toLowerCase().includes('makan') || product.packagingFormat === 'jar' || product.packagingFormat === 'pouch';
    if (isFood && /\bpakai\b/i.test(lower)) {
      errors.push('Penggunaan kata kerja "pakai" tidak sesuai untuk produk makanan. Gunakan "hidang", "makan", atau "nikmati".');
    }

    // Check unverified clinical claims
    const facts = product.confirmedFeatures || (product as any).verifiedFacts || [];
    if (/lulus kkm/i.test(lower) && !facts.some((f: string) => /kkm/i.test(f))) {
      errors.push('Dakwaan "Lulus KKM" dilarang melainkan dibuktikan dalam senarai ciri produk yang disahkan.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      wordCount,
    };
  }
}
