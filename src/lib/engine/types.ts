/**
 * AFFIMATIK by Pawarna — Dynamic Prompt Engine Types
 */

import { VideoStyle, EngineType, AudioMode } from '../styles/types';

export interface ProductProfile {
  name: string;
  category: string;
  brand?: string;
  packagingFormat: 'bottle' | 'box' | 'pouch' | 'tube' | 'jar' | 'apparel' | 'gadget' | 'general';
  shapeDescription?: string;
  dominantColors?: string[];
  verifiedFacts: string[];
  prohibitedClaims: string[];
  hasPhysicalControls?: boolean;
  isLiquidOrPowder?: boolean;
  isWearableOrFashion?: boolean;
  sourceConfidence: 'verified_user' | 'ai_interpreted';
}

export interface ScenePlan {
  mainSubject: string;
  location: string;
  lighting: string;
  cameraDistance: string;
  cameraMovement: string;
  startPose: string;
  actionProgression: string;
  endPose: string;
  primaryAction: string;
  audioPolicy: AudioMode;
  targetDurationSeconds: 10 | 15;
}

export interface CompiledGenerationPrompt {
  provider: EngineType;
  providerPrompt: string; // The full payload string submitted to the provider
  visualPrompt: string;
  spokenScript?: string;
  continuityAnchor?: string;
  audioDirective: string;
  safetyRules: string[];
  preflightValid: boolean;
  validationErrors: string[];
}
