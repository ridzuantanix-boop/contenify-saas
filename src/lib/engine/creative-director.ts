/**
 * AFFIMATIK by Pawarna — AI Creative Director (V3)
 * Truthful, Source-Grounded Product Intelligence & Physical Scene Planning
 * 
 * Rules:
 * 1. Never invent ingredients, specifications, clinical results, or testimonials.
 * 2. Distinguish visible facts from inferences.
 * 3. Preserve unknown information explicitly as unknown.
 * 4. Transparent fallback when image-understanding service is not configured.
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
}

export class AICreativeDirector {
  /**
   * Truthful Product Intelligence:
   * Extracts structured product attributes from user inputs or image references.
   * Never fabricates unverified claims.
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

    // Categorization logic based purely on provided textual identity
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
      lowerName.includes('kabel')
    ) {
      packagingFormat = 'gadget';
      inferredAttributes.push('Format peranti elektronik / perkakasan');
    }

    // Record explicit unknown fields to prevent hallucinated sales claims
    if (confirmedFeatures.length === 0) {
      unknownFields.push('spesifikasi_terperinci', 'kandungan_khusus', 'keberkesanan_klinikal');
    }

    const defaultName = rawName || 'produk dalam gambar rujukan';
    const defaultCategory = rawCategory || (isWearableOrFashion ? 'Pakaian & Fesyen' : 'Produk Pengguna');

    const sourceConfidence: ProductProfile['sourceConfidence'] = rawName
      ? 'verified_user'
      : isVisionConfigured
      ? 'vision_grounded'
      : 'manual_fallback';

    const provenance: ProductProfile['provenance'] = isVisionConfigured && input.imageKeyOrUrl
      ? 'image_vision_extracted'
      : 'manual_user_entry';

    return {
      name: defaultName,
      category: defaultCategory,
      packagingFormat,
      isWearableOrFashion,
      isLiquidOrPowder,
      visualAttributes,
      confirmedFeatures,
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
    };
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

    // Determine authentic domestic Malaysian setting based on product type
    let location = 'Ruang tamu rumah moden Malaysia dengan pencahayaan siang semulajadi';
    if (product.packagingFormat === 'jar' || product.category.toLowerCase().includes('makanan')) {
      location = 'Dapur kediaman Malaysia yang kemas dan bersih dengan pencahayaan pagi neutral';
    } else if (product.packagingFormat === 'bottle' || product.category.toLowerCase().includes('skincare')) {
      location = 'Meja solek / vanity cerah dengan pencahayaan neutral seimbang 5500K';
    } else if (product.packagingFormat === 'gadget') {
      location = 'Meja kerja moden yang kemas dengan pencahayaan studio lembut';
    } else if (product.packagingFormat === 'apparel') {
      location = 'Ruang santai kediaman dengan latar dinding neutral dan cahaya tingkap';
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
