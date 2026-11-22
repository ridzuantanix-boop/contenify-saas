import type { MediaQualityAssessment } from './media-quality';

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  Prefer: 'resolution=merge-duplicates',
});

/** Quality metadata must never prevent a valid customer video from being delivered. */
export async function recordMediaQuality(jobId: string, assessment: MediaQualityAssessment): Promise<boolean> {
  if (process.env.OUTPUT_QUALITY_GATE_V2_ENABLED !== 'true') return false;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/video_quality_assessments?on_conflict=job_id`, {
    method: 'POST', headers: headers(), signal: AbortSignal.timeout(2500), body: JSON.stringify({
      job_id: jobId, state: assessment.state, checks: assessment.checks,
      limitations: assessment.limitations, detector_version: 'media-integrity-v1',
    }),
  });
  return response.ok;
}
