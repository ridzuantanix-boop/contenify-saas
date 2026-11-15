import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..', '..');
const sourcePath = resolve(repo, 'scripts/release/fixtures/pov-affiliate-goyang-v6.1-original.txt');
const outDir = resolve(repo, 'output/provider-qa/final-owner-creative-override');
const adaptedPath = resolve(outDir, 'pov-affiliate-goyang-v6.1-nexabot-15s-owner-approved.txt');
const diffPath = resolve(outDir, 'duration-only-diff.json');
const summaryPath = resolve(outDir, 'duration-only-diff.md');

mkdirSync(outDir, { recursive: true });

const source = readFileSync(sourcePath, 'utf8');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const changes: Array<{ from: string; to: string; count: number; reason: string }> = [];
let adapted = source;

function replaceExact(from: string, to: string, reason: string, expectedCount = 1) {
  const count = adapted.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} occurrence(s), found ${count}: ${JSON.stringify(from)}`);
  }
  adapted = adapted.split(from).join(to);
  changes.push({ from, to, count, reason });
}

replaceExact(
  'script must still fit naturally within 10 seconds',
  'script must still fit naturally within 15 seconds',
  'Duration compatibility only.',
);
replaceExact(
  'Generate ONE complete EXACTLY 10-second vertical 9:16 Malaysian affiliate POV video.',
  'Generate ONE complete EXACTLY 15-second vertical 9:16 Malaysian affiliate POV video.',
  'Duration compatibility only.',
);
replaceExact(
  'Treat the entire 10-second video as ONE continuous physical scene.',
  'Treat the entire 15-second video as ONE continuous physical scene.',
  'Duration compatibility only.',
);
replaceExact(
  '32–38 Malay words.',
  '40–46 Malay words.',
  'Extend the original fast conversational delivery proportionately without forcing speech across the whole 15 seconds.',
);
replaceExact(
  '40 spoken words.',
  '48 spoken words.',
  'Allow the original problem-product-benefit-FOMO-CTA structure more room at 15 seconds.',
);
replaceExact(
  'DO NOT exceed 40 words.',
  'DO NOT exceed 48 words.',
  'Duration-adjusted hard ceiling; still requires short phrases and a complete ending.',
);
replaceExact(
  'CTA begins approximately 6.8–7.4 seconds.',
  'CTA begins approximately 10.0–11.0 seconds.',
  'Move the original CTA naturally toward the end of a 15-second clip.',
);
replaceExact(
  'CTA must be completely finished by approximately 9.2 seconds.',
  'CTA must be completely finished by approximately 13.2 seconds.',
  'Reserve at least about 1.8 seconds for the original natural physical ending.',
);
replaceExact(
  'Remaining time:\nnatural hand movement only.',
  [
    'Remaining time:',
    'natural hand movement and non-verbal room sound only.',
    '',
    'After the final word of the CTA:',
    'STOP all speech completely.',
    'Do not add a new word, syllable, phoneme, outro, repetition, filler or speech-like sound.',
  ].join('\n'),
  'Duration-ending compatibility: prevent post-CTA gibberish while preserving the original CTA delivery and physical ending.',
);
replaceExact(
  '- over 40 words',
  '- over 48 words',
  'Keep final validation aligned with the duration-adjusted ceiling.',
);
replaceExact(
  'ONE EXACTLY 10-second 9:16 Malaysian faceless affiliate video.',
  'ONE EXACTLY 15-second 9:16 Malaysian faceless affiliate video.',
  'Duration compatibility only.',
);
replaceExact(
  '- 32–38 WORD TARGET',
  '- 40–46 WORD TARGET',
  'Keep the final output checklist aligned with the duration-adjusted target.',
);
replaceExact(
  '- HARD MAX 40 WORDS',
  '- HARD MAX 48 WORDS',
  'Keep the final output checklist aligned with the duration-adjusted ceiling.',
);

const forbiddenCreativeEdits = [
  'REAL HUMAN MALAY VOICE — ABSOLUTE LOCK',
  'ANTI-TTS / ANTI-AI VOICE LOCK',
  'FOMO PRIORITY RULE',
  'FIXED INTERNAL SCENE',
  'Tekan button di bawah, okay?',
  'Include ONE short natural playful goyang.',
];
for (const anchor of forbiddenCreativeEdits) {
  if (!source.includes(anchor) || !adapted.includes(anchor)) {
    throw new Error(`Creative anchor was lost or rewritten: ${anchor}`);
  }
}

const record = {
  title: 'POV AFFILIATE GOYANG V6.1 — owner-approved 15-second duration adaptation',
  sourcePath,
  sourceSha256: sha256(source),
  adaptedPath,
  adaptedSha256: sha256(adapted),
  originalCharacters: source.length,
  adaptedCharacters: adapted.length,
  changes,
  creativeDirectionChanges: 0,
  providerSubmissions: 0,
  productionChanges: 0,
};

writeFileSync(adaptedPath, adapted, 'utf8');
writeFileSync(diffPath, JSON.stringify(record, null, 2), 'utf8');
writeFileSync(summaryPath, [
  '# Owner-approved duration-only adaptation',
  '',
  `Source SHA-256: \`${record.sourceSha256}\``,
  '',
  `Adapted SHA-256: \`${record.adaptedSha256}\``,
  '',
  'The creative masterprompt remains the original POV AFFILIATE GOYANG™ V6.1. No V10.2 voice DNA, dialogue framework, product-fact rubric, scene director or AffiMatik-authored script was inserted.',
  '',
  '## Exact changes',
  '',
  ...changes.flatMap((change, index) => [
    `${index + 1}. **${change.reason}**`,
    '',
    '   Before:',
    '',
    '   ```text',
    ...change.from.split('\n').map((line) => line ? `   ${line}` : ''),
    '   ```',
    '',
    '   After:',
    '',
    '   ```text',
    ...change.to.split('\n').map((line) => line ? `   ${line}` : ''),
    '   ```',
    '',
  ]),
  '## Preserved without creative modification',
  '',
  '- Original spontaneous Malaysian affiliate voice and imperfect rhythm.',
  '- Original hook, product, benefit, supported-FOMO and CTA flow.',
  '- Original fixed tabletop composition, product handling and playful goyang.',
  '- Original CTA wording and casual delivery.',
  '- Nexabot-owned dialogue creation; no AffiMatik scriptwriter.',
  '',
  'No provider job was submitted and production was not changed.',
  '',
].join('\n'), 'utf8');

console.log(JSON.stringify(record, null, 2));
