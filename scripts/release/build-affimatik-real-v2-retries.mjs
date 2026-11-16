import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('output/affimatik-real-v2-release');
const initial = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const retryRoot = resolve(root, 'retries');
const promptsDir = resolve(retryRoot, 'prompts');
mkdirSync(promptsDir, { recursive: true });
const defects = {
  NX01:'Remove unsupported superlatives and body-relief implications. Use one image-grounded identity or ordinary category observation, then complete the exact CTA once.',
  NX05:'The previous CTA was cut off. Use one grounded observation only and reserve enough natural speaking room for the complete exact CTA.',
  NX09:'Do not invent scent, freshness, calming, deodorizing or longevity. Build the faceless selling moment from recognizable category and visible identity only; complete CTA once.',
  NX10:'Do not infer antioxidant or health effects. Use only clearly readable label information without converting it into an efficacy claim; complete CTA once.',
  RH01:'The previous ending repeated and corrupted the CTA. Preserve natural handling; use one grounded buyer observation and speak the exact CTA once as the complete ending.',
  RH03:'Do not infer moisturising or beauty outcomes. Preserve pick-up/put-down physics, one visible product-specific thought and one complete CTA.',
  RH04:'Do not infer pain or body relief. Keep the shelf action, one ordinary category observation and the complete CTA once.',
  RH17:'Do not claim chopping speed, fineness or time saving. Preserve the visible manual mechanism and finish the exact CTA without cutoff.',
  RH19:'Do not invent scent, odor removal, room freshness or longevity. Use one recognizable category observation; finish the exact CTA once.',
  NX11:'Do not infer bodily relief or efficacy. Keep POV buyer consideration grounded in visible identity and finish the exact CTA before the cut.',
  NX13:'Do not claim instant chopping or time saving. Keep one ordinary visible manual interaction and speak the exact CTA once, never twice.',
  NX14:'The previous CTA was cut off. Remove an earlier generic benefit if needed and complete the exact CTA once with natural rhythm.',
  NX15:'The previous CTA stuttered and repeated. Use one grounded product observation and deliver the exact CTA once without restarting it.',
  NX16:'Do not repeat the CTA or infer texture, stickiness or protection beyond clearly readable label identity. End with the exact CTA once.',
  NX17:'The previous CTA began with wrong words and repeated. Use one supported visible observation and finish the exact CTA once.',
  NX21:'Do not infer fabric comfort, softness or cooling. Discuss only visible cut, pattern, coverage or drape, then complete the exact CTA once.',
  NX23:'Do not infer comfort, cooling, convenience or time saving. Use one visible drape or coverage observation and complete the exact CTA once.',
  NX27:'Do not claim non-stick, fast heating, durability, lightness or cooking performance. Use visible shape or ordinary cooking action only; complete CTA once.',
  NX29:'Do not claim even heating or performance. Use only visible door/control layout and ordinary buyer consideration; complete CTA once without repetition.',
  NX30:'The previous CTA never completed. Do not claim speed, fineness, eye comfort or performance. Use one visible manual action and reserve enough natural room for the exact CTA.',
};
const ids = Object.keys(defects);
if (ids.length !== 20) throw new Error('Selective retry plan must contain exactly 20 styles.');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const jobs = ids.map((styleId) => {
  const source = initial.jobs.find((job) => job.styleId === styleId);
  if (!source) throw new Error(`Missing initial job ${styleId}.`);
  const basePrompt = readFileSync(source.promptPath, 'utf8');
  const correction = `[SELECTIVE REAL V2 DEMO RETRY — ${styleId} OBSERVED DEFECT ONLY] Preserve the full approved ${styleId} creative director, Pawarna selling energy, camera, performance, color, product scale and Shariah rules. Nexabot still writes all dialogue. ${defects[styleId]} Do not use a fixed script or fixed word count. Prefer one meaningful product-specific observation rather than stacking generic benefits. The customer-selected CTA remains the final spoken utterance: finish every word naturally before the cut, speak it exactly once, and add no speech-like sound afterward.`;
  const prompt = `${basePrompt} ${correction}`;
  const promptPath = resolve(promptsDir, `${styleId}.txt`);
  writeFileSync(promptPath, prompt, 'utf8');
  return { ...source, retryReason: defects[styleId], promptPath, promptLength: prompt.length, promptSha256: sha(prompt) };
});
const manifest = { campaign:'AFFIMATIK_REAL_V2_SELECTIVE_RETRIES', createdAt:new Date().toISOString(), sourceCampaign:initial.campaign, exactSubmissionLimit:20, expectedCostPerJob:0.3, maximumRetryDebit:6, totalCampaignBudget:15, automaticRetries:false, jobs };
writeFileSync(resolve(retryRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ retryStyles:ids, total:jobs.length, maximumRetryDebit:6 }, null, 2));
