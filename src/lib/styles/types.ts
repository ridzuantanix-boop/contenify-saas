/**
 * AFFIMATIK by Pawarna — Video Style Registry & Type Definitions
 * Follows CONTENIFY V2.0 / AffiMatik Specification
 */

export type StyleCategory =
  | 'all'
  | 'creator_review'
  | 'hand_demo'
  | 'problem_solution'
  | 'unboxing'
  | 'asmr'
  | 'fashion'
  | 'lifestyle'
  | 'product_usage';

export type EngineType = 'nexabot' | 'runninghub';

export type AudioMode = 'spoken_bm' | 'no_speech' | 'off_camera_narration' | 'ambient';

export type AssetType =
  | 'product_image'
  | 'packaging_image'
  | 'avatar_reference'
  | 'lifestyle_reference';

export type QualityStatus = 'untested' | 'testing' | 'verified' | 'published';

export type PublicationStatus = 'draft' | 'published' | 'disabled' | 'archived';

export interface ActionPlan {
  primaryAction: string;
  startPose: string;
  actionProgression: string;
  endPose: string;
  cameraMovement: string;
  lightingSpec: string;
  scriptTemplate?: string;
}

export interface VideoStyle {
  id: string; // e.g. 'NX01', 'RH01'
  slug: string;
  name: string;
  benefit: string; // One-line core value proposition
  description: string;
  category: StyleCategory;
  engine: EngineType;
  durationSeconds: 10 | 15;
  audioMode: AudioMode;
  supportedProductCategories: string[]; // ['*'] for all
  requiredAssets: AssetType[];
  optionalAssets: AssetType[];
  actionType: string;
  cameraProfile: string;
  identityLock: boolean;
  realismLock: boolean;
  modestyLock: boolean;
  promptTemplateVersion: string;
  qualityStatus: QualityStatus;
  publicationStatus: PublicationStatus;
  previewVideoUrl: string | null;
  tags: string[];
  actionPlan: ActionPlan;
  legacyAliasId?: string; // For backward compatibility with v0.1 presets
}

export interface StyleFilterOptions {
  category?: StyleCategory;
  hasVoice?: boolean;
  engine?: EngineType;
  duration?: 10 | 15;
  requiresAvatar?: boolean;
  onlyOneImage?: boolean;
  searchQuery?: string;
  publicationStatus?: PublicationStatus;
}
