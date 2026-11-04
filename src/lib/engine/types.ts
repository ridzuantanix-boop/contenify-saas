/**
 * AFFIMATIK by Pawarna — Dynamic Prompt Engine Types (V3)
 * Truthful Product Intelligence, Visual Grounding, and Scene Planning Types
 */

import { VideoStyle, EngineType, AudioMode } from '../styles/types';

export interface ProductVisualAttributes {
  packagingType?: string;
  shapeDescription?: string;
  visibleColors?: string[];
  visibleBrandText?: string[];
  physicalForm?: 'liquid' | 'powder' | 'cream' | 'solid' | 'fabric' | 'electronic' | 'packaged';
}

export interface ProductProfile {
  name: string;
  category: string;
  brand?: string;
  packagingFormat: 'bottle' | 'box' | 'pouch' | 'tube' | 'jar' | 'apparel' | 'gadget' | 'general';
  shapeDescription?: string;
  dominantColors?: string[];
  visualAttributes?: ProductVisualAttributes;
  confirmedFeatures?: string[]; // User-confirmed product benefits/specs only
  verifiedFacts?: string[]; // Backward compatibility alias
  inferredAttributes?: string[]; // Visually inferred attributes labeled clearly as inferences
  unknownFields?: string[]; // Explicitly unresolved/unknown fields (no hallucination)
  intendedAudience?: string;
  approvedClaims?: string[];
  prohibitedClaims: string[];
  hasPhysicalControls?: boolean;
  isLiquidOrPowder?: boolean;
  isWearableOrFashion?: boolean;
  sourceConfidence: 'verified_user' | 'vision_grounded' | 'manual_fallback' | 'ai_interpreted';
  provenance?: 'manual_user_entry' | 'image_vision_extracted' | 'source_grounded';
  isVisionSupported?: boolean;
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
  providerPrompt: string; // The complete payload string submitted to the provider
  visualPrompt: string;
  spokenScript?: string;
  continuityAnchor?: string;
  audioDirective: string;
  safetyRules: string[];
  preflightValid: boolean;
  validationErrors: string[];
}
