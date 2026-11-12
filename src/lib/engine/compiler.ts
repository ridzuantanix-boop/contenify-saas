/**
 * AFFIMATIK by Pawarna — Creative V6 direct-provider prompt compiler
 * Translates Product Profile + Video Style + Scene Plan into Provider-Specific Payloads
 * 
 * AffiMatik compiles a canonical, style-specific masterprompt and references.
 * Nexabot owns product interpretation, creative concept, dialogue, acting and media.
 */

import { ProductProfile, ScenePlan, CompiledGenerationPrompt } from './types';
import { VideoStyle } from '../styles/types';
import { VIDEO_STYLES_REGISTRY } from '../styles/registry';
import { getBuiltInScene } from '../personalization/config';
import {
  CtaMode,
  resolveCtaPhrase,
  validateCustomCta,
  validateCustomerFact,
} from './cta-control';

export const GEMS_PROMPT_VERSION = 'pawarna-masterprompt-director-v10.1';

export const NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10 = [
  '[PRIORITY 0 SPOKEN OUTPUT CONTRACT — APPLY BEFORE ALL CREATIVE DETAIL]',
  'Nexabot independently writes the dialogue; AffiMatik supplies no spoken script.',
  'Use one compact natural Malaysian Malay turn of two, or at most three, short clauses: a style-specific hook, one image-grounded category purpose or customer-confirmed fact, then a concise ending or selected CTA.',
  'Finish every spoken word by second 11.5, then continue natural physical action. Never restart, repeat, paraphrase or stretch the final clause to fill the clip.',
  'Visible shape does not prove performance. Never infer touch operation, flexibility, brightness, eye comfort, battery life, efficacy or another result unless that exact fact is customer-confirmed or clearly readable in the reference.',
  'Silently delete any uncertain benefit or performance statement before rendering; do not replace it with compliance wording or filler.',
].join(' ');

export const MASTERPROMPT_PRIORITY_SYSTEM_V10 = [
  '[PAWARNA MASTERPROMPT DIRECTOR V10 — PRIORITY SYSTEM]',
  'PRIORITY 0 HARD PRODUCTION CONSTRAINTS: exact supported product identity; correct image-reference roles; valid 15-second vertical 9:16 Nexabot i2v output; zero screenshot UI contamination; no fabricated claims, prices, reviews, medical outcomes or certifications; selected CTA intent; no AffiMatik-authored dialogue.',
  'PRIORITY 1 STYLE IDENTITY: preserve the selected presenter/faceless/POV/hand-led perspective, environment, physical action, emotional tone, buyer-information purpose and audio behaviour. Universal rules may not erase the style identity.',
  'PRIORITY 2 HUMAN REALISM: plausible physical scale, anatomy, grip, weight, gaze, body movement, smartphone optics, ambient environment, natural material rendering and ordinary Malaysian voice.',
  'PRIORITY 3 NATIVE CREATIVE STORYTELLING: Nexabot independently chooses the hook, relevant buyer situation, grounded product point, natural Malaysian wording, truthful social proof if supported, CTA wording and believable ending.',
  'Resolve conflicts strictly in this priority order.',
].join(' ');

export const NEXABOT_PRODUCT_UNDERSTANDING_V10 = [
  '[NEXABOT NATIVE PRODUCT UNDERSTANDING — PROVIDER OWNS CREATIVE THINKING]',
  'Inspect the actual uploaded product reference. Identify readable brand and product name, recognizable category and ordinary intended use only when sufficiently supported by the image or customer-authored direction.',
  'Build a believable Malaysian buyer situation specific to this product and selected style. Independently create original Bahasa Melayu Malaysia dialogue; never use a generic placeholder such as “kalau tengah survey produk ini, tengok yang ni dulu”.',
  'Use a readable product name naturally when identifiable. If evidence is insufficient, stay cautiously within the recognizable category and omit uncertain benefits instead of inventing details.',
  'Do not narrate packaging, label visibility, hand movement or camera action unless that detail is materially useful to a buyer.',
  'Image interpretation and model knowledge are not live internet research. Never invent ingredients, efficacy, medical outcomes, certification, price, popularity, review counts, testimonials, discounts or personal experience.',
].join(' ');

export const MALAYSIAN_AFFILIATE_VOICE_DNA_V6 = [
  '[REAL MALAYSIAN AFFILIATE VOICE DNA V8.3]',
  'Use spoken Bahasa Melayu Malaysia like a real Malaysian TikTok affiliate casually sharing a useful find with friends, never like a corporate presenter, newsreader, advertisement narrator or compliance officer.',
  'Use ordinary Malaysian phrasing, naturally imperfect sentence links, small breaths, uneven but fluent rhythm and meaningful changes of intonation.',
  'Do not mechanically insert eh, haa, weh, korang or tau. Nexabot chooses wording and particles from the product and style context.',
  'Independently build one compact spoken turn: one distinct hook, one grounded product point, then one concise natural ending. Do not narrate for the full clip merely to fill time.',
  'Focus on one supported intended purpose or ordinary category use context and finish speech comfortably before the video ends.',
  'Do not repeat a catalogue-wide opening or closing. Match the selected style personality exactly.',
  'Never repeat or paraphrase the same meaning twice. Each spoken clause must add new information; remove any echoed claim, hook, product point, CTA or outro before rendering.',
  'No Indonesian forms, no English dialogue unless explicitly requested, no filler, no fake excitement, no uniform emphasis and no long unnatural pause.',
  'A buyer problem does not prove that this product resolves it. Omit all unsupported benefit and performance claims.',
  'Never claim personal use, purchase, customer reviews, ingredients, certifications, prices, specifications, performance results or medical outcomes unless explicitly supplied by the user or clearly legible in the reference.',
  'Keep factual guardrails silent: do not speak legal-disclaimer phrases such as “berdasarkan apa yang kelihatan”. When detail is unavailable, use an ordinary useful category description or omit the claim.',
  'Never use first-person product experience or routines, including claims that the speaker uses, drinks, takes, buys or keeps the product at home.',
  'Speak the selected CTA intent naturally once when one is requested; never repeat it or render fake CTA graphics.',
].join(' ');

export const HUMAN_REALISM_MASTERPROMPT_V8 = [
  '[HUMAN REALISM MASTERPROMPT V8] [REAL HUMAN PERFORMANCE DIRECTOR V8.3]',
  'Create ordinary Malaysian creator behaviour, not polished commercial acting. Use irregular natural blinking, subtle breathing, relaxed jaw movement during pauses and believable facial-muscle transitions.',
  'Do not stare into the lens throughout. Alternate motivated eye contact with one or two brief product glances; never use periodic blinking, repeated nodding, a frozen smile or a frozen final pose.',
  'Maintain believable weight distribution, tiny posture and shoulder adjustments, and hands that react to the object’s plausible real weight. One purposeful gesture is better than decorative repeated motion.',
  'Creator review: alternate naturally between the lens and product, with one small head movement and a restrained hand gesture.',
  'First impression: use one spontaneous micro-reaction such as a slight eyebrow lift or half-smile; never exaggerated surprise.',
  'Question and answer: show a brief thinking expression before the answer, then return gaze naturally to the lens.',
  'Hand demonstration: use a real grip, believable object weight, correct finger contact, stable label and physical contact shadows.',
  'POV: use credible first-person reach and restrained handheld movement, never floating or impossible camera travel.',
  'Lifestyle: perform one small context-relevant action while speaking instead of posing motionless.',
  'Soft sell: relaxed local speaking tone, never a commercial announcer voice or over-rehearsed sales performance.',
  'Use environment-appropriate believable light, natural skin tones, consistent exposure and white balance, authentic material texture and physical shadows. No yellow cast, teal-orange grade, fake glow, excessive sharpening or plastic skin.',
].join(' ');

const VOICE_PERSONALITY_DIRECTIONS: Record<string, string> = {
  friendly: 'Warm and relaxed, like speaking to a friend; soft hook, easy sentence linking and a small reassuring finish.',
  energetic: 'Start quickly with lively but controlled energy, vary pace after the hook and emphasize only the useful product point; never shout.',
  calm: 'Low-pressure and measured with clear articulation, soft pauses and an unhurried CTA; never monotone.',
  confident: 'Direct and convincing with a firm hook and clean ending, but still conversational and never like a commercial announcer.',
  helpful: 'Naturally offer one useful buying consideration, with a caring matter-of-fact tone rather than a warning or disclaimer.',
  premium: 'Polished and composed with restrained warmth and precise articulation, while remaining a real phone creator rather than luxury-ad narration.',
};

function productScaleDirective(product: ProductProfile): string {
  const category = `${product.category} ${product.packagingFormat}`.toLowerCase();
  const categoryGuide = /serum|beauty|cosmetic|bottle/.test(category)
    ? 'Treat a serum or cosmetic bottle as a small palm-sized retail object unless the customer supplied other dimensions.'
    : /supplement|health|wellness/.test(category)
      ? 'Treat a retail supplement bottle or box as a normal hand-held pharmacy-sized object, never a giant jar.'
      : /lamp|lighting/.test(category)
        ? 'Keep a desk lamp plausibly sized beside furniture, a laptop and the presenter.'
        : /organizer|kitchen|household/.test(category)
          ? 'Keep the object plausibly sized against hands, counters, shelves and nearby household items.'
          : 'Use conservative category-appropriate real-world scale against hands, furniture and the human body.';
  return `[PLAUSIBLE PRODUCT SCALE LOCK] ${categoryGuide} Preserve one consistent physical size throughout. Never enlarge the product for label readability, never infer exact dimensions from a screenshot, and use realistic grip, contact shadows and perspective.`;
}

/**
 * Internal Provider to AffiMatik White-Label Display Name Mapping
 */
export function getEngineDisplayName(engine: 'nexabot' | 'runninghub' | string): string {
  if (engine === 'nexabot') return 'AffiMatik Voice (15s)';
  if (engine === 'runninghub') return 'AffiMatik Motion (15s)';
  return 'AffiMatik Engine';
}

export function getEngineDescription(engine: 'nexabot' | 'runninghub' | string): string {
  if (engine === 'nexabot') return 'Video pertuturan Bahasa Melayu santai semula jadi (15 saat)';
  if (engine === 'runninghub') return 'Video visual realistik, pergerakan lembut, ASMR / audio bersesuaian (15 saat)';
  return 'Enjin penjanaan video AffiMatik';
}

export interface CompilerOptions {
  callToAction?: CtaMode;
  isMuslimahModest?: boolean;
  /** Historical input only. V10 never injects it into a new automatic job. */
  customScript?: string;
  customCta?: string;
  /** Historical input only. Normalized to provider-owned dialogue in V10. */
  scriptMode?: 'smart' | 'custom' | 'provider_auto' | string;
  creativeInstruction?: string;
  imageRole?: 'reference' | 'start_frame';
  variationIndex?: number;
  productionProfile?: 'ugc_creator' | 'studio_commercial';
  avatarName?: string;
  backgroundName?: string;
  builtInSceneId?: string;
  niche?: string;
  voicePersonality?: string;
  storyboard?: string;
  /** Historical input only. Ignored by the V10 compiler. */
  scriptVariant?: 'style' | 'direct' | 'helpful' | 'short' | 'story' | string;
  audioTreatment?: 'voiceover' | 'ambient' | 'asmr';
}

export interface PromptPreviewResult {
  provider: 'nexabot' | 'runninghub';
  engineDisplayName: string;
  durationSeconds: number;
  creditCost: number;
  spokenScript: null;
  visualSummary: string;
  sceneEnvironment: string;
  cameraProfile: string;
  modestyRules: string;
  productIdentityRules: string;
  audioDirective: string;
  promptVersion: string;
}

/**
 * Retained V5 literals, overridden below by all 20 canonical V6 styles.
 */
export const AUTHORITATIVE_STYLE_MASTERPROMPTS: Record<string, (params: {
  productName: string;
  feature: string;
  useCase: string;
  buyerProblem: string;
  qaQuestion: string;
  useContext: string;
  relevantSurface: string;
  coreFunction: string;
}) => string> = {
  // NX01: Sembang Kawan (15s)
  NX01: (p) =>
    `A single adult modest Malaysian Muslimah creator, full hijab covering hair neck and chest, loose long-sleeved clothing. Natural smartphone 1x eye-level medium shot in a bright lived-in Malaysian home. She casually chats like a friend, holding the reference product at chest height. Open with a buyer situation genuinely relevant to the visible product, then explain its supported intended purpose and an ordinary use context in a warm, sincere voice. The provider creates the words and lip-sync. Natural hand gesture, one continuous handheld take, no cut.`,

  // NX02: Review Sambil Pegang (15s)
  NX02: (p) =>
    `Adult modest Malaysian Muslimah reviewer in a bright ordinary room, direct eye-level smartphone 1x handheld shot. Hold the reference product in one hand at chest height. Open by identifying its supported intended purpose, mention one feature actually legible in the image or explicitly supplied by the user, then explain when a buyer might use it without predicting a result. Speak directly and honestly; the provider creates the Malaysian Malay dialogue and lip-sync. Very small natural object adjustment, no label examination monologue, no close-up, one continuous take.`,

  // NX03: First Impression (15s)
  NX03: (p) =>
    `Authentic first-look creator footage with an adult modest Malaysian Muslimah. Start holding the reference product near chest, glance at it, then look up with mild curiosity. Open with a genuine first observation and explain only an intended purpose supported by the image or user notes, never an achieved benefit. The provider creates cautious Malaysian Malay dialogue without implying personal use or a tested result. Small real movements, no fake unboxing or exaggerated reaction, 1x smartphone full-frame one take.`,

  // NX05: Masalah Seharian (15s)
  NX05: (p) =>
    `Single-take realistic Malaysian home UGC. Adult modest Muslimah creator opens with a buyer situation relevant to the visible product, then lifts the reference product into frame by second two and explains its supported intended function and ordinary use. Do not claim the product solves the problem or delivers a result. The provider creates empathetic, cautious Malaysian Malay dialogue and a credible everyday action, never a miraculous instant transformation. Same camera position, no jump cut, no zoom, neutral daylight.`,

  // NX07: Soalan & Jawapan (15s)
  NX07: (p) =>
    `Modest Malaysian Muslimah Q&A creator in a naturally bright Malaysian room, single continuous phone 1x shot, with the reference product visible from the start. The provider creates ONE meaningful Malaysian Malay buyer question about the product's purpose or supported feature, then answers only with evidence visible in the image or user notes and relates it to practical use. If evidence is insufficient, choose a narrower answerable question. Curious, helpful speaking personality. No fake comment box, chat bubble, text graphics, or extra people.`,

  // NX09: Goyang Produk + VO (15s)
  NX09: (p) =>
    `HAND ONLY. Exactly one naturally proportioned adult female hand, sleeve fully covering the wrist, holds the reference product upright in a natural home space. Use one relaxed side-to-side micro-tilt while retaining plausible category-appropriate physical scale. The voiceover discusses a relevant buyer situation or practical consideration, never the hand or camera action. No presenter face or second hand. Neutral 1x phone camera, daylight, zero UI, one continuous take.`,

  // NX10: Label Talk • Fakta & Fungsi Dulu (15s)
  NX10: (p) =>
    `HAND ONLY. Exactly one adult female hand with long sleeve covering wrist holds the reference product upright facing the 1x phone camera in a naturally lit room. Point subtly to a clearly legible, relevant specification only if one is visible; otherwise hold steady without pretending a specification exists. The provider creates a precise Malaysian Malay voiceover opening with a supported fact and explaining only its intended purpose or use context, never an unverified outcome. No face, second hand or phone frame; one continuous take.`,

  // RH01: Goyang Produk Natural (15s)
  RH01: (p) =>
    `One continuous real smartphone 1x handheld shot. Exactly ONE fully sleeve-covered adult hand holds the EXACT reference "${p.productName}" upright in a grounded real-world usage context (${p.useContext}). Small authentic left tilt, center, small right tilt, then hold steady. Slight natural micro-shake only. The object should clearly belong to its intended usage context, conveying purpose visually rather than merely showing packaging. Full-frame 9:16, daylight, no face, no second hand, no graphic overlays. Strictly NO spoken dialogue and NO lip-sync movement.`,

  // RH02: Gentle Product Tilt (15s)
  RH02: (p) =>
    `Realistic tabletop video of exact "${p.productName}" in relevant usage context (${p.useContext}). A single modest covered adult hand gently tilts the physical product left 10–12 degrees, returns to center, tilts the other way, and rests it on the real surface (${p.relevantSurface}). Normal object weight, accurate product identity, clean neutrally lit 1x handheld smartphone footage, no macro exaggeration or changing label. Visual attention follows a buyer-relevant feature or form without any unverified performance demonstration. Strictly NO spoken dialogue.`,

  // RH03: Pick Up & Put Down (15s)
  RH03: (p) =>
    `Natural continuous 15-second smartphone 1x footage. Exact physical "${p.productName}" starts on a real surface (${p.relevantSurface}). Exactly one covered adult hand enters from the side, grips, lifts 5–10 cm with plausible object weight, holds naturally in usage context (${p.useContext}), slowly places the product back with clear contact shadow, releases it, and withdraws. The product remains the same object from beginning to end. Neutral bright daylight. Capture believable everyday handling, not a 360 product turntable or stage effect. Strictly NO spoken dialogue.`,

  // RH04: Shelf Pickup (15s)
  RH04: (p) =>
    `One continuous authentic Malaysian home shelf interaction, handheld smartphone 1x, bright neutral daylight. The exact referenced "${p.productName}" sits on a suitable tidy shelf in usage context (${p.useContext}). One sleeve-covered hand reaches in, grasps the product, lifts it naturally off shelf, holds it at ordinary arm distance, keeps product stable. This should feel like a shopper or customer casually taking a relevant item for use, not an ad with visual effects. No second hand, no face, no branded social media UI. Strictly NO spoken dialogue.`,

  // RH17: Desk Setup (15s)
  RH17: (p) =>
    `Everyday Malaysian work/study desk, not a commercial showroom. Exact referenced "${p.productName}" in a believable desk use context (${p.useContext}) beside minimal realistic desk items. One covered hand enters, makes a small practical position adjustment, then exits. Realistic daylight, normal 1x phone camera with barely noticeable handheld drift, one continuous 15-second take. The arrangement visually shows where the product helps in everyday life without inventing specific functions or adding floating icons. Strictly NO spoken dialogue.`,

  // RH19: Window Daylight (15s)
  RH19: (p) =>
    `Single real-looking handheld smartphone 1x clip of the exact "${p.productName}" held in one modest sleeve-covered adult hand near an ordinary Malaysian home window. Pure neutral clean window daylight, soft true shadow, no golden or sepia tint. Small authentic 5–8-degree hand adjustment, otherwise stable. Product uses plausible category-appropriate physical scale in context (${p.useContext}); visible real object, not a stylized commercial showcase. One continuous full-frame 15-second shot with absolutely no embedded interface or phone frame.`,
};

const STYLE_SPECIFIC_DIRECTOR_V10: Record<string, string> = {
  NX01: 'Friendly creator-led conversation facing a normal phone camera. Share a useful product find like a friend, with small gestures and occasional product glances. No hardcoded greeting, catalogue narration or exaggerated enthusiasm.',
  NX02: 'Presenter holds the product at credible scale and reviews one useful grounded point. Use a natural grip and speaking posture; never perform like a professional commercial host.',
  NX03: 'Create a mild, spontaneous first-look reaction to recognizable product details. Never fabricate prior testing, personal use or achieved results.',
  NX05: 'Begin from one realistic everyday buyer situation and introduce the product as a potentially relevant choice. No guaranteed solution, fake transformation or health outcome.',
  NX07: 'Create one meaningful buyer question and one concise answer supported by visible context. No formal FAQ language, fake comment box, shopping UI or repeated question.',
  NX09: 'Faceless, exactly one covered-wrist hand. Small grounded product movement while off-camera speech gives buyer-relevant context; never narrate the movement.',
  NX10: 'Use at most one genuinely visible relevant label detail when readable. Never read the whole package or invent an unreadable specification.',
  RH01: 'Faceless one-hand scene with one brief casual goyang resembling ordinary handling, not mechanical shaking. Speech may add practical buyer context but never narrate the goyang.',
  RH02: 'Use one small physically motivated tilt, never a turntable rotation. Suitable only when the product and setting support hand-led handling; voice discusses buyer relevance, not angle.',
  RH03: 'Natural pickup, hold and set-down with believable grip, gravity, friction and surface contact. Voice, Ambient or ASMR follows the selected audio mode; never narrate lifting.',
  RH04: 'Reach for the product on a category-appropriate household shelf, pick it up once and settle naturally. No invented previous-use story.',
  RH17: 'Place the product in a believable work or study desk context with one practical adjustment. No showroom styling or unsupported productivity promise.',
  RH19: 'Use neutral window daylight and one small physical adjustment. Do not discuss window light or package colour unless buyer-relevant; complete speech before the final beat.',
  NX11: 'Credible first-person viewer perspective, camera height and hands. No impossible anatomy, fabricated purchase or customer testimony.',
  NX12: 'Spontaneous product-discovery atmosphere with one product-specific reason for interest. No fake virality or exaggerated excitement.',
  NX13: 'Use a Malaysian kitchen or home context only for a relevant food, drink, cooking or household product. No fake taste test or personal-use claim.',
  NX14: 'Believable desk or study review for a context-appropriate product. Discuss practical relevance without generic productivity promises.',
  NX15: 'Short relatable story establishing one believable everyday situation, then the product as a relevant option. No melodrama, invented outcome or testimonial.',
  NX16: 'Low-pressure recommendation with relaxed body language and warm conversational delivery. Blend a selected CTA into the conversation without urgency.',
  NX17: 'Creator appears to remember or notice a potentially useful product, then gives a product-relevant explanation. No fabricated endorsement; end naturally without an ad slogan.',
};

// Each official style compiles an independent director prompt from its registry
// identity plus a dedicated V10 restriction block. No dialogue is constructed.
for (const v6Style of VIDEO_STYLES_REGISTRY) {
  AUTHORITATIVE_STYLE_MASTERPROMPTS[v6Style.id] = (p) => {
    const d = v6Style.creativeDirection;
    const handOnly = v6Style.category === 'product_handling' || v6Style.category === 'pov' || v6Style.id.startsWith('RH');
    return [
      `[STYLE ${v6Style.id} — ${v6Style.name}]`,
      `Target experience: ${d.targetViewingExperience}.`,
      `Opening strategy: ${d.openingStrategy}.`,
      `Speaking personality: ${d.speakingPersonality}.`,
      `Natural human behaviour: ${d.humanBehaviour}.`,
      `Scene context: ${d.sceneContext}; adapt it to the uploaded product category and never force an unsuitable location.`,
      `Product interaction: ${d.productInteraction}.`,
      `Ending: ${d.expectedEnding}.`,
      `Style-specific director lock: ${STYLE_SPECIFIC_DIRECTOR_V10[v6Style.id]}.`,
      `Camera: ${v6Style.cameraProfile}; vertical 9:16, realistic smartphone 1x, one continuous take, small handheld micro-shake.`,
      handOnly ? 'HAND-LED SCENE HARD LOCK: show exactly one realistically proportioned sleeve-covered hand only. Absolutely NO presenter face, head, eyes, mouth, torso or full human body may enter any frame. No jewellery or nail polish.' : 'PRESENTER SCENE: natural expressions and accurate lip-sync; modest Malaysian Muslimah styling.',
      `Use the exact reference product identity. The image is a reference, never a mandatory first frame. Product name metadata: "${p.productName}".`,
    ].join(' ');
  };
}

export class DynamicPromptCompiler {
  /**
   * Deterministic preflight validation with sanitized white-label error messages
   */
  static validatePreflight(
    product: ProductProfile,
    style: VideoStyle,
    options?: CompilerOptions
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Engine and duration validation
    if (style.engine === 'nexabot' && style.durationSeconds !== 15) {
      errors.push(`Gaya AffiMatik Voice (${style.id}) mesti tepat 15 saat.`);
    }
    if (style.engine === 'runninghub' && style.durationSeconds !== 15) {
      errors.push(`Gaya AffiMatik Motion (${style.id}) mesti tepat 15 saat.`);
    }

    // Hard Rule: Motion 15s styles must NOT have spoken voiceover
    if (style.engine === 'runninghub' && style.audioMode !== 'no_speech' && style.audioMode !== 'ambient') {
      errors.push(`Gaya AffiMatik Motion (${style.id}) tidak menyokong suara percakapan.`);
    }

    if (style.engine === 'nexabot') {
      if (options?.callToAction === 'custom') errors.push(...validateCustomCta(options?.customCta || ''));
      if (product.confirmedFeatures?.[0]) errors.push(...validateCustomerFact(product.confirmedFeatures[0]));
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generates a comprehensive customer-facing preview before launching generation
   */
  static previewPrompt(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions = {}
  ): PromptPreviewResult {
    const isMuslimah = options.isMuslimahModest ?? style.modestyLock;
    const engineDisplayName = getEngineDisplayName(style.engine);

    let modestyRules = 'Pemakaian santai kontemporari sopan bersesuaian khalayak Malaysia.';
    if (isMuslimah) {
      if (style.category === 'hand_demo' || style.category === 'product_handling' || style.category === 'pov' || style.id.startsWith('RH')) {
        modestyRules = 'Satu tangan sahaja dengan pergelangan tangan bertutup lengan baju, tiada cincin/gelang/pengilat kuku.';
      } else {
        modestyRules = 'Tudung labuh menutup rambut, leher dan dada; pakaian longgar berlengan panjang hingga pergelangan.';
      }
    }

    const visualSummary = `Satu babak visual berterusan ${style.durationSeconds} saat. ${scenePlan.primaryAction}. Produk kekal pada skala fizikal dunia sebenar yang munasabah tanpa morphing atau hilang.`;

    return {
      provider: style.engine,
      engineDisplayName,
      durationSeconds: style.durationSeconds,
      creditCost: style.engine === 'nexabot' ? 10 : 15,
      spokenScript: null,
      visualSummary,
      sceneEnvironment: scenePlan.location,
      cameraProfile: 'Kamera telefon pintar 9:16 menegak, 1x perspektif tanpa sempadan telefon atau mockup bingkai.',
      modestyRules,
      productIdentityRules: `Mengekalkan identiti visual produk ${product.name} (bentuk botol/bungkusan, warna, logo dan label).`,
      audioDirective: style.engine === 'nexabot'
        ? 'Nexabot meneliti produk lalu mencipta dialog Bahasa Melayu Malaysia secara bebas mengikut gaya, CTA dan arahan kreatif pelanggan.'
        : 'Tiada suara pertuturan (visual tulen, bunyi persekitaran / ASMR / audio bersesuaian).',
      promptVersion: GEMS_PROMPT_VERSION,
    };
  }

  /**
   * Compiles the complete Creative V6 payload for the specified provider.
   */
  static compile(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions = {}
  ): CompiledGenerationPrompt {
    const preflight = this.validatePreflight(product, style, options);
    const isMuslimah = options.isMuslimahModest ?? style.modestyLock;
    const isHandOnly = style.category === 'hand_demo' || style.category === 'product_handling' || style.category === 'pov' || style.id.startsWith('RH');

    // -------------------------------------------------------------------------
    // MASTERPROMPT LOCK V6 — LAYER 1: UNIVERSAL MANDATORY LOCKS
    // -------------------------------------------------------------------------

    // 1. PRODUCT IDENTITY MAX LOCK
    const identityLockDirectives = [
      `[PRODUCT IDENTITY MAX LOCK]`,
      `The uploaded product image is an authoritative identity reference for "${product.name}".`,
      `Preserve exact product geometry, shape, proportions, cap, material, logo, brand, label, typography, and packaging colour with stable consistency across all frames.`,
      productScaleDirective(product),
      `Strictly NO product morphing, NO duplicate products, NO changing labels, NO changing packaging colours, NO missing caps, NO oversized containers, NO floating objects, NO artificial product rotation, NO sudden disappearance, NO unexpected object replacement.`,
      `Never add a printed volume, size, specification, certification, ingredient, icon or word that is absent from the reference image. If small text is unreadable, leave it indistinct instead of inventing letters or numbers.`,
      `[SCREENSHOT CONTAMINATION CONTROL] If the reference is a marketplace or social screenshot, isolate the physical product identity and ignore prices, ratings, reviews, usernames, comments, buttons, navigation bars, shopping icons, seller UI and app borders. Never reproduce the screenshot or phone screen in the footage.`,
    ].join(' ');

    const hasAvatarReference = Boolean(options.avatarName);
    const hasBackgroundReference = Boolean(options.backgroundName);
    const duplicateProductReference = Number(hasAvatarReference) + Number(hasBackgroundReference) < 2;
    const avatarReferenceIndex = duplicateProductReference ? 3 : 2;
    const backgroundReferenceIndex = hasAvatarReference
      ? (duplicateProductReference ? 3 : 3)
      : (duplicateProductReference ? 3 : 2);
    const ingredientReferenceDirectives = [
      '[INGREDIENT REFERENCE — NEVER FIRST FRAME LOCK]',
      duplicateProductReference
        ? 'Reference images 1 and 2 are intentionally IDENTICAL copies of the same product. They are duplicate ingredient/subject identity references only and must be interpreted as one physical product, never two products.'
        : 'Reference image 1 is the product ingredient/subject identity reference. The remaining reference slots are reserved for the selected presenter and environment.',
      'Every uploaded reference is guidance for identity or environment only. No reference image is a start frame, opening frame, storyboard frame, background plate, mandatory composition, crop, camera angle or layout template.',
      'The first generated video frame must be a freshly composed live-action frame. Never reproduce, trace, extend, animate or closely match the product reference as the opening frame.',
      isHandOnly
        ? 'From the first instant, show a newly composed real-world scene with the physical product already grounded in the style-specific hand action.'
        : 'From the first instant, show the presenter already inside a believable real-world location with the physical product naturally held or used according to the selected style.',
      'The opening background, lighting arrangement, framing, scale, crop, perspective and hand placement must be visibly different from the isolated product reference.',
      'Never begin with a static product cutout, the reference-image background, a white border, an isolated packaging shot, a zoom-out from the uploaded image, or a still-to-motion transition.',
      'Natural movement must exist from frame zero: believable breathing or hand tension, a small gaze or wrist adjustment, and restrained handheld camera micro-shake.',
    ].join(' ');

    // 2. ZERO UI / PLATFORM / WATERMARK LOCK
    const zeroUiLockDirectives = [
      `[ZERO UI & WATERMARK LOCK]`,
      `Full-frame vertical 9:16 aspect ratio footage naturally recorded in physical space, WITHOUT displaying any smartphone border, phone mockup frame, or screen bezel.`,
      `Strictly NO TikTok logo, NO social media interface, NO user-added or fabricated watermark, NO phone frame, NO phone UI overlays, NO fake buttons, NO smartphone mockup, NO embedded video player, NO screen borders, NO playback controls, NO floating captions, NO UI overlay, NO picture-in-picture, NO yellow basket graphics, NO shopping app interface, NO username overlays, NO like/comment/share buttons. An authentic, unavoidable Nexabot Omni-Flash provider watermark is permitted; do not imitate or remove it.`,
      `No decorative sparkles, glints, star stickers, lens flares, floating symbols or animated graphic effects.`,
    ].join(' ');

    // 3. REALISTIC UGC / HUMAN REALISM LOCK (Includes smartphone 1x, iPhone 15 Pro, daylight 5500K)
    const realismDirectives = [
      `[REALISTIC UGC PROFILE]`,
      `Natural 1x smartphone camera optics, authentic neutral daylight where appropriate, single continuous 15-second handheld take, subtle micro-shake, realistic human skin with natural pores and textures, lifelike eye gaze, natural gravity and believable physical object contact.`,
      `Begin immediately in the live physical scene. Treat the uploaded image solely as a product identity reference; never paste it in as a still introductory frame or automatically use it as the first video frame.`,
      `Strictly NO jump cuts, NO push-in zoom, NO camera spin, NO crash pan, NO first-frame flash, NO synthetic colour grading, NO excessive cinematic effects, NO plastic skin, NO AI-generated look.`,
      HUMAN_REALISM_MASTERPROMPT_V8,
    ].join(' ');

    // 4. SHARIAH MODESTY LOCK V5
    let modestyDirectives = '';
    if (isMuslimah) {
      if (isHandOnly) {
        modestyDirectives = [
          `[SHARIAH MODESTY LOCK — HAND DEMO] Modesty Guardrail:`,
          `Exactly ONE naturally proportioned adult hand with sleeve fully covering wrist at all times.`,
          `Strictly NO rings, NO bracelets, NO nail polish, NO artificial nails. Exactly 5 natural fingers with normal realistic grip and anatomy.`,
        ].join(' ');
      } else {
        modestyDirectives = [
          `[SHARIAH MODESTY LOCK — PRESENTER] Modesty Guardrail:`,
          `Adult modest Malaysian Muslimah presenter: Hijab labuh fully covering hair, neck, and chest securely.`,
          `Loose-fitting modest clothing, long sleeves covering wrists at all times including arm transitions.`,
          `Strictly NO transparent fabric, NO tight outfits, NO jewellery (no rings, no bracelets, no necklaces), NO unintended hair or neck exposure during movements.`,
        ].join(' ');
      }
    } else {
      modestyDirectives = `[MODESTY GUIDELINE] Modesty Guardrail: Model wears neat, modern casual everyday attire appropriate for general Malaysian audiences.`;
    }

    const universalMasterPrompt = [
      MASTERPROMPT_PRIORITY_SYSTEM_V10,
      NEXABOT_PRODUCT_UNDERSTANDING_V10,
      identityLockDirectives,
      ingredientReferenceDirectives,
      zeroUiLockDirectives,
      realismDirectives,
      modestyDirectives,
    ].join(' ');

    // Route to provider compiler
    if (style.engine === 'runninghub') {
      return this.compileRunningHub(
        product,
        style,
        scenePlan,
        options,
        universalMasterPrompt,
        preflight
      );
    } else {
      return this.compileNexabot(
        product,
        style,
        scenePlan,
        options,
        universalMasterPrompt,
        preflight
      );
    }
  }

  /**
   * Nexabot Compiler (AffiMatik Voice, 15s, Malaysian Malay Spoken Dialogue)
   */
  private static compileNexabot(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions,
    universalMasterPrompt: string,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    const ctaMode = options.callToAction || 'none';
    const selectedCta = resolveCtaPhrase(ctaMode, options.customCta || '');
    const supportsSoundOnly = ['NX09', 'NX10', 'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19', 'NX11'].includes(style.id);
    const audioTreatment = supportsSoundOnly ? options.audioTreatment || 'voiceover' : 'voiceover';
    const audioDirective = audioTreatment === 'ambient'
      ? 'Natural room ambience only; silence is provider-dependent and remains experimental until output verification.'
      : audioTreatment === 'asmr'
        ? 'Natural product-handling ASMR only; silence is provider-dependent and remains experimental until output verification.'
        : 'Nexabot independently creates product-specific Malaysian Malay dialogue within 15 seconds from the image, selected style, CTA intent and optional customer creative direction.';

    // Authoritative Style Masterprompt V6
    const stylePromptFn = AUTHORITATIVE_STYLE_MASTERPROMPTS[style.id];
    let styleSpecificPrompt = '';
    const feature = (product.confirmedFeatures && product.confirmedFeatures[0]) || product.coreFunction || 'kegunaan harian';
    const useCase = product.usageContext || 'kegunaan seharian';
    const buyerProblem = product.buyerProblem || 'mencari pilihan yang praktikal';
    const qaQuestion = product.allowedQaQuestion || `Ada fungsi menarik pada ${product.spokenShortName || 'produk ni'}?`;

    if (stylePromptFn) {
      styleSpecificPrompt = stylePromptFn({
        productName: product.name,
        feature,
        useCase,
        buyerProblem,
        qaQuestion,
        useContext: product.usageContext || 'dapur atau ruang santai',
        relevantSurface: 'meja atau kaunter yang kemas',
        coreFunction: product.coreFunction || 'kegunaan harian',
      });
    } else {
      preflight.errors.push(`Gaya ${style.id} tiada masterprompt rasmi.`);
      preflight.isValid = false;
    }

    const selectedScene = getBuiltInScene(options.builtInSceneId);
    const hasAvatarReference = Boolean(options.avatarName);
    const hasBackgroundReference = Boolean(options.backgroundName);
    const duplicateProductReference = Number(hasAvatarReference) + Number(hasBackgroundReference) < 2;
    const avatarReferenceIndex = duplicateProductReference ? 3 : 2;
    const backgroundReferenceIndex = hasAvatarReference ? 3 : (duplicateProductReference ? 3 : 2);
    const personalizationDirectives = [
      '[PERSONALIZATION REFERENCES — ORDER AND ROLE LOCK]',
      duplicateProductReference
        ? 'Reference images 1 and 2 are the same PRODUCT IDENTITY authority uploaded twice to reinforce ingredient/subject identity. They represent one product only and neither may become the first video frame.'
        : 'Reference image 1 is the PRODUCT IDENTITY authority. Use it to preserve the exact product; it is not a mandatory first video frame.',
      options.avatarName
        ? `Reference image ${avatarReferenceIndex} is the selected PRESENTER IDENTITY reference named "${options.avatarName}". Preserve this adult person's recognizable face, skin tone, body proportions and modest appearance consistently. Do not blend the presenter with the product or copy the avatar image background.`
        : 'No avatar reference is selected. Create an appropriate adult Malaysian presenter only when the style requires one.',
      options.backgroundName
        ? `Reference image ${backgroundReferenceIndex} is the BACKGROUND/ENVIRONMENT reference named "${options.backgroundName}". Recreate its spatial character and setting only; never turn objects from that image into the product or presenter and never use it as a frozen opening frame.`
        : selectedScene
          ? `Use this customer-selected textual environment: ${selectedScene.directive}. This is a scene direction, not an image reference.`
          : 'Choose a believable environment appropriate to the actual product category.',
      options.niche && options.niche !== 'auto' ? `Customer-selected niche: ${options.niche}. Adapt buyer context and demonstrations to this niche without inventing product facts.` : '',
      options.voicePersonality && options.voicePersonality !== 'auto' ? `Customer-selected speaking personality: ${options.voicePersonality}. ${VOICE_PERSONALITY_DIRECTIONS[options.voicePersonality] || ''} Preserve the style identity while applying this vocal performance.` : '',
      options.storyboard && options.storyboard !== 'auto' ? `Customer-selected storyboard: ${options.storyboard}. Use it only when physically appropriate to the reference product.` : '',
      'Never quietly substitute, merge or ignore a selected reference. If a reference conflicts with safety or cannot be followed, keep the product identity authoritative and avoid fabricating substitute identities.',
    ].filter(Boolean).join(' ');

    // Visual Prompt
    const visualPrompt = [
      `One single continuous 15-second shot.`,
      styleSpecificPrompt,
      personalizationDirectives,
      universalMasterPrompt,
      options.creativeInstruction ? `Creative Directive: ${options.creativeInstruction}` : '',
      audioTreatment === 'ambient' ? 'Audio treatment: natural room ambience only. Do not create spoken words, mouth speech or narration.' : '',
      audioTreatment === 'asmr' ? 'Audio treatment: close natural product-handling ASMR only. Do not create spoken words, mouth speech or narration.' : '',
    ].filter(Boolean).join(' ');

    const commonTruthfulness = [
      'If the image and customer-confirmed facts do not establish a claim, omit it entirely. Never invent a special formula, ingredients, certifications, medical outcomes, personal-use results, prices or testimonials.',
      'Never say or imply “pilihan terbaik”, “wajib”, personal use, purchase, dosage, absorption, symptom relief, energy, focus, wellness or health results. For supplements or health products, only use the customer-confirmed fact and clearly readable label facts; never explain an unverified effect on the body.',
      'Never describe a product as wireless, rechargeable, battery-powered, portable or cable-free unless that exact fact is explicitly customer-confirmed. Use Malaysian Malay only; forbidden Indonesian forms include kamu, coba, kesehatan, ianya and banget.',
      'Never repeat or semantically paraphrase a hook, fact, sentence, CTA or ending.',
    ].join(' ');

    const providerDialogueDirective = audioTreatment !== 'voiceover'
      ? [
          `[EXPERIMENTAL ${audioTreatment.toUpperCase()} AUDIO MODE]`,
          audioTreatment === 'ambient'
            ? 'Create only believable low-level room ambience that matches the visible environment.'
            : 'Create only subtle, physically synchronized product-handling sounds from the visible grip, contact and placement.',
          'Strictly no spoken dialogue, no voiceover, no lip-sync speech, no music and no artificial sound effects. Do not narrate the hand, camera, packaging or movement.',
          commonTruthfulness,
        ].join(' ')
      : [
          MALAYSIAN_AFFILIATE_VOICE_DNA_V6,
          '[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]',
          'AffiMatik has not supplied, generated, previewed or approved spoken sentences. Inspect the uploaded product reference and independently write original natural Malaysian Malay dialogue and lip-sync.',
          `Follow the unique ${style.id} scene purpose, opening, buyer problem, product interaction, speaking personality, camera direction and ending. Create one distinct product-specific hook, one grounded practical point and one concise ending.`,
          'Never narrate camera framing, bottle rotation, hand movement, label visibility, product colour or packaging appearance.',
          selectedCta ? `Customer-selected CTA intent: ${ctaMode}. The intended target is “${selectedCta}”. Integrate that action naturally once in your own product-specific conversation; never add CTA graphics or repeat it.` : 'The customer selected Tanpa CTA. Do not add a spoken call to action.',
          options.creativeInstruction ? 'The customer-authored Creative Directive may include their own requested wording. Preserve it as direction without AffiMatik rewriting, completing or paraphrasing it.' : '',
          'Finish speech naturally before the clip ends. Do not fill time through repetition, dragged-out words or a generic fallback. If speech ends earlier, continue meaningful physical interaction and never freeze the subject.',
          commonTruthfulness,
        ].filter(Boolean).join(' ');
    // Put the short, test-derived speech contract first. A controlled real
    // provider comparison showed that burying these rules after the long visual
    // locks allowed unsupported performance claims and a repeated cut-off ending.
    const fullPayload = audioTreatment === 'voiceover'
      ? `${NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10} ${visualPrompt} ${providerDialogueDirective}`
      : `${visualPrompt} ${providerDialogueDirective}`;

    return {
      provider: 'nexabot',
      providerPrompt: fullPayload,
      visualPrompt,
      spokenScript: undefined,
      continuityAnchor: product.name,
      audioDirective,
      safetyRules: [
        'AffiMatik Voice (15s) native Malaysian Malay spoken audio',
        'Pawarna Masterprompt Director V10 priority system enforced',
        'No Indonesia loanwords or slang',
        'Zero UI, no TikTok logo, no phone frame',
        'No unverified medical or cosmetic claims',
        'Product Identity Max Lock enforced',
        'Shariah Modesty Lock V5 enforced',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
      promptVersion: GEMS_PROMPT_VERSION,
    };
  }

  /**
   * RunningHub Compiler (AffiMatik Motion, 15s, Continuous Visual Scene, No Spoken Dialogue)
   */
  private static compileRunningHub(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions,
    universalMasterPrompt: string,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    // 15-second creative timeline progression (0-4s establish, 4-10s authentic action, 10-15s hold and conclude)
    const timelineGuideline = [
      'Timing Structure: One continuous 15-second physical shot.',
      '0s to 4s: Establish the product naturally in the setting with clear label visibility.',
      '4s to 10s: One simple authentic physical action matching the official style definition.',
      '10s to 15s: Hold naturally and conclude smoothly without abrupt cuts or sudden movements.',
    ].join(' ');

    // Authoritative Style Masterprompt V5
    const stylePromptFn = AUTHORITATIVE_STYLE_MASTERPROMPTS[style.id];
    let styleSpecificPrompt = '';
    const feature = (product.confirmedFeatures && product.confirmedFeatures[0]) || product.coreFunction || 'kegunaan harian';
    const useContext = product.usageContext || 'ordinary domestic context';
    const relevantSurface = product.category.toLowerCase().includes('gadget') || style.id === 'RH17'
      ? 'a tidy study or workspace desk'
      : product.category.toLowerCase().includes('makan')
      ? 'a clean kitchen dining table'
      : 'a clean domestic tabletop surface';

    if (stylePromptFn) {
      styleSpecificPrompt = stylePromptFn({
        productName: product.name,
        feature,
        useCase: useContext,
        buyerProblem: product.buyerProblem || '',
        qaQuestion: '',
        useContext,
        relevantSurface,
        coreFunction: product.coreFunction || 'kegunaan harian',
      });
    } else {
      styleSpecificPrompt = `15-second visual showcase video. Setting: ${scenePlan.location}. Action: ${scenePlan.primaryAction}.`;
    }

    const visualPrompt = [
      styleSpecificPrompt,
      timelineGuideline,
      universalMasterPrompt,
      options.creativeInstruction ? `Creative Directive: ${options.creativeInstruction}` : '',
      'Audio: Purely silent visuals, natural room ambience, packaging sounds or gentle ASMR background sound only. Strictly NO spoken dialogue and NO lip-sync movement.',
    ].filter(Boolean).join(' ');

    return {
      provider: 'runninghub',
      providerPrompt: visualPrompt,
      visualPrompt,
      continuityAnchor: `${product.name} (steady frame hold at 14.8s mark)`,
      audioDirective: 'No spoken dialogue or lip-sync movements (Visual showcase, ambient/ASMR sound only).',
      safetyRules: [
        'AffiMatik Motion (15s) visual realism showcase',
        'GEMS V5 Masterprompt Lock enforced',
        'No spoken voiceover or dialogue',
        'Zero UI, no TikTok logo, no phone frame',
        'Realistic physical movement without morphing',
        'Product Identity Max Lock enforced',
        'Shariah Modesty Lock V5 enforced',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
      promptVersion: GEMS_PROMPT_VERSION,
    };
  }
}
