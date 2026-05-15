import type { LoudnessReading, StereoReading, TonalBalance, MasteringIssue } from '../types/meters'
import { detectTonalIssues } from './tonalBalance'

export function analyzeMastering(
  loudness: LoudnessReading,
  stereo: StereoReading,
  tonal: TonalBalance
): MasteringIssue[] {
  const issues: MasteringIssue[] = []

  // Clipping
  if (loudness.isClipping) {
    issues.push({
      type: 'clipping',
      severity: 'critical',
      headline: 'Digital clipping detected',
      detail: `True peak estimate is above −0.1 dBTP (currently ~${loudness.truePeak.toFixed(1)} dB).`,
      suggestion: 'Reduce master gain or use a true peak limiter. Streaming platforms reject material above −1 dBTP.',
    })
  }

  // Headroom / integrated LUFS
  if (loudness.integrated > -8) {
    issues.push({
      type: 'dynamic',
      severity: 'warning',
      headline: 'Very loud — limited headroom',
      detail: `Integrated loudness is approximately ${loudness.integrated.toFixed(1)} LUFS. Streaming targets are typically −14 LUFS.`,
      suggestion: 'Leave at least 1–3 dB of true peak headroom. Over-compression reduces perceived dynamics.',
    })
  } else if (loudness.integrated < -24 && loudness.integrated > -80) {
    issues.push({
      type: 'dynamic',
      severity: 'info',
      headline: 'Mix is quieter than streaming targets',
      detail: `Integrated loudness is approximately ${loudness.integrated.toFixed(1)} LUFS. Streaming normalizes louder material down but leaves quiet material at its original level.`,
      suggestion: 'Target around −14 LUFS integrated for streaming (Spotify, Apple Music, YouTube).',
    })
  }

  // Crest factor / overcompression
  if (loudness.crestFactor < 4 && loudness.integrated > -20) {
    issues.push({
      type: 'overcompressed',
      severity: 'warning',
      headline: 'Possible over-compression',
      detail: `Crest factor is ${loudness.crestFactor.toFixed(1)} dB — very low peak-to-RMS ratio suggests heavy limiting.`,
      suggestion: 'Ease the limiter ceiling slightly to restore transient punch and listener fatigue.',
    })
  }

  // Phase correlation
  if (stereo.phaseCorrelation < -0.2) {
    issues.push({
      type: 'phase',
      severity: 'critical',
      headline: 'Poor mono compatibility',
      detail: `Phase correlation is ${stereo.phaseCorrelation.toFixed(2)} — channels are significantly out of phase.`,
      suggestion: 'Check stereo widening plugins, double-tracked elements, and reverb returns. This will sound hollow or cancel in mono.',
    })
  } else if (stereo.phaseCorrelation < 0.2) {
    issues.push({
      type: 'phase',
      severity: 'warning',
      headline: 'Marginal mono compatibility',
      detail: `Phase correlation is ${stereo.phaseCorrelation.toFixed(2)}. Some low-end may cancel when summed to mono.`,
      suggestion: 'Check that kick and bass are centered and mono-compatible.',
    })
  }

  // Stereo width
  if (stereo.stereoWidth < 0.05 && stereo.lLevel > -40) {
    issues.push({
      type: 'lowStereo',
      severity: 'info',
      headline: 'Nearly mono signal',
      detail: 'Stereo width is very narrow — left and right channels are nearly identical.',
      suggestion: 'Consider light stereo widening if appropriate for the genre.',
    })
  }

  // Tonal issues
  const tonalIssues = detectTonalIssues(tonal)
  for (const ti of tonalIssues) {
    if (ti.band === 'sub' && ti.direction === 'high') {
      issues.push({
        type: 'sub',
        severity: 'warning',
        headline: 'Excessive sub-bass energy',
        detail: 'Heavy content below 60 Hz can cause pumping on small speakers and fail loudness normalization.',
        suggestion: 'Apply a high-pass filter at 20–30 Hz and consider a sub-bass shelf cut.',
      })
    }
    if (ti.band === 'lowMid' && ti.direction === 'high') {
      issues.push({
        type: 'mud',
        severity: 'warning',
        headline: 'Mud in the low-mids (250–500 Hz)',
        detail: 'Elevated energy in the 250–500 Hz range tends to sound boxy or muddy on consumer speakers.',
        suggestion: 'Try a gentle notch or shelf cut around 300–400 Hz. Check room acoustics if recording live instruments.',
      })
    }
    if (ti.band === 'highMid' && ti.direction === 'high') {
      issues.push({
        type: 'harshness',
        severity: 'warning',
        headline: 'Harshness in the high-mids (2–6 kHz)',
        detail: 'Elevated 2–6 kHz energy can cause ear fatigue on headphones and earbuds after extended listening.',
        suggestion: 'Gentle shelf or bell cut around 3–4 kHz. Check vocals, synth leads, and distorted guitars.',
      })
    }
    if (ti.band === 'bass' && ti.direction === 'high') {
      issues.push({
        type: 'mud',
        severity: 'info',
        headline: 'Heavy bass region (60–250 Hz)',
        detail: 'Strong bass can translate well on large systems but overwhelm laptop speakers.',
        suggestion: 'Check the mix on smaller speakers. A gentle high-pass on non-bass elements can help clarity.',
      })
    }
  }

  return issues
}

export function getOverallGrade(issues: MasteringIssue[]): 'pass' | 'review' | 'fail' {
  if (issues.some(i => i.severity === 'critical')) return 'fail'
  if (issues.some(i => i.severity === 'warning')) return 'review'
  return 'pass'
}
