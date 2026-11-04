/**
 * AFFIMATIK by Pawarna — Voiceover Director & Script Truthfulness Engine
 * Generates and validates natural, authentic Malaysian Malay spoken scripts
 * Eliminates fabricated claims, inappropriate category verbs, Indonesian loanwords,
 * and unrealistic speech duration.
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
] as const;

export const PROHIBITED_FABRICATED_PATTERNS = [
  /saya sendiri (puas hati )?pakai/i,
  /pengalaman peribadi saya/i,
  /saya dah guna selama/i,
  /ramai review kata/i,
  /sembuh (100%|dalam masa)/i,
  /terbukti secara klinikal/i,
  /hilang(kan)? (jerawat|parut|berat) dalam (\d+|sekelip)/i,
  /paling sedap di dunia/i,
  /dijamin (\d+%)? berkesan/i,
] as const;

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  wordCount: number;
}

export class VoiceoverDirector {
  /**
   * Generates a truthful, category-aware conversational Malaysian Malay script (14-23 words)
   */
  static generateAuthenticScript(
    product: ProductProfile,
    style: VideoStyle,
    ctaMode: 'spoken_button' | 'spoken_bio' | 'none' = 'spoken_button'
  ): string {
    // RunningHub styles must NOT generate any voiceover
    if (style.engine === 'runninghub') {
      return '';
    }

    const category = product.category.toLowerCase();
    const format = product.packagingFormat;
    const name = product.sourceConfidence === 'verified_user' ? product.name : 'produk dalam gambar ni';

    let coreMessage = '';

    // Category-Aware Malaysian Malay Action Verbs (NEVER use 'pakai' for food!)
    if (category.includes('makanan') || category.includes('masakan') || format === 'jar' || name.toLowerCase().includes('sambal')) {
      coreMessage = `Korang tengok bungkusan ${name} ni, bahan dia nampak berkualiti dan sesuai dihidang bersama hidangan keluarga.`;
    } else if (category.includes('skincare') || category.includes('kecantikan') || format === 'bottle' || name.toLowerCase().includes('serum')) {
      coreMessage = `Korang tengok botol ${name} ni, tekstur dia nampak sangat ringan bila disapu pada kulit dan mudah meresap.`;
    } else if (category.includes('tudung') || category.includes('fesyen') || format === 'apparel') {
      coreMessage = `Korang tengok kemasan ${name} ni, jahitan tepi kemas dan kain nampak terletak elok bila digayakan.`;
    } else if (category.includes('elektronik') || category.includes('gadget') || format === 'gadget') {
      coreMessage = `Korang tengok rekaan ${name} ni, binaan dia kemas dan sangat praktikal untuk kegunaan harian.`;
    } else {
      coreMessage = `Korang tengok ${name} ni, kemasan bungkusan dia berkualiti dan praktikal untuk kegunaan harian.`;
    }

    // Append CTA only if requested and not already present
    if (ctaMode === 'spoken_button') {
      return `${coreMessage} Tekan butang di bawah untuk maklumat lanjut.`;
    } else if (ctaMode === 'spoken_bio') {
      return `${coreMessage} Boleh tengok pautan di bio sekarang.`;
    }

    return coreMessage;
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

    // 1. RunningHub Strict Zero-Speech Rule
    if (engine === 'runninghub') {
      if (script && script.trim().length > 0) {
        errors.push('Gaya RunningHub 15 saat tidak dibenarkan mengandungi sebarang skrip pertuturan.');
      }
      return { isValid: errors.length === 0, errors, wordCount: 0 };
    }

    const cleanScript = script.trim();
    if (!cleanScript) {
      return { isValid: true, errors: [], wordCount: 0 };
    }

    const words = cleanScript.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // 2. Length validation (10s video target: 8-26 words realistic speech speed)
    if (wordCount < 6) {
      errors.push('Skrip terlalu pendek untuk durasi 10 saat (minimum 6 perkataan).');
    } else if (wordCount > 28) {
      errors.push(`Skrip terlalu panjang (${wordCount} perkataan). Maksimum disyorkan untuk 10 saat ialah 26 perkataan agar pertuturan tidak terkejar-kejar.`);
    }

    // 3. Prohibited Indonesian vocabulary check
    const lower = cleanScript.toLowerCase();
    for (const badWord of PROHIBITED_INDONESIAN_WORDS) {
      const regex = new RegExp(`\\b${badWord}\\b`, 'i');
      if (regex.test(lower)) {
        errors.push(`Perkataan slanga Indonesia dilarang: "${badWord}". Gunakan Bahasa Melayu standard Malaysia.`);
      }
    }

    // 4. Fabricated personal claims check
    for (const pattern of PROHIBITED_FABRICATED_PATTERNS) {
      if (pattern.test(lower)) {
        errors.push('Klaim peribadi atau janji keberkesanan tidak berasas dilarang untuk pematuhan iklan tulen.');
      }
    }

    // 5. Inappropriate verb for food check
    const isFood =
      product.category.toLowerCase().includes('makanan') ||
      product.category.toLowerCase().includes('masakan') ||
      product.name.toLowerCase().includes('sambal');

    if (isFood && /\bpakai\b/i.test(lower)) {
      errors.push('Penggunaan kata kerja "pakai" tidak sesuai untuk produk makanan. Gunakan "rasa", "makan", "hidang", atau "nikmati".');
    }

    // 6. Duplicate CTA detection
    const hasButtonCta = /tekan butang/i.test(lower);
    const hasBioCta = /link di bio|pautan di bio/i.test(lower);
    if (hasButtonCta && hasBioCta) {
      errors.push('Terdapat arahan CTA berganda yang bercanggah (tekan butang dan link di bio). Sila pilih satu CTA sahaja.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      wordCount,
    };
  }
}
