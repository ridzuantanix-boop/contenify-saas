/**
 * AFFIMATIK by Pawarna — AI Creative Director (GEMS Masterprompt V5.0)
 * Truthful, Source-Grounded Product Intelligence & Physical Scene Planning
 * 
 * Rules:
 * 1. Never invent ingredients, specifications, clinical results, or testimonials.
 * 2. Distinguish visible facts from inferences.
 * 3. Preserve unknown information explicitly as unknown.
 * 4. Transparent fallback when image-understanding service is not configured.
 * 5. Authors concise, natural spoken aliases and grounded category functions.
 */

import { ProductProfile, ScenePlan, ProductVisualAttributes } from './types';
import { VideoStyle } from '../styles/types';

export interface ProductInputParams {
  productName?: string;
  productCategory?: string;
  productFacts?: string[] | string;
  imageKeyOrUrl?: string;
  visualAttributes?: ProductVisualAttributes;
  intendedAudience?: string;
  targetBuyer?: string;
  buyerProblem?: string;
  usageContext?: string;
}

export class AICreativeDirector {
  /**
   * Generates a natural, spoken Malaysian short alias for a product
   * e.g. "Lampu Meja LED 3 Mod" -> "lampu meja ni"
   * e.g. "Hydra-Boost Face Serum 30ml" -> "serum muka ni"
   * e.g. "Sambal Garing Ikan Bilis Bonda" -> "sambal ni"
   * e.g. "Tudung Bawal Cotton Voile" -> "tudung bawal ni"
   * e.g. "Ultra-Slim 20000mAh Powerbank" -> "powerbank ni"
   */
  static deriveSpokenShortName(rawName: string, category: string): string {
    const trimmed = (rawName || '').trim();
    if (!trimmed) {
      if (category.toLowerCase().includes('makan')) return 'makanan ni';
      if (category.toLowerCase().includes('skin') || category.toLowerCase().includes('cantik')) return 'serum ni';
      if (category.toLowerCase().includes('tudung') || category.toLowerCase().includes('fesyen')) return 'tudung ni';
      if (category.toLowerCase().includes('gadget') || category.toLowerCase().includes('elektronik')) return 'gajet ni';
      return 'produk ni';
    }

    const lower = trimmed.toLowerCase();

    // Specific product pattern recognitions
    if (lower.includes('lampu meja') || lower.includes('lampu study')) return 'lampu meja ni';
    if (lower.includes('lampu')) return 'lampu ni';
    if (lower.includes('sambal')) return 'sambal ni';
    if (lower.includes('serum')) return lower.includes('muka') || lower.includes('face') ? 'serum muka ni' : 'serum ni';
    if (lower.includes('cleanser') || lower.includes('pencuci muka')) return 'pencuci muka ni';
    if (lower.includes('pencuci pinggan')) return 'pencuci pinggan ni';
    if (lower.includes('syampu') || lower.includes('shampoo')) return 'syampu ni';
    if (lower.includes('tudung bawal') || lower.includes('bawal')) return 'tudung bawal ni';
    if (lower.includes('shawl')) return 'shawl ni';
    if (lower.includes('tudung')) return 'tudung ni';
    if (lower.includes('powerbank')) return 'powerbank ni';
    if (lower.includes('fon telinga') || lower.includes('earbuds') || lower.includes('headphone')) return 'earbuds ni';
    if (lower.includes('kicap')) return 'kicap ni';
    if (lower.includes('kerepek') || lower.includes('keropok')) return 'kudapan ni';
    if (lower.includes('kopi')) return 'kopi ni';
    if (lower.includes('minyak angin') || lower.includes('aromaterapi') || lower.includes('minyak bidara')) return 'minyak bidara ni';

    // If already short (1 or 2 words), use it with "ni"
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= 2) {
      return `${trimmed.toLowerCase()} ni`;
    }

    // Strip generic model numbers, capacities, ml, grams, etc.
    const cleaned = words
      .filter((w) => !/^\d+(ml|g|kg|mah|w|v|pcs|cm|mm)$/i.test(w) && !/^[0-9]+$/i.test(w))
      .slice(0, 2)
      .join(' ')
      .toLowerCase();

    return `${cleaned} ni`;
  }

  /**
   * Truthful Product Intelligence:
   * Extracts structured product attributes from user inputs or image references.
   * Adheres to GEMS Masterprompt Pack V5.0.
   */
  static extractProductProfile(input: ProductInputParams): ProductProfile {
    const rawName = input.productName?.trim();
    const rawCategory = input.productCategory?.trim() || '';
    
    // Parse facts from array or newline/comma separated string
    let userFacts: string[] = [];
    if (Array.isArray(input.productFacts)) {
      userFacts = input.productFacts.map((f) => f.trim()).filter(Boolean);
    } else if (typeof input.productFacts === 'string' && input.productFacts.trim().length > 0) {
      userFacts = input.productFacts
        .split(/[\n,;]+/)
        .map((f) => f.trim())
        .filter(Boolean);
    }

    const lowerName = (rawName || '').toLowerCase();
    const lowerCat = rawCategory.toLowerCase();

    // Check whether an active image understanding API is configured in the environment
    const isVisionConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);

    // Initialise structured visual attributes
    const visualAttributes: ProductVisualAttributes = input.visualAttributes || {};
    const confirmedFeatures: string[] = [...userFacts];
    const inferredAttributes: string[] = [];
    const unknownFields: string[] = [];

    let packagingFormat: ProductProfile['packagingFormat'] = 'general';
    let isWearableOrFashion = false;
    let isLiquidOrPowder = false;

    // Derived category and formatting logic based purely on provided textual identity
    if (
      lowerCat.includes('tudung') ||
      lowerCat.includes('baju') ||
      lowerCat.includes('pakaian') ||
      lowerCat.includes('fashion') ||
      lowerCat.includes('fesyen') ||
      lowerName.includes('tudung') ||
      lowerName.includes('hijab') ||
      lowerName.includes('shawl') ||
      lowerName.includes('jubah')
    ) {
      packagingFormat = 'apparel';
      isWearableOrFashion = true;
      inferredAttributes.push('Produk kategori pakaian / tekstil');
    } else if (
      lowerName.includes('serum') ||
      lowerName.includes('lotion') ||
      lowerName.includes('syampu') ||
      lowerName.includes('spray') ||
      lowerName.includes('toner') ||
      lowerName.includes('cecair') ||
      lowerName.includes('pencuci') ||
      lowerName.includes('minyak') ||
      lowerCat.includes('skincare') ||
      lowerCat.includes('kecantikan')
    ) {
      packagingFormat = 'bottle';
      isLiquidOrPowder = true;
      inferredAttributes.push('Format botol atau bekas cecair / krim');
    } else if (
      lowerName.includes('sambal') ||
      lowerName.includes('kicap') ||
      lowerName.includes('sos') ||
      lowerName.includes('pes') ||
      lowerName.includes('jem')
    ) {
      packagingFormat = 'jar';
      isLiquidOrPowder = true;
      inferredAttributes.push('Format balang / bekas makanan');
    } else if (
      lowerName.includes('kerepek') ||
      lowerName.includes('kudapan') ||
      lowerName.includes('snack') ||
      lowerName.includes('kopi') ||
      lowerName.includes('teh')
    ) {
      packagingFormat = 'pouch';
      inferredAttributes.push('Format bungkusan pouch / pek makanan');
    } else if (
      lowerCat.includes('elektronik') ||
      lowerCat.includes('gadget') ||
      lowerCat.includes('aksesori') ||
      lowerName.includes('powerbank') ||
      lowerName.includes('fon') ||
      lowerName.includes('charger') ||
      lowerName.includes('kabel') ||
      lowerName.includes('lampu')
    ) {
      packagingFormat = 'gadget';
      inferredAttributes.push('Format peranti elektronik / perkakasan');
    }

    // Safe Core Function & Usage Context Grounding (Table 5 of 01_PRODUCT_AND_SCRIPT_BRAIN.md)
    let coreFunction = 'kegunaan dan keperluan seharian';
    let usageContext = input.usageContext || 'kegunaan harian';
    let buyerProblem = input.buyerProblem || 'mencari pilihan praktikal untuk keperluan harian';
    let allowedQaQuestion = '';

    if (isWearableOrFashion || packagingFormat === 'apparel') {
      coreFunction = 'dipakai dan digayakan untuk penampilan kemas serta selesa';
      usageContext = input.usageContext || 'aktiviti harian dan majlis santai';
      buyerProblem = input.buyerProblem || 'tudung sukar dibentuk atau kurang selesa dipakai lama';
      allowedQaQuestion = 'Tudung ni senang dibentuk dan selesa ke?';
    } else if (packagingFormat === 'jar' || packagingFormat === 'pouch' || lowerCat.includes('makan') || lowerCat.includes('masak')) {
      coreFunction = 'dihidang sebagai pelengkap hidangan bersama sajian utama';
      usageContext = input.usageContext || 'dapur dan waktu makan';
      buyerProblem = input.buyerProblem || 'perlukan sajian ringkas dan cepat untuk hidangan makan';
      allowedQaQuestion = 'Sajian ni sedia dimakan terus ke?';
    } else if (packagingFormat === 'bottle' || lowerCat.includes('skin') || lowerCat.includes('cantik') || lowerCat.includes('diri')) {
      coreFunction = 'digunakan dalam rutin membersih atau melembapkan diri mengikut keperluan';
      usageContext = input.usageContext || 'rutin penjagaan diri';
      buyerProblem = input.buyerProblem || 'kulit perlukan kelembapan dan penjagaan yang konsisten';
      allowedQaQuestion = 'Produk ni sesuai untuk kegunaan harian ke?';
    } else if (packagingFormat === 'gadget' || lowerCat.includes('gadget') || lowerCat.includes('elektronik')) {
      if (lowerName.includes('lampu')) {
        coreFunction = 'menerangi ruang meja belajar atau meja kerja';
        usageContext = input.usageContext || 'meja belajar dan ruang kerja';
        buyerProblem = input.buyerProblem || 'meja belajar perlukan pencahayaan yang sesuai';
        allowedQaQuestion = 'Lampu ni boleh ubah tahap cahaya ke?';
      } else if (lowerName.includes('powerbank')) {
        coreFunction = 'mengecas peranti bila berada di luar atau travel';
        usageContext = input.usageContext || 'perjalanan dan waktu travel';
        buyerProblem = input.buyerProblem || 'bateri peranti cepat habis waktu travel';
        allowedQaQuestion = 'Powerbank ni menyokong pengecasan pantas ke?';
      } else {
        coreFunction = 'melaksanakan fungsi teknikal untuk memudahkan urusan harian';
        usageContext = input.usageContext || 'meja kerja dan kegunaan seharian';
        buyerProblem = input.buyerProblem || 'perlukan peranti yang praktikal dan mudah dikendalikan';
        allowedQaQuestion = 'Peranti ni praktikal untuk kegunaan kerja ke?';
      }
    } else if (lowerCat.includes('rumah') || lowerCat.includes('home')) {
      coreFunction = 'kegunaan dan kemudahan praktikal di rumah';
      usageContext = input.usageContext || 'ruang rumah dan dapur';
      buyerProblem = input.buyerProblem || 'urusan rumah perlukan penyelesaian yang lebih memudahkan';
      allowedQaQuestion = 'Barang ni memudahkan urusan di rumah ke?';
    }

    // Dynamic Q&A question specialization if a specific confirmed feature is available
    if (confirmedFeatures.length > 0) {
      const topFeature = confirmedFeatures[0];
      if (/tahap kecerahan|mod|cahaya/i.test(topFeature)) {
        allowedQaQuestion = 'Lampu ni boleh ubah tahap cahaya ke?';
      } else if (/pedas|rangup|bilis/i.test(topFeature)) {
        allowedQaQuestion = 'Sambal ni sedap dan rangup ke?';
      } else if (/bentuk|kain|voile/i.test(topFeature)) {
        allowedQaQuestion = 'Tudung ni senang bentuk ke?';
      } else if (/cas|charging|pantas/i.test(topFeature)) {
        allowedQaQuestion = 'Powerbank ni cas laju ke?';
      } else if (/lembap|hydrat/i.test(topFeature)) {
        allowedQaQuestion = 'Serum ni membantu melembapkan kulit ke?';
      }
    }

    // Record explicit unknown fields to prevent hallucinated sales claims
    if (confirmedFeatures.length === 0) {
      unknownFields.push('spesifikasi_terperinci', 'kandungan_khusus', 'keberkesanan_klinikal');
    }

    const defaultName = rawName || 'produk dalam gambar rujukan';
    const defaultCategory = rawCategory || (isWearableOrFashion ? 'Pakaian & Fesyen' : 'Produk Pengguna');
    const spokenShortName = this.deriveSpokenShortName(defaultName, defaultCategory);

    const hasRealVisionAttributes = Boolean(
      input.visualAttributes && Object.keys(input.visualAttributes).length > 0
    );

    const sourceConfidence: ProductProfile['sourceConfidence'] = hasRealVisionAttributes
      ? 'vision_grounded'
      : rawName
      ? 'verified_user'
      : 'manual_fallback';

    const provenance: ProductProfile['provenance'] = hasRealVisionAttributes
      ? 'image_vision_extracted'
      : 'manual_user_entry';

    return {
      name: defaultName,
      spokenShortName,
      category: defaultCategory,
      packagingFormat,
      isWearableOrFashion,
      isLiquidOrPowder,
      visualAttributes,
      targetBuyer: input.targetBuyer || 'Pengguna Malaysia yang mementingkan pilihan praktikal',
      buyerProblem,
      coreFunction,
      usageContext,
      allowedQaQuestion,
      confirmedFeatures,
      verifiedBenefits: confirmedFeatures,
      verifiedFacts: confirmedFeatures,
      inferredAttributes,
      unknownFields,
      intendedAudience: input.intendedAudience || 'Pengguna umum Malaysia',
      approvedClaims: confirmedFeatures,
      prohibitedClaims: [
        'Penyembuh 100% penyakit kronik',
        'Kesan serta merta tanpa usaha',
        'Diskaun palsu / harga tidak sah',
        'Testimoni peribadi ciptaan',
        'Dakwaan klinikal tanpa ujian makmal',
      ],
      sourceConfidence,
      provenance,
      isVisionSupported: isVisionConfigured,
      productionProfile: 'REALISTIC_UGC',
    };
  }

  /**
   * Genuine Server-Side Image Understanding
   * Only returns analyzed = true when an active vision API actually extracts observations.
   */
  static async analyzeProductImage(imageKeyOrUrl: string): Promise<{
    analyzed: boolean;
    reason?: string;
    attributes?: ProductVisualAttributes;
    observedName?: string;
    observedCategory?: string;
    observedBrand?: string;
  }> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return { analyzed: false, reason: 'vision_service_not_configured' };
    }

    if (!imageKeyOrUrl || typeof imageKeyOrUrl !== 'string') {
      return { analyzed: false, reason: 'invalid_image_source' };
    }

    try {
      let imagePart: any;
      if (imageKeyOrUrl.startsWith('data:image/')) {
        const [meta, base64] = imageKeyOrUrl.split(';base64,');
        const mimeType = meta.replace('data:', '') || 'image/jpeg';
        imagePart = { inlineData: { data: base64, mimeType } };
      } else if (imageKeyOrUrl.startsWith('http://') || imageKeyOrUrl.startsWith('https://')) {
        const imgRes = await fetch(imageKeyOrUrl);
        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
        const buf = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buf).toString('base64');
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
        imagePart = { inlineData: { data: base64, mimeType } };
      } else {
        return { analyzed: false, reason: 'unsupported_image_protocol' };
      }

      const prompt = `Analyze this product image and output strict JSON:
{"productName": "string or null", "brand": "string or null", "category": "Skincare|Food|Apparel|Electronics|Household", "packagingType": "bottle|box|pouch|tube|jar|apparel|gadget|general", "visibleColors": ["color"], "shapeDescription": "string", "physicalForm": "liquid|powder|cream|solid|fabric|electronic|packaged"}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [imagePart, { text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!res.ok) return { analyzed: false, reason: `gemini_api_error_${res.status}` };
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { analyzed: false, reason: 'empty_gemini_response' };

      const parsed = JSON.parse(text);
      return {
        analyzed: true,
        observedName: parsed.productName || undefined,
        observedCategory: parsed.category || undefined,
        observedBrand: parsed.brand || undefined,
        attributes: {
          packagingType: parsed.packagingType,
          shapeDescription: parsed.shapeDescription,
          visibleColors: parsed.visibleColors,
          physicalForm: parsed.physicalForm,
        },
      };
    } catch {
      return { analyzed: false, reason: 'vision_analysis_exception' };
    }
  }

  /**
   * Visual Scene Planner: Creates an authentic, physical scene plan
   */
  static createScenePlan(
    product: ProductProfile,
    style: VideoStyle,
    options?: {
      locationOverride?: string;
      modestyLock?: boolean;
    }
  ): ScenePlan {
    const plan = style.actionPlan;

    // Authentic domestic Malaysian setting aligned with style and product
    let location = 'Ruang tamu rumah moden Malaysia dengan pencahayaan siang semulajadi';
    if (product.packagingFormat === 'jar' || product.category.toLowerCase().includes('makanan')) {
      location = 'Dapur kediaman Malaysia yang kemas dan bersih dengan pencahayaan pagi neutral';
    } else if (product.packagingFormat === 'bottle' || product.category.toLowerCase().includes('skincare')) {
      location = 'Meja solek / vanity cerah dengan pencahayaan neutral seimbang 5500K';
    } else if (product.packagingFormat === 'gadget' || style.id === 'RH17') {
      location = 'Meja kerja moden yang kemas dengan pencahayaan studio lembut';
    } else if (style.id === 'RH19') {
      location = 'Kawasan tepi tingkap kediaman Malaysia dengan cahaya siang neutral semulajadi';
    } else if (product.packagingFormat === 'apparel') {
      location = 'Ruang santai kediaman dengan latar neutral dan cahaya tingkap semulajadi';
    }

    if (options?.locationOverride) {
      location = options.locationOverride;
    }

    return {
      mainSubject: `Produk fizikal ${product.name}`,
      location,
      lighting: 'Pencahayaan semulajadi siang hari (neutral daylight 5500K), tiada bayang kasar',
      cameraDistance: plan.cameraMovement.includes('hand') ? 'Paras dada (medium close-up)' : 'Paras mata (eye-level normal 1x)',
      cameraMovement: plan.cameraMovement,
      startPose: plan.startPose,
      actionProgression: plan.actionProgression,
      endPose: plan.endPose,
      primaryAction: plan.primaryAction,
      audioPolicy: style.audioMode,
      targetDurationSeconds: style.durationSeconds,
    };
  }
}
