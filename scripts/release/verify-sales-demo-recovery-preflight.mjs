import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('output/provider-qa/sales-demo-recovery-manifest.json');
const outputPath = resolve('output/provider-qa/sales-demo-recovery-static-preflight.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const expected = {
  NX01: { product: 'SERIYA Radiance Serum', audio: 'SPOKEN PRESENTER', cta: 'Beg Kuning' },
  NX17: { product: 'POTONGGO Manual Chopper', audio: 'SPOKEN PRESENTER', cta: 'Tekan butang di bawah.' },
  NX09: { product: 'AROMAÉ Home Mist', audio: 'OFF-CAMERA VOICEOVER', cta: 'Kalau nak tanya lagi, boleh DM.' },
};

if (!Array.isArray(manifest) || manifest.length !== 3) throw new Error('Expected exactly three recovery candidates.');
const rows = manifest.map((item) => {
  const target = expected[item.styleId];
  if (!target || target.product !== item.productName) throw new Error(`Unexpected candidate ${item.styleId}/${item.productName}.`);
  const prompt = String(item.prompt || '');
  const audioModes = [...prompt.matchAll(/Effective audio mode: ([A-Z -]+)/g)].map((match) => match[1].trim());
  const ctaOccurrences = prompt.split(target.cta).length - 1;
  const checks = {
    promptHasContent: prompt.length > 5000,
    evidenceBucketsSeparated: prompt.includes('[PRODUCT EVIDENCE CONTRACT — KEEP SOURCES SEPARATE]')
      && prompt.includes('Image-observable physical facts:')
      && prompt.includes('No customer-confirmed functional or benefit fact was supplied')
      && prompt.includes('Unsupported or unresolved claims:'),
    noKnownInventedBenefit: !/memang best untuk kulit|suasana yang lebih selesa|boleh pertimbangkan NURIVA|membantu melembapkan|kesan segera/i.test(prompt),
    noHardcodedProductScript: !/Script:\s*[“"']|approved spoken script|exact spoken script|\$\{p\.spokenScript\}|\{script_body\}/i.test(prompt),
    oneEffectiveAudioMode: audioModes.length === 1 && audioModes[0] === target.audio,
    ctaSelectedOnce: ctaOccurrences === 1,
    ctaIsFinalSpeech: prompt.includes('This CTA must be the final spoken utterance')
      && prompt.includes('generate zero additional speech or speech-like syllables'),
    identityOnlyReferenceRole: prompt.includes('preserve the physical product identity but exclude its source composition')
      && prompt.includes('do not copy the original surface, decorative props, lighting pattern'),
    independentOpening: prompt.includes('Do not animate, extend or reconstruct the uploaded product screenshot as the opening shot')
      && prompt.includes('The first generated video frame must be a freshly composed live-action frame'),
    realisticScaleAnchors: prompt.includes('[PLAUSIBLE PRODUCT SCALE LOCK]')
      && /hands|furniture|human body|counters|shelves|household items/.test(prompt),
    noInternalDialogueOwnership: prompt.includes('Nexabot independently writes the dialogue; AffiMatik supplies no spoken script'),
  };
  return {
    styleId: item.styleId,
    productName: item.productName,
    category: item.category,
    imagePath: item.imagePath,
    observedPhysicalFact: item.fact,
    confirmedFacts: item.confirmedFacts,
    usageContext: item.usageContext,
    effectiveAudioMode: audioModes[0] || null,
    selectedCta: target.cta,
    promptLength: prompt.length,
    promptSha256: createHash('sha256').update(prompt).digest('hex'),
    checks,
    pass: Object.values(checks).every(Boolean),
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  paidProviderSubmissions: 0,
  promptVersion: 'pawarna-masterprompt-director-v10.2-quality-audit',
  candidates: rows,
  distinctPrompts: new Set(rows.map((row) => row.promptSha256)).size === 3,
  pass: rows.every((row) => row.pass) && new Set(rows.map((row) => row.promptSha256)).size === 3,
};
mkdirSync(resolve('output/provider-qa'), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
