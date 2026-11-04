/**
 * AFFIMATIK by Pawarna — AI Creative Director
 * Responsible for Product Intelligence extraction and Scene Planning
 */

import { ProductProfile, ScenePlan } from './types';
import { VideoStyle } from '../styles/types';

export interface ProductInputParams {
  productName?: string;
  productCategory?: string;
  productFacts?: string[];
  imageKeyOrUrl?: string;
}

export class AICreativeDirector {
  /**
   * Product Intelligence: Extracts structured product attributes from user inputs or image references
   */
  static extractProductProfile(input: ProductInputParams): ProductProfile {
    const rawName = input.productName?.trim();
    const rawCategory = input.productCategory?.trim() || '';
    const rawFacts = input.productFacts || [];

    // Detect format from category / keywords
    const lowerName = (rawName || '').toLowerCase();
    const lowerCat = rawCategory.toLowerCase();

    let packagingFormat: ProductProfile['packagingFormat'] = 'general';
    let isWearableOrFashion = false;
    let isLiquidOrPowder = false;

    if (
      lowerCat.includes('tudung') ||
      lowerCat.includes('baju') ||
      lowerCat.includes('pakaian') ||
      lowerCat.includes('fashion') ||
      lowerName.includes('tudung') ||
      lowerName.includes('hijab') ||
      lowerName.includes('shawl')
    ) {
      packagingFormat = 'apparel';
      isWearableOrFashion = true;
    } else if (
      lowerName.includes('serum') ||
      lowerName.includes('lotion') ||
      lowerName.includes('syampu') ||
      lowerName.includes('spray') ||
      lowerCat.includes('skincare') ||
      lowerCat.includes('kecantikan')
    ) {
      packagingFormat = 'bottle';
      isLiquidOrPowder = true;
    } else if (
      lowerName.includes('sambal') ||
      lowerName.includes('kicap') ||
      lowerName.includes('sos') ||
      lowerName.includes('pes')
    ) {
      packagingFormat = 'jar';
      isLiquidOrPowder = true;
    } else if (
      lowerName.includes('kerepek') ||
      lowerName.includes('kudapan') ||
      lowerName.includes('snack') ||
      lowerName.includes('kopi')
    ) {
      packagingFormat = 'pouch';
    } else if (
      lowerCat.includes('elektronik') ||
      lowerCat.includes('gadget') ||
      lowerName.includes('powerbank') ||
      lowerName.includes('fon')
    ) {
      packagingFormat = 'gadget';
    }

    const defaultName = rawName || 'produk dalam gambar rujukan';
    const defaultCategory = rawCategory || (isWearableOrFashion ? 'Pakaian & Fesyen' : 'Produk Pengguna');

    return {
      name: defaultName,
      category: defaultCategory,
      packagingFormat,
      isWearableOrFashion,
      isLiquidOrPowder,
      verifiedFacts: rawFacts.length > 0 ? rawFacts : ['Kualiti terbukti', 'Mudah dan praktikal digunakan'],
      prohibitedClaims: ['Penyembuh 100% penyakit kronik', 'Kesan serta merta tanpa usaha', 'Diskaun palsu'],
      sourceConfidence: rawName ? 'verified_user' : 'ai_interpreted',
    };
  }

  /**
   * Visual Scene Planner: Creates a realistic, physical scene plan
   */
  static createScenePlan(
    product: ProductProfile,
    style: VideoStyle,
    options?: {
      locationOverride?: string;
      modestyLock?: boolean;
    }
  ): ScenePlan {
    const isMuslimah = options?.modestyLock ?? style.modestyLock;
    const plan = style.actionPlan;

    // Determine domestic Malaysian setting based on product
    let location = 'Ruang tamu rumah moden Malaysia dengan pencahayaan siang semulajadi';
    if (product.packagingFormat === 'jar' || product.category.toLowerCase().includes('makanan')) {
      location = 'Dapur moden kediaman Malaysia yang kemas dan bersih dengan cahaya pagi';
    } else if (product.packagingFormat === 'bottle' || product.category.toLowerCase().includes('skincare')) {
      location = 'Meja vanity / meja rias cerah dengan pencahayaan neutral seimbang';
    } else if (product.packagingFormat === 'gadget') {
      location = 'Meja kerja moden minimalis dengan susunan kemas';
    }

    if (options?.locationOverride) {
      location = options.locationOverride;
    }

    // Determine subject description
    let mainSubject = 'Pencipta kandungan wanita tempatan Malaysia';
    if (style.category === 'hand_demo') {
      mainSubject = isMuslimah
        ? 'Satu tangan bersopan dengan pergelangan tangan tertutup lengan baju sopan'
        : 'Satu tangan kemas semulajadi';
    } else if (isMuslimah) {
      mainSubject = 'Pencipta wanita Malaysia mengenakan hijab kemas yang menutup rambut dan dada dengan sopan';
    }

    return {
      mainSubject,
      location,
      lighting: plan.lightingSpec,
      cameraDistance: 'Jarak 1x framing telefon pintar, pandangan paras mata',
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
