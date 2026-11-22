/** Conservative server-side checks. This does not transcribe speech or inspect faces. */
export type MediaQualityState = 'QUALITY_PASS' | 'QUALITY_FAIL' | 'QUALITY_UNCERTAIN';

export interface MediaQualityAssessment {
  state: MediaQualityState;
  checks: string[];
  limitations: string[];
}

export function assessMediaQuality(input: {
  expectedDurationSeconds: number;
  actualDurationSeconds?: number;
  hasAudio?: boolean;
  sizeBytes?: number;
  speechExpected: boolean;
}): MediaQualityAssessment {
  const checks: string[] = [];
  const failures: string[] = [];
  const unknowns: string[] = [];
  if (input.sizeBytes === undefined) unknowns.push('size_not_measured');
  else if (input.sizeBytes < 1024) failures.push('missing_or_empty_mp4');
  else checks.push('mp4_downloaded_and_stored');
  if (input.actualDurationSeconds === undefined || !Number.isFinite(input.actualDurationSeconds)) {
    unknowns.push('duration_not_measured');
  } else if (Math.abs(input.actualDurationSeconds - input.expectedDurationSeconds) > 0.5) {
    failures.push('duration_mismatch');
  } else checks.push('duration_within_tolerance');
  if (input.speechExpected && input.hasAudio === false) failures.push('speech_audio_stream_missing');
  else if (input.speechExpected && input.hasAudio === undefined) unknowns.push('audio_stream_not_measured');
  else if (input.hasAudio) checks.push('audio_stream_present');
  if (failures.length) return { state: 'QUALITY_FAIL', checks: [...checks, ...failures], limitations: [] };
  if (input.speechExpected) return {
    state: 'QUALITY_UNCERTAIN', checks,
    limitations: [...unknowns, 'cta_completeness_not_verified', 'voice_naturalness_not_verified', 'visual_identity_not_verified', 'niqab_integrity_not_verified'],
  };
  return {
    state: 'QUALITY_UNCERTAIN', checks,
    limitations: [...unknowns, 'visual_identity_not_verified', 'niqab_integrity_not_verified', 'audio_content_not_verified'],
  };
}
