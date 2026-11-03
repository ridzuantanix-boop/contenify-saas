export interface PromptPreset {
  id: string;
  name: string;
  category: 'affiliate' | 'ugc' | 'demo' | 'aesthetic' | 'unboxing';
  description: string;
  targetDurationSeconds: 10 | 15;
  supportedProviders: ('nexabot' | 'runninghub' | 'mock')[];
  version: number;
  systemRules: string;
  templateText: string;
  options: {
    allowsAvatar: boolean;
    requiresProductImage: boolean;
    supportsSellingCTA: boolean;
  };
}

export const OFFICIAL_GEMS_PRESETS: PromptPreset[] = [
  {
    id: 'gem_real_affiliate',
    name: 'Real Affiliate Creator (TikTok / Shopee)',
    category: 'affiliate',
    description: 'Natural Malaysian affiliate creator sharing honest genuine product recommendation in casual setting.',
    targetDurationSeconds: 10,
    supportedProviders: ['nexabot', 'runninghub', 'mock'],
    version: 1,
    systemRules:
      'Natural conversational Malaysian Malay, friendly everyday tone. No Indonesian loanwords (use "cantik", "berbaloi", "senang", not "bagus banget" or "keren"). Modest attire, tidy indoor background.',
    templateText:
      'A natural Malaysian creator holding and introducing {product_name}. The creator speaks enthusiastically to the camera: "{script_body}". Realistic smartphone UGC recording style, natural warm ambient lighting, crisp product clarity.',
    options: {
      allowsAvatar: true,
      requiresProductImage: true,
      supportsSellingCTA: true,
    },
  },
  {
    id: 'gem_realistic_ugc',
    name: 'Realistic UGC Problem-Solver',
    category: 'ugc',
    description: 'High-converting UGC video highlighting common daily problem and revealing product as solution.',
    targetDurationSeconds: 10,
    supportedProviders: ['nexabot', 'runninghub', 'mock'],
    version: 1,
    systemRules:
      'Direct engaging hook in first 2 seconds. Authentic Malaysian Malay speech. Genuine facial expressions, no exaggerated fake claims.',
    templateText:
      'Malaysian creator starting with a relatable everyday challenge: "{problem_hook}". Then smoothly transitions to showing {product_name}: "{solution_script}". Close-up on product usage, natural handheld camera motion.',
    options: {
      allowsAvatar: true,
      requiresProductImage: true,
      supportsSellingCTA: true,
    },
  },
  {
    id: 'gem_product_hand_demo',
    name: 'Product Hand Demo (No Face)',
    category: 'demo',
    description: 'Clean focused hands-only demonstration of product texture, packaging, and real application.',
    targetDurationSeconds: 15,
    supportedProviders: ['runninghub', 'nexabot', 'mock'],
    version: 1,
    systemRules:
      'Hands-only demonstration. Neatly groomed hands, natural skin tone, modest covered wrists if Muslimah aesthetic, no loud jewelry. Zero clutter in background. Accurate product scale.',
    templateText:
      'Clean aesthetic tabletop presentation. Two well-groomed hands gently unboxing and demonstrating {product_name}. Close-up macro shots revealing premium texture and details of {product_facts}. Smooth slow motion, bright studio lighting, soft reflections.',
    options: {
      allowsAvatar: false,
      requiresProductImage: true,
      supportsSellingCTA: false,
    },
  },
  {
    id: 'gem_unboxing_studio',
    name: 'Unboxing Studio Reveal',
    category: 'unboxing',
    description: 'Crisp studio aesthetic unboxing revealing package opening and first-look product presentation.',
    targetDurationSeconds: 15,
    supportedProviders: ['runninghub', 'mock'],
    version: 1,
    systemRules:
      'Studio quality 4k aesthetic. Crisp audio cues, smooth cinematic dolly movement. Preserve product logo and typography with zero visual distortion.',
    templateText:
      'Cinematic unboxing video of {product_name}. Modern minimalist studio desk with pastel accents. Hands carefully lifting product from sleek packaging, highlighting {product_facts}. 24fps filmic color grading, soft bokeh background.',
    options: {
      allowsAvatar: false,
      requiresProductImage: true,
      supportsSellingCTA: false,
    },
  },
  {
    id: 'gem_faceless_aesthetic',
    name: 'Faceless Lifestyle Aesthetic',
    category: 'aesthetic',
    description: 'Viral faceless aesthetic lifestyle B-roll with elegant product integration for high-end brands.',
    targetDurationSeconds: 10,
    supportedProviders: ['nexabot', 'runninghub', 'mock'],
    version: 1,
    systemRules:
      'Aesthetic cozy ambient setting. Soft morning golden hour lighting, clean minimalist Malaysian home interior.',
    templateText:
      'Aesthetic cozy lifestyle scene. Ambient morning light falling on {product_name} placed on a wooden coffee table beside a book and coffee. Smooth gentle camera pan, soft focus, serene peaceful atmosphere.',
    options: {
      allowsAvatar: false,
      requiresProductImage: true,
      supportsSellingCTA: false,
    },
  },
];
