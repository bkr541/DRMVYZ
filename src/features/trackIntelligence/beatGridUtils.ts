import type { BeatMarkerMI } from '../musicIntelligence/types'

/**
 * Builds a beat grid from a manual BPM override.
 *
 * Uses index-based timestamps (`offset + beatIndex * beatPeriod`) so there is
 * no floating-point accumulation drift across long tracks.
 *
 * The firstBeatOffsetSec preserves the analyzed phase anchor: if the detector
 * found the first beat at 0.18 s, the regenerated grid starts at 0.18 s rather
 * than 0, keeping bar boundaries aligned with the original feel.
 *
 * If firstBeatOffsetSec is larger than one beat period it is reduced modulo
 * beatPeriod (matching the existing buildBeatMarkers convention).
 */
export function buildEffectiveBeatGrid(
  bpm:                number,
  durationSec:        number,
  firstBeatOffsetSec: number = 0,
  beatsPerBar:        number = 4,
): BeatMarkerMI[] {
  if (bpm <= 0 || durationSec <= 0) return []

  const beatPeriodSec = 60 / bpm

  // Normalize offset into [0, beatPeriod) — same behaviour as buildBeatMarkers.
  let offset = firstBeatOffsetSec
  if (offset > beatPeriodSec) offset = offset % beatPeriodSec

  const markers: BeatMarkerMI[] = []
  let beatIndex = 0

  while (true) {
    const timeSec = offset + beatIndex * beatPeriodSec
    // Allow a tiny epsilon so a beat landing exactly on durationSec is included.
    if (timeSec > durationSec + 1e-9) break
    markers.push({
      timeSec,
      confidence:  1.0,
      isDownbeat:  beatIndex % beatsPerBar === 0,
    })
    beatIndex++
  }

  return markers
}
