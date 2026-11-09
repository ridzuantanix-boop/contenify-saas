import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const apiKey = process.env.NEXABOT_API_KEY;
if (!apiKey) throw new Error('NEXABOT_API_KEY diperlukan.');

const base = 'https://nexabot.id';
const inputPath = resolve(process.env.INGREDIENT_TEST_IMAGE || 'output/release/journey-ui/health-omega3.png');
const out = resolve('output/provider-qa/ingredient-two-identical');
mkdirSync(out, { recursive: true });
const imageBytes = readFileSync(inputPath);
const image = `data:image/png;base64,${imageBytes.toString('base64')}`;

const prompt = `
[AFFIMATIK TWO-IDENTICAL INGREDIENT REFERENCE TEST]
Create one realistic vertical 9:16, 15-second Malaysian UGC product video in a bright ordinary home. A modest adult Malaysian Muslimah presenter naturally holds and discusses the exact Supa Omega-3 box shown in the references. Use natural smartphone 1x framing, realistic skin, hands, gravity, breathing and small gaze changes. Preserve the exact box geometry, navy-and-white colour blocking, Del Venus logo and Supa Omega-3 identity. Do not invent health outcomes, medical claims, testimonials, certifications or personal-use claims.

[REFERENCE ROLE — ABSOLUTE LOCK]
Both uploaded images are intentionally IDENTICAL INGREDIENT/SUBJECT REFERENCES. They reinforce the identity of one physical product only. Neither image is a start frame, opening frame, storyboard frame, background plate, mandatory composition, crop, camera angle or layout template.

[FIRST FRAME MUST BE NEW]
The first generated video frame must be a newly composed live-action scene and must NOT reproduce, trace, extend, animate or closely match the reference image. Start immediately with the presenter already inside a believable room, holding the physical product at chest level from a natural medium-shot camera angle. The background, lighting arrangement, framing, scale, crop, perspective and hand placement must be visibly different from the isolated product reference. Never begin with a static product cutout, black background, white border, isolated packaging shot, zoom-out from the reference, or a still-to-motion transition.

[CONTINUITY]
Keep the presenter and product physically moving from the opening instant: natural blink, breathing, a small wrist adjustment and gentle handheld micro-shake. Maintain exact product identity while changing only the real-world scene around it. Full-frame real-world footage only; zero fake UI, subtitles, shopping icons, overlays or decorative sparkles.

Spoken Malaysian Malay once, naturally: "Produk Omega-3 ni aku tunjuk dekat-dekat supaya korang boleh tengok kotak dan maklumat yang memang tercetak."
Finish the short speech naturally, then continue a small product hold and gaze movement. Do not repeat or add a CTA.
`.trim();

const headers = { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey, 'Content-Type': 'application/json' };

async function credits() {
  const response = await fetch(`${base}/api/v1/credits`, { headers });
  const data = await response.json();
  if (!response.ok || typeof data.credit !== 'number') throw new Error(`Credit check failed HTTP ${response.status}`);
  return data.credit;
}

const evidence = {
  createdAt: new Date().toISOString(),
  inputPath,
  inputBytes: imageBytes.length,
  requestedMode: 'i2v',
  identicalMediaCount: 2,
  promptHasFirstFrameLock: true,
  taskId: null,
  providerReportedMode: null,
  status: null,
  providerCost: null,
  outputPath: null,
  error: null,
};

try {
  const before = await credits();
  evidence.providerCreditBefore = before;
  const submit = await fetch(`${base}/api/v1/api`, {
    method: 'POST',
    headers: { ...headers, 'X-Idempotency-Key': `affimatik-two-identical-${Date.now()}` },
    body: JSON.stringify({
      mode: 'i2v',
      prompt,
      telegram_id: 'web',
      media: [image, image],
      ratio: 2,
      resolution: 720,
      duration: 15,
      use_unlimited: false,
    }),
  });
  const submitted = await submit.json().catch(async () => ({ raw: await submit.text().catch(() => '') }));
  if (!submit.ok) throw new Error(`Submit HTTP ${submit.status}: ${JSON.stringify(submitted)}`);
  const taskId = String(submitted.id || submitted.job_id || submitted.task_id || '');
  if (!taskId) throw new Error(`Provider response missing task id: ${JSON.stringify(submitted)}`);
  evidence.taskId = taskId;

  const deadline = Date.now() + 12 * 60 * 1000;
  let job;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/v1/jobs/${taskId}`, { headers });
    job = await response.json();
    if (!response.ok) throw new Error(`Poll HTTP ${response.status}: ${JSON.stringify(job)}`);
    const record = job.job || job;
    const status = String(record.status || job.status || '').toLowerCase();
    evidence.status = status;
    evidence.providerReportedMode = record.mode || null;
    if (['done', 'completed', 'succeeded'].includes(status)) {
      job = record;
      break;
    }
    if (['failed', 'error'].includes(status)) throw new Error(String(record.error || job.error || 'Provider generation failed'));
    await new Promise((resolveWait) => setTimeout(resolveWait, 10000));
  }
  if (!job || !['done', 'completed', 'succeeded'].includes(String(job.status || '').toLowerCase())) throw new Error('Provider generation timed out');

  const videoUrl = job.storage_url || job.video_url || `${base}/api/v1/jobs/${taskId}/download`;
  const videoResponse = await fetch(videoUrl, { headers });
  if (!videoResponse.ok) throw new Error(`Download HTTP ${videoResponse.status}`);
  const video = Buffer.from(await videoResponse.arrayBuffer());
  const outputPath = resolve(out, `two-identical-${taskId}.mp4`);
  writeFileSync(outputPath, video);
  evidence.outputPath = outputPath;
  evidence.outputBytes = video.length;

  for (const second of [0, 0.5, 1, 7, 14]) {
    const framePath = resolve(out, `two-identical-${taskId}-${String(second).replace('.', '_')}s.jpg`);
    const result = spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(second), '-i', outputPath, '-frames:v', '1', '-vf', 'scale=360:640', framePath], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Frame extraction failed at ${second}s: ${result.stderr}`);
  }

  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type', '-of', 'json', outputPath], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`ffprobe failed: ${probe.stderr}`);
  evidence.media = JSON.parse(probe.stdout);
  evidence.providerCreditAfter = await credits();
  evidence.providerCost = Number((evidence.providerCreditBefore - evidence.providerCreditAfter).toFixed(4));
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  evidence.providerCreditAfter = await credits().catch(() => null);
  if (typeof evidence.providerCreditBefore === 'number' && typeof evidence.providerCreditAfter === 'number') {
    evidence.providerCost = Number((evidence.providerCreditBefore - evidence.providerCreditAfter).toFixed(4));
  }
} finally {
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
}

console.log(JSON.stringify(evidence, null, 2));
if (evidence.error) process.exitCode = 1;
