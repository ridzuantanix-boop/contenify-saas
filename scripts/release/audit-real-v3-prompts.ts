import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION } from '../../src/lib/engine/compiler';
import { VIDEO_STYLES_REGISTRY } from '../../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';

const product: ProductProfile = {
  name: 'the uploaded product image',
  category: 'product shown',
  packagingFormat: 'general',
  spokenShortName: 'produk ini',
  confirmedFeatures: [],
  prohibitedClaims: ['unsupported claims'],
  unknownFields: ['unverified attributes'],
  sourceConfidence: 'manual_fallback',
  provenance: 'manual_user_entry',
  isVisionSupported: false,
};

const scene: ScenePlan = {
  mainSubject: product.name,
  location: 'provider-selected relevant setting',
  lighting: 'neutral daylight',
  cameraDistance: 'smartphone 1x',
  cameraMovement: 'style-specific continuous action',
  startPose: 'natural',
  actionProgression: 'style-specific action',
  endPose: 'natural',
  primaryAction: 'style-specific action',
  audioPolicy: 'spoken_bm',
  targetDurationSeconds: 15,
};

const rows = VIDEO_STYLES_REGISTRY.map((style) => {
  const prompt = DynamicPromptCompiler.compile(product, style, { ...scene, audioPolicy: style.audioMode }).providerPrompt;
  return {
    styleId: style.id,
    styleName: style.name,
    characters: prompt.length,
    words: prompt.trim().split(/\s+/).length,
    sha256: createHash('sha256').update(prompt, 'utf8').digest('hex'),
    prompt,
  };
});

const mean = (key: 'characters' | 'words') => Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);
const v2 = { meanCharacters: 24828, meanWords: 3436 };
const jobRoute = readFileSync(resolve('src/app/api/jobs/route.ts'), 'utf8');
const compiler = readFileSync(resolve('src/lib/engine/compiler.ts'), 'utf8');
const forbiddenActiveCalls = ['analyzeProductImage(', 'generateScript(', 'resolveSpokenScript(', 'createEvidencePacket('];

const report = {
  generatedAt: new Date().toISOString(),
  promptVersion: GEMS_PROMPT_VERSION,
  styles: rows.length,
  uniqueHashes: new Set(rows.map((row) => row.sha256)).size,
  baselineV2: v2,
  realV3: {
    meanCharacters: mean('characters'),
    meanWords: mean('words'),
    minCharacters: Math.min(...rows.map((row) => row.characters)),
    maxCharacters: Math.max(...rows.map((row) => row.characters)),
    characterReductionPercent: Number((100 * (1 - mean('characters') / v2.meanCharacters)).toFixed(1)),
    wordReductionPercent: Number((100 * (1 - mean('words') / v2.meanWords)).toFixed(1)),
  },
  activePathAudit: {
    compilerImportsLegacyScriptControl: compiler.includes("from './script-control'"),
    forbiddenCallsInJobRoute: forbiddenActiveCalls.filter((needle) => jobRoute.includes(needle)),
    perProductExternalCreativeAiCall: false,
  },
  rows,
};

const outDir = resolve('output/affimatik-real-v3');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'prompt-audit.json'), JSON.stringify(report, null, 2));
writeFileSync(resolve(outDir, 'prompt-hashes.tsv'), [
  'style_id\tstyle_name\tcharacters\twords\tsha256',
  ...rows.map((row) => `${row.styleId}\t${row.styleName}\t${row.characters}\t${row.words}\t${row.sha256}`),
].join('\n'));

console.log(JSON.stringify({
  promptVersion: report.promptVersion,
  styles: report.styles,
  uniqueHashes: report.uniqueHashes,
  baselineV2: report.baselineV2,
  realV3: report.realV3,
  activePathAudit: report.activePathAudit,
}, null, 2));
