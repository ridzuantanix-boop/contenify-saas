/**
 * AFFIMATIK by Pawarna — Voiceover Director & Script Truthfulness Engine (GEMS Masterprompt V5.0)
 * Generates and validates natural, authentic Malaysian Malay spoken scripts for 10-second videos.
 * 
 * Strict Quality Guardrails:
 * 1. 10-second timing budget: strictly 14 to 23 spoken Malaysian Malay words (bounds 12-26).
 * 2. Distinct style-specific hook engines and sales flows for NX01, NX02, NX03, NX05, NX07, NX09, NX10.
 * 3. Zero packaging-focused fallback scripts (never treat bottles, boxes, labels, or packaging as the main selling point).
 * 4. Grounded in Product Brain evidence (uses confirmed features or safe honest category functions).
 * 5. Strictly NO Indonesian loanwords or slang.
 * 6. Strictly NO fabricated personal testimony or unsupported medical/cosmetic overclaims.
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
  /aku dah cuba/i,
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

export const FORBIDDEN_PACKAGING_PROPOSITIONS = [
  /tengok (packaging|bungkusan|botol|kotak|rekaan) dia kemas/i,
  /botol ni cantik/i,
  /label ni mudah dibaca/i,
  /rekaan bungkusan nampak premium/i,
  /kemasan bungkusan/i,
] as const;

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  wordCount: number;
}

export class VoiceoverDirector {
  /**
   * Generates a truthful, style-specific conversational Malaysian Malay script (14-23 words target)
   * Adheres to AFFIMATIK GEMS MASTERPROMPTS V5.0:
   * - NX01: Sembang Kawan (Situation-based familiar opening)
   * - NX02: Review Sambil Pegang (Direct product function in first 1.5s)
   * - NX03: First Impression (Curiosity at noteworthy confirmed fact)
   * - NX05: Masalah Seharian (Plausible buyer problem -> solution)
   * - NX07: Soalan & Jawapan (Direct buyer question answered by verified fact)
   * - NX09: Goyang Produk + VO (Off-camera usage context narration)
   * - NX10: Label Talk (Verified facts and utility first, no bottle filler)
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

    // Ensure clean shortName without double "ni"
    let shortName = (product.spokenShortName || 'produk ni').trim();
    if (!shortName.endsWith(' ni')) {
      shortName = `${shortName} ni`;
    }

    const vIdx = Math.abs(Math.floor(variationIndex)) % 3;

    // Resolve confirmed feature/benefit or crisp honest literal category function
    let feature = '';
    if (product.confirmedFeatures && product.confirmedFeatures.length > 0) {
      feature = product.confirmedFeatures[0].toLowerCase().trim().replace(/[.,;]+$/, '');
    } else {
      const cat = product.category.toLowerCase();
      if (cat.includes('makan') || cat.includes('masak')) {
        feature = 'pelengkap hidangan harian';
      } else if (cat.includes('skin') || cat.includes('cantik')) {
        feature = 'melembapkan kulit harian';
      } else if (cat.includes('tudung') || cat.includes('fesyen')) {
        feature = 'mudah dibentuk dan kemas';
      } else if (cat.includes('gadget') || cat.includes('elektronik')) {
        feature = 'memudahkan kerja harian';
      } else {
        feature = 'kegunaan praktikal harian';
      }
    }

    // Format feature naturally & concisely
    let featureFormatted = feature;
    if (featureFormatted.startsWith('mempunyai ')) {
      featureFormatted = featureFormatted.replace(/^mempunyai\s+/, 'ada ');
    } else if (featureFormatted.startsWith('sedia ')) {
      // keep "sedia dimakan terus"
    } else if (!featureFormatted.startsWith('ada ') && !featureFormatted.startsWith('ia ') && !featureFormatted.startsWith('untuk ') && !featureFormatted.startsWith('boleh ') && !featureFormatted.startsWith('sesuai ')) {
      if (/^\d+\s*tahap|mod/i.test(featureFormatted)) {
        featureFormatted = `ada ${featureFormatted}`;
      } else if (!/^(membantu|mengekalkan|memberikan|menanggalkan|memudahkan|menyokong)/i.test(featureFormatted)) {
        featureFormatted = `sesuai untuk ${featureFormatted}`;
      }
    }

    // Truncate long feature descriptions if they exceed 6 words to maintain 10s spoken budget
    const featureWords = featureFormatted.split(/\s+/);
    if (featureWords.length > 6) {
      featureFormatted = featureWords.slice(0, 6).join(' ');
    }

    // Crisp, short context & problem
    let context = 'harian';
    const cat = product.category.toLowerCase();
    if (cat.includes('makan') || cat.includes('masak')) context = 'waktu makan';
    else if (cat.includes('skin') || cat.includes('cantik')) context = 'rutin diri';
    else if (cat.includes('tudung') || cat.includes('fesyen')) context = 'keluar rumah';
    else if (cat.includes('gadget') || cat.includes('elektronik')) context = 'waktu kerja';
    else if (cat.includes('rumah') || cat.includes('home')) context = 'ruang rumah';

    let problem = 'mencari pilihan sesuai';
    if (cat.includes('makan') || cat.includes('masak')) problem = 'perlukan lauk ringkas';
    else if (cat.includes('skin') || cat.includes('cantik')) problem = 'kulit rasa kering';
    else if (cat.includes('tudung') || cat.includes('fesyen')) problem = 'tudung susah bentuk';
    else if (cat.includes('gadget') || cat.includes('elektronik')) problem = 'bateri cepat habis';

    let qaQuestion = `Ada kelebihan menarik pada ${shortName}?`;
    if (product.allowedQaQuestion) {
      qaQuestion = product.allowedQaQuestion;
    }

    let coreSentence = '';

    switch (style.id) {
      // -----------------------------------------------------------------------
      // NX01: Sembang Kawan
      // Hook: Situation-based familiar opening: "Kalau korang [SITUASI]..." or "Yang tengah [AKTIVITI]..."
      // Flow: User situation -> introduce product early -> supported benefit -> why helpful -> CTA
      // Target: 14-23 words with CTA
      // -----------------------------------------------------------------------
      case 'NX01': {
        const variants = [
          `Kalau korang selalu sibuk ${context}, ${shortName} ${featureFormatted}. Boleh guna ikut keselesaan.`,
          `Yang tengah cari kemudahan untuk ${context}, ${shortName} ${featureFormatted}. Memang praktikal.`,
          `Kalau korang perlukan kemudahan masa ${context}, ${shortName} ${featureFormatted}. Sangat menyenangkan.`,
        ];
        coreSentence = variants[vIdx];
        break;
      }

      // -----------------------------------------------------------------------
      // NX02: Review Sambil Pegang
      // Hook: Start with explicit product + user function within first 1.5s: "[PRODUK] ni untuk [TUJUAN]..."
      // Flow: What product does -> verified feature/benefit -> practical translation -> soft CTA
      // Target: 14-23 words with CTA
      // -----------------------------------------------------------------------
      case 'NX02': {
        const capitalizedShort = shortName.charAt(0).toUpperCase() + shortName.slice(1);
        const variants = [
          `${capitalizedShort} ${featureFormatted}. Korang boleh guna masa ${context}. Nak tengok lebih lanjut?`,
          `${capitalizedShort} untuk ${context}. Ciri ${featureFormatted} memang praktikal untuk kegunaan seharian.`,
          `${capitalizedShort} ${featureFormatted}. Sangat sesuai untuk mudahkan urusan masa ${context}.`,
        ];
        coreSentence = variants[vIdx];
        break;
      }

      // -----------------------------------------------------------------------
      // NX03: First Impression
      // Hook: “Eh, [PRODUK] ni [FAKTA]...” / “Oh, yang ni rupanya [FAKTA]...”
      // Flow: Mild curiosity at noteworthy confirmed fact -> practical benefit -> CTA
      // Target: 14-23 words with CTA
      // -----------------------------------------------------------------------
      case 'NX03': {
        const variants = [
          `Eh, ${shortName} rupanya ${featureFormatted}. Boleh guna masa ${context}. Nak tengok?`,
          `Oh, yang ni rupanya ${featureFormatted}. Memang membantu untuk aktiviti seharian. Nak tahu lanjut?`,
          `Eh, menarik fungsi ${shortName}, ${featureFormatted} untuk mudahkan urusan masa ${context}.`,
        ];
        coreSentence = variants[vIdx];
        break;
      }

      // -----------------------------------------------------------------------
      // NX05: Masalah Seharian
      // Hook: Ask one specific plausible buyer question: "[MASALAH]? [PRODUK]..."
      // Flow: Relatable problem -> lift product -> supported feature -> practical outcome -> CTA
      // Target: 14-23 words with CTA
      // -----------------------------------------------------------------------
      case 'NX05': {
        const capitalizedShort = shortName.charAt(0).toUpperCase() + shortName.slice(1);
        const variants = [
          `${problem.charAt(0).toUpperCase() + problem.slice(1)}? ${capitalizedShort} ${featureFormatted} untuk selesaikan situasi tu.`,
          `Kerap hadapi masalah masa ${context}? ${capitalizedShort} ${featureFormatted} untuk mudahkan hari korang.`,
          `Selalu pening masa ${context}? ${capitalizedShort} ${featureFormatted} untuk bantu keperluan korang.`,
        ];
        coreSentence = variants[vIdx];
        break;
      }

      // -----------------------------------------------------------------------
      // NX07: Soalan & Jawapan
      // Hook: Direct spoken question at 0s: "[SOALAN_SEBENAR]?"
      // Flow: Question at 0-2s -> direct honest answer -> practical context -> CTA
      // Target: 14-23 words with CTA
      // -----------------------------------------------------------------------
      case 'NX07': {
        const variants = [
          `${qaQuestion} Ya, model ni ${featureFormatted}. Kalau nak tengok detail,`,
          `${qaQuestion} Betul, ${shortName} ${featureFormatted}. Kalau nak tahu info lanjut,`,
          `Ada yang tanya pasal ${shortName}? Ya, produk ni ${featureFormatted}.`,
        ];
        coreSentence = variants[vIdx];
        break;
      }

      // -----------------------------------------------------------------------
      // NX09: Goyang Produk + VO
      // Hook: VO begins with product purpose/use case immediately off-camera
      // Flow: Purpose -> confirmed benefit -> relevant daily context -> CTA
      // Target: 14-23 words with CTA
      // -----------------------------------------------------------------------
      case 'NX09': {
        const variants = [
          `Untuk ${context}, ${shortName} ${featureFormatted}. Korang boleh guna bila-bila masa. Kalau berminat,`,
          `Bagi kemudahan masa ${context}, ${shortName} ${featureFormatted}. Sangat praktikal untuk rutin seharian.`,
          `Untuk keperluan ${context}, ${shortName} ${featureFormatted}. Memang menyenangkan urusan korang.`,
        ];
        coreSentence = variants[vIdx];
        break;
      }

      // -----------------------------------------------------------------------
      // NX10: Label Talk (Fakta & Fungsi Dulu)
      // Hook: "Yang penting tentang [PRODUK], [FUNGSI/FAKTA]..."
      // Flow: Actual verified feature/benefit first -> translate to customer use -> CTA
      // Target: 14-23 words with CTA
      // -----------------------------------------------------------------------
      case 'NX10': {
        const variants = [
          `Yang penting tentang ${shortName}, ia ${featureFormatted}. Jadi korang boleh guna bila-bila masa.`,
          `Fakta utama tentang ${shortName}, ada ciri ${featureFormatted} yang sangat membantu untuk kegunaan harian.`,
          `Perkara utama tentang ${shortName}, ia ${featureFormatted} untuk memastikan keselesaan korang semasa ${context}.`,
        ];
        coreSentence = variants[vIdx];
        break;
      }

      default: {
        coreSentence = `Bagi kemudahan masa ${context}, ${shortName} ${featureFormatted} untuk kegunaan harian.`;
        break;
      }
    }

    // Append light verbal CTA according to mode
    if (ctaMode === 'spoken_button') {
      return `${coreSentence} Tekan butang di bawah.`;
    } else if (ctaMode === 'spoken_bio') {
      return `${coreSentence} Boleh tengok pautan di bio.`;
    }

    return coreSentence;
  }

  /**
   * Deterministic script validator
   * Strictly enforces 14-23 target words, no Indonesian loanwords, no fabricated claims,
   * and no packaging-filler selling propositions.
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

    // Strict 10-second budget: between 12 and 26 words (target 14-23 words)
    if (wordCount < 12) {
      errors.push(`Skrip terlalu pendek (${wordCount} patah perkataan). Minimum 12 perkataan untuk video 10 saat.`);
    } else if (wordCount > 26) {
      errors.push(`Skrip terlalu panjang (${wordCount} patah perkataan). Had maksimum 26 perkataan agar sebutan tidak laju atau terpotong.`);
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

    // Check forbidden packaging propositions as the primary selling proposition
    for (const pattern of FORBIDDEN_PACKAGING_PROPOSITIONS) {
      if (pattern.test(lower)) {
        errors.push('Penerangan tentang bungkusan, botol, atau packaging dilarang sebagai idea jualan utama skrip. Fokus pada fungsi dan manfaat produk.');
        break;
      }
    }

    // Check inappropriate verbs for food
    const isFood = (product.category || '').toLowerCase().includes('makan') || product.packagingFormat === 'jar' || product.packagingFormat === 'pouch';
    if (isFood && /\bpakai\b/i.test(lower)) {
      errors.push('Penggunaan kata kerja "pakai" tidak sesuai untuk produk makanan. Gunakan "hidang", "makan", atau "nikmati".');
    }

    // Check unverified clinical claims
    const facts = product.confirmedFeatures || product.verifiedBenefits || (product as any).verifiedFacts || [];
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
