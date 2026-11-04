/**
 * AFFIMATIK by Pawarna — Video Style Registry
 * Phase 1: 12 Initial Pilot Styles + Legacy Preset Mappings
 */

import { VideoStyle, StyleFilterOptions } from './types';

export const VIDEO_STYLES_REGISTRY: VideoStyle[] = [
  // ===========================================================================
  // NEXABOT ENGINE (10s, Malaysian Malay Spoken Voiceover / Dialogue)
  // ===========================================================================
  {
    id: 'NX01',
    slug: 'sembang-kawan',
    name: 'Sembang Kawan',
    benefit: 'Perbualan santai macam kongsi petua dengan kawan rapat',
    description: 'Pencipta kandungan bercakap santai dan bersahaja ke kamera sambil memegang produk secara bersahaja.',
    category: 'creator_review',
    engine: 'nexabot',
    durationSeconds: 10,
    audioMode: 'spoken_bm',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['avatar_reference'],
    actionType: 'casual_creator_talk',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'quality_verified',
    publicationStatus: 'published',
    previewVideoUrl: 'https://hrekuraxzpiqymgcrjyb.supabase.co/storage/v1/object/public/storage/media/2026/11/f42ace37-9474-460a-86b0-ab4b17c95897.mp4',
    tags: ['ugc', 'spoken_bm', 'casual', 'creator', '10s'],
    actionPlan: {
      primaryAction: 'Casual friendly talking while holding product at chest level',
      startPose: 'Creator smiles warmly into camera, holding product comfortably in one hand',
      actionProgression: 'Speaks engagingly for 7 seconds, slightly gestures with free hand to emphasize quality',
      endPose: 'Presents product slightly closer to lens with a confident nod',
      cameraMovement: 'Subtle handheld micro-movements, eye-level framing',
      lightingSpec: 'Warm natural window daylight, no harsh shadows',
      scriptTemplate: 'Korang tengok packaging dia ni, kemas dan cantik sangat. Sesuai untuk guna harian.',
    },
  },
  {
    id: 'NX02',
    slug: 'review-sambil-pegang',
    name: 'Review Sambil Pegang',
    benefit: 'Penerangan jujur produk secara direct to camera',
    description: 'Pencipta menerangkan satu kelebihan utama produk dengan produk sentiasa jelas di paras dada.',
    category: 'creator_review',
    engine: 'nexabot',
    durationSeconds: 10,
    audioMode: 'spoken_bm',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['avatar_reference'],
    actionType: 'direct_review_hold',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'quality_verified',
    publicationStatus: 'published',
    previewVideoUrl: 'https://hrekuraxzpiqymgcrjyb.supabase.co/storage/v1/object/public/storage/media/2026/11/c6f3a29e-194b-4bcd-860d-2956f64e4bca.mp4',
    tags: ['affiliate', 'review', 'spoken_bm', 'direct', '10s'],
    legacyAliasId: 'gem_real_affiliate',
    actionPlan: {
      primaryAction: 'Creator directly presents product with clear focal clarity on label',
      startPose: 'Creator holding product upright in front of chest, looking directly at camera',
      actionProgression: 'Speaks clearly about key confirmed benefit, gently rotates product 10 degrees to show label details',
      endPose: 'Holds product steady with friendly smile',
      cameraMovement: 'Steady handheld 1x framing, chest-up medium close up',
      lightingSpec: 'Soft neutral daylight (5500K), clear illumination on product label',
      scriptTemplate: 'Bagi yang tengah cari produk macam ni, kemasan bungkusan dia nampak kemas dan rekaan praktikal.',
    },
  },
  {
    id: 'NX03',
    slug: 'first-impression',
    name: 'First Impression',
    benefit: 'Reaksi spontan dan tulen melihat kemasan produk',
    description: 'Pencipta memeriksa botol/kotak produk secara semula jadi dengan ekspresi minat yang tulen.',
    category: 'creator_review',
    engine: 'nexabot',
    durationSeconds: 10,
    audioMode: 'spoken_bm',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['packaging_image'],
    actionType: 'first_look_examination',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['first_look', 'authentic', 'reaction', 'spoken_bm', '10s'],
    actionPlan: {
      primaryAction: 'Examining product details with genuine natural curiosity',
      startPose: 'Creator turns product in hands, looking at packaging texture',
      actionProgression: 'Looks up to camera with genuine positive expression and speaks',
      endPose: 'Smiles and gestures approval towards product',
      cameraMovement: 'Handheld dynamic tracking slightly shifting angle',
      lightingSpec: 'Bright natural daylight with clear reflections on packaging',
      scriptTemplate: 'Bila tengok bungkusan dan rekaan dia, memang nampak kemas dan padat untuk kegunaan harian.',
    },
  },
  {
    id: 'NX05',
    slug: 'masalah-seharian',
    name: 'Masalah Seharian',
    benefit: 'Fokus masalah biasa dan tunjuk produk sebagai solusi',
    description: 'Bermula dengan hook cabaran harian dan beralih lancar menunjukkan produk penyelesai masalah.',
    category: 'problem_solution',
    engine: 'nexabot',
    durationSeconds: 10,
    audioMode: 'spoken_bm',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['avatar_reference'],
    actionType: 'problem_solution_transition',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['problem_solver', 'ugc', 'high_converting', 'spoken_bm', '10s'],
    legacyAliasId: 'gem_realistic_ugc',
    actionPlan: {
      primaryAction: 'Problem hook transitioning smoothly to product reveal',
      startPose: 'Creator with relatable concerned expression for 2 seconds',
      actionProgression: 'Transitions to relief as product is brought into frame and introduced',
      endPose: 'Product displayed front and center with confident expression',
      cameraMovement: 'Slight push in during solution reveal',
      lightingSpec: 'Clean room lighting, warm domestic feel',
      scriptTemplate: 'Kalau selalu pening cari pilihan terbaik, produk ni antara yang paling mudah dan praktikal.',
    },
  },
  {
    id: 'NX07',
    slug: 'soalan-jawapan',
    name: 'Soalan & Jawapan',
    benefit: 'Jawab 1 soalan lazim pelanggan dengan ringkas & padat',
    description: 'Pencipta menjawab soalan paling popular tentang produk secara direct, pantas dan meyakinkan.',
    category: 'problem_solution',
    engine: 'nexabot',
    durationSeconds: 10,
    audioMode: 'spoken_bm',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['avatar_reference'],
    actionType: 'qa_direct_answer',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['faq', 'qa', 'direct', 'spoken_bm', '10s'],
    actionPlan: {
      primaryAction: 'Answering common customer question directly',
      startPose: 'Creator nods as if responding to a comment, product resting on table or hand',
      actionProgression: 'Delivers 1 punchy answer with affirmative gesture and points to product',
      endPose: 'Decisive smile, holding product visible',
      cameraMovement: 'Locked-in steady handheld, direct eye contact',
      lightingSpec: 'Clean daylight studio or tidy room ambience',
      scriptTemplate: 'Ramai nak tahu tentang fungsi utama dia. Kelebihan dia memang fokus pada kemudahan harian.',
    },
  },
  {
    id: 'NX09',
    slug: 'goyang-produk-vo',
    name: 'Goyang Produk + VO',
    benefit: 'Fokus produk fizikal dengan suara latar BM semulajadi',
    description: 'Satu tangan bersopan menggerakkan produk secara lembut dengan suara latar (voiceover) bahasa Melayu.',
    category: 'hand_demo',
    engine: 'nexabot',
    durationSeconds: 10,
    audioMode: 'spoken_bm',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: [],
    actionType: 'hand_motion_voiceover',
    cameraProfile: 'smartphone_tabletop_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'quality_verified',
    publicationStatus: 'published',
    previewVideoUrl: 'https://hrekuraxzpiqymgcrjyb.supabase.co/storage/v1/object/public/storage/media/2026/11/d0220ce3-4256-416c-a5be-a79c8d121437.mp4',
    tags: ['hand_demo', 'faceless', 'voiceover', 'spoken_bm', '10s'],
    actionPlan: {
      primaryAction: 'Single modest hand gently tilting product while voiceover narrates',
      startPose: 'Single clean hand holding product upright on tabletop',
      actionProgression: 'Slow gentle tilt 15 degrees left then right, highlighting design & branding',
      endPose: 'Product returns to center stable position',
      cameraMovement: 'Gentle handheld tabletop framing, no zoom',
      lightingSpec: 'Natural tabletop morning sunlight, crisp label details',
      scriptTemplate: 'Tengok saiz dan kemasan dia, nampak kemas dan senang nak bawa ke mana-mana.',
    },
  },
  {
    id: 'NX10',
    slug: 'label-talk',
    name: 'Label Talk',
    benefit: 'Penerangan maklumat label sambil tunjuk packaging',
    description: 'Kamera menfokuskan pada botol/pek produk dengan narration menerangkan fungsi sahih daripada label.',
    category: 'hand_demo',
    engine: 'nexabot',
    durationSeconds: 10,
    audioMode: 'spoken_bm',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: [],
    actionType: 'label_inspection_narration',
    cameraProfile: 'smartphone_tabletop_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['label', 'facts', 'voiceover', 'product_focus', '10s'],
    actionPlan: {
      primaryAction: 'Clear presentation of product label with factual narration',
      startPose: 'Product held steady with label facing camera directly',
      actionProgression: 'Fingers subtly guide eye to key label area, no blocking of text',
      endPose: 'Slight tilt upwards showing bottle cap or closure',
      cameraMovement: 'Macro-like clarity at standard 1x distance, steady',
      lightingSpec: 'Even daylight exposure across entire text on packaging',
      scriptTemplate: 'Maklumat bungkusan tertera kemas pada label ni, rekaan ringkas dan mudah dibaca.',
    },
  },

  // ===========================================================================
  // RUNNINGHUB ENGINE (15s, Strictly No Speech / Visual Realism Priority)
  // ===========================================================================
  {
    id: 'RH01',
    slug: 'goyang-produk-natural',
    name: 'Goyang Produk Natural',
    benefit: 'Pergerakan tangan 15s yang tenang & visual super-realistik',
    description: 'Satu tangan bersopan memegang produk dan menggerakkannya secara perlahan dan bersahaja tanpa suara pertuturan.',
    category: 'hand_demo',
    engine: 'runninghub',
    durationSeconds: 15,
    audioMode: 'no_speech',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: [],
    actionType: 'gentle_handheld_motion',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['hand_demo', 'no_speech', 'realistic', '15s', 'runninghub'],
    legacyAliasId: 'gem_product_hand_demo',
    actionPlan: {
      primaryAction: 'Single modest hand holding product and performing gentle natural motion',
      startPose: 'One hand with covered wrist holds product naturally in center frame',
      actionProgression: 'Slow, subtle tilt left (4s), returns to center (4s), gentle tilt right (4s), rests steady (3s)',
      endPose: 'Product held perfectly steady in center frame at 14.8s mark',
      cameraMovement: 'Natural handheld smartphone micro-shake, fixed focal distance',
      lightingSpec: 'Bright neutral ambient daylight (5500K), zero studio spotlight glare',
    },
  },
  {
    id: 'RH02',
    slug: 'gentle-product-tilt',
    name: 'Gentle Product Tilt',
    benefit: 'Kelewatan sudut 15s menunjukkan kilauan & bentuk produk',
    description: 'Satu tangan condongkan produk sedikit ke kiri dan kanan untuk mempamerkan pantulan cahaya dan profil rekaan.',
    category: 'hand_demo',
    engine: 'runninghub',
    durationSeconds: 15,
    audioMode: 'no_speech',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: [],
    actionType: 'subtle_angle_tilt',
    cameraProfile: 'smartphone_tabletop_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['hand_demo', 'tilt', 'aesthetic', 'no_speech', '15s'],
    actionPlan: {
      primaryAction: 'Slow angular tilt showcasing physical form without hiding brand label',
      startPose: 'Product placed standing on wooden desk, fingers holding gently from sides',
      actionProgression: 'Tilts product 12 degrees to capture natural window reflection, holds, tilts reverse',
      endPose: 'Placed back standing flat on desk surface',
      cameraMovement: 'Subtle parallax handheld motion at close range',
      lightingSpec: 'Soft directional daylight revealing surface texture and clean color',
    },
  },
  {
    id: 'RH03',
    slug: 'pick-up-and-put-down',
    name: 'Pick Up & Put Down',
    benefit: 'Interaksi fizikal atas meja yang sangat natural & meyakinkan',
    description: 'Tangan masuk ke bingkai, mengangkat produk dari meja, memegangnya sekejap, dan meletakkannya kembali.',
    category: 'hand_demo',
    engine: 'runninghub',
    durationSeconds: 15,
    audioMode: 'no_speech',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['lifestyle_reference'],
    actionType: 'pickup_hold_place',
    cameraProfile: 'smartphone_tabletop_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['tabletop', 'interaction', 'physical', 'no_speech', '15s'],
    legacyAliasId: 'gem_unboxing_studio',
    actionPlan: {
      primaryAction: 'Natural entrance, pickup, brief display, and placement back on surface',
      startPose: 'Product standing alone on clean modern tabletop (0s-2s)',
      actionProgression: 'Hand enters from right, grasps product naturally, lifts 5cm up, holds for examination (3s-10s), lowers gently (11s-14s)',
      endPose: 'Product rests on tabletop, hand withdraws smoothly (15s)',
      cameraMovement: 'Slight handheld organic motion tracking the lift',
      lightingSpec: 'Warm natural domestic room illumination, realistic contact shadows',
    },
  },
  {
    id: 'RH04',
    slug: 'shelf-pickup',
    name: 'Shelf Pickup',
    benefit: 'Visual diambil dari rak rumah sebenar, membina rasa dipercayai',
    description: 'Produk berada di atas rak rumah biasa, tangan masuk mengambilnya dan menunjukkan bahagian depan.',
    category: 'lifestyle',
    engine: 'runninghub',
    durationSeconds: 15,
    audioMode: 'no_speech',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['lifestyle_reference'],
    actionType: 'shelf_interaction',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['lifestyle', 'shelf', 'homely', 'no_speech', '15s'],
    actionPlan: {
      primaryAction: 'Picking up item from household wooden or white shelf',
      startPose: 'Product seated on tidy home shelf among a few books or clean organizer',
      actionProgression: 'Hand reaches in, lifts product forward towards camera, displays front label',
      endPose: 'Held steadily in front of shelf backdrop',
      cameraMovement: 'Eye-level handheld framing, subtle breathing movement',
      lightingSpec: 'Domestic ambient lighting with soft window backlight',
    },
  },
  {
    id: 'RH17',
    slug: 'desk-setup',
    name: 'Desk Setup',
    benefit: 'Visual estetik atas meja kerja harian, sesuai produk moden',
    description: 'Produk diletakkan di atas meja kerja yang kemas bersebelahan laptop atau buku dengan pergerakan bersahaja.',
    category: 'lifestyle',
    engine: 'runninghub',
    durationSeconds: 15,
    audioMode: 'no_speech',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: ['lifestyle_reference'],
    actionType: 'desk_lifestyle_display',
    cameraProfile: 'smartphone_tabletop_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['lifestyle', 'workstation', 'modern', 'no_speech', '15s'],
    legacyAliasId: 'gem_faceless_aesthetic',
    actionPlan: {
      primaryAction: 'Desk lifestyle placement with subtle interaction',
      startPose: 'Product positioned nicely on clean workspace desk beside notebook',
      actionProgression: 'A hand enters to gently turn the product slightly to face the daylight',
      endPose: 'Product sits perfectly framed with subtle background bokeh',
      cameraMovement: 'Slow steady panning motion from left to right',
      lightingSpec: 'Morning daylight casting soft natural angles across desk',
    },
  },
  {
    id: 'RH19',
    slug: 'window-daylight',
    name: 'Window Daylight',
    benefit: 'Pencahayaan tingkap semulajadi tanpa warna kuning/suram',
    description: 'Produk dipegang dekat dengan tingkap bercahaya terang untuk warna paling asli dan jelas.',
    category: 'lifestyle',
    engine: 'runninghub',
    durationSeconds: 15,
    audioMode: 'no_speech',
    supportedProductCategories: ['*'],
    requiredAssets: ['product_image'],
    optionalAssets: [],
    actionType: 'window_daylight_hold',
    cameraProfile: 'smartphone_handheld_1x',
    identityLock: true,
    realismLock: true,
    modestyLock: true,
    promptTemplateVersion: '2.0.0',
    qualityStatus: 'prompt_validated',
    publicationStatus: 'published',
    previewVideoUrl: null,
    tags: ['daylight', 'natural', 'pure_lighting', 'no_speech', '15s'],
    actionPlan: {
      primaryAction: 'Holding product in pure natural daylight streaming from window',
      startPose: 'Hand holds product upright against soft blurred daylight window background',
      actionProgression: 'Gentle micro-motions, allowing sunlight to illuminate pure colors and label texture',
      endPose: 'Held steady in center of frame with crisp edge definition',
      cameraMovement: 'Gentle organic handheld smartphone camera, 1x focal length',
      lightingSpec: 'Pure 5500K daylight, clean neutral whites, absolutely no yellow tint',
    },
  },
];

/**
 * Lookup a style by its new ID (e.g. 'NX01', 'RH01') or legacy preset ID (e.g. 'gem_real_affiliate')
 */
export function getVideoStyle(idOrAlias: string): VideoStyle | undefined {
  if (!idOrAlias) return undefined;
  const normalized = idOrAlias.trim().toLowerCase();
  return VIDEO_STYLES_REGISTRY.find(
    (s) => s.id.toLowerCase() === normalized || s.slug.toLowerCase() === normalized || s.legacyAliasId?.toLowerCase() === normalized
  );
}

/**
 * Get all available styles in the registry
 */
export function getAllVideoStyles(): VideoStyle[] {
  return VIDEO_STYLES_REGISTRY.filter((s) => s.publicationStatus === 'published');
}

/**
 * Filter styles by category, engine, voice, etc.
 */
export function filterVideoStyles(options: StyleFilterOptions): VideoStyle[] {
  return VIDEO_STYLES_REGISTRY.filter((style) => {
    // Only published unless specified
    if (options.publicationStatus) {
      if (style.publicationStatus !== options.publicationStatus) return false;
    } else if (style.publicationStatus !== 'published') {
      return false;
    }

    if (options.category && options.category !== 'all' && style.category !== options.category) {
      return false;
    }

    if (options.engine && style.engine !== options.engine) {
      return false;
    }

    if (options.duration && style.durationSeconds !== options.duration) {
      return false;
    }

    if (typeof options.hasVoice === 'boolean') {
      const styleHasVoice = style.audioMode === 'spoken_bm' || style.audioMode === 'off_camera_narration';
      if (options.hasVoice !== styleHasVoice) return false;
    }

    if (options.requiresAvatar && !style.requiredAssets.includes('avatar_reference')) {
      return false;
    }

    if (options.onlyOneImage && (style.requiredAssets.length > 1 || style.optionalAssets.length > 0)) {
      return false;
    }

    if (options.searchQuery && options.searchQuery.trim().length > 0) {
      const q = options.searchQuery.toLowerCase();
      const match =
        style.name.toLowerCase().includes(q) ||
        style.benefit.toLowerCase().includes(q) ||
        style.description.toLowerCase().includes(q) ||
        style.tags.some((t) => t.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });
}
