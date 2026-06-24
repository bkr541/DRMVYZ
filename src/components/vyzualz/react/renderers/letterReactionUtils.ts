import type { OscillatorTextLetterReactionMode } from '../ReactTypes'

// ── Per-character audio reaction weights ──────────────────────────────────────

/**
 * Scaling factors applied to each audio-reactive quantity for a single letter.
 * 1 = full effect from the global control; 0 = that band has no effect on this letter.
 * Values can exceed 1 in cases where a mode concentrates energy on fewer letters
 * (currently all modes keep the range [0, 1]).
 */
export interface CharReactionWeights {
  /** Scales the bass-pulse delta: charBassScale = 1 + (bassPulse - 1) * bassScale. */
  bassScale:  number
  /** Scales the mid-twist angle. */
  midScale:   number
  /** Scales the bloom factor from beat envelope. */
  bloomScale: number
}

const FULL: CharReactionWeights  = { bassScale: 1, midScale: 1,   bloomScale: 1   }
const BASS: CharReactionWeights  = { bassScale: 1, midScale: 0.2, bloomScale: 1   }
const MID:  CharReactionWeights  = { bassScale: 0.2, midScale: 1, bloomScale: 0.2 }

/**
 * Returns per-character audio reaction weights for the given letter-reaction mode.
 *
 * @param mode      - value of `textLetterReactionMode` from OscillatorSettings
 * @param ci        - `characterIndex` of the point (0-based position in the string)
 * @param numChars  - total number of distinct characters with geometry (from charCenters.size)
 * @param t         - elapsed time in milliseconds (used by ripple for animation)
 */
export function getCharReactionWeights(
  mode:     OscillatorTextLetterReactionMode,
  ci:       number,
  numChars: number,
  t:        number,
): CharReactionWeights {
  switch (mode) {

    case 'uniform':
      return FULL

    case 'alternating':
      // Even letters (0, 2, 4…) favor Bass + Beat; odd letters favor Mid.
      return ci % 2 === 0 ? BASS : MID

    case 'frequencySplit': {
      // Cycle Bass → Mid → Beat across consecutive letters.
      const band = ci % 3
      if (band === 0) return { bassScale: 1, midScale: 0, bloomScale: 0 }
      if (band === 1) return { bassScale: 0, midScale: 1, bloomScale: 0 }
      return             { bassScale: 0, midScale: 0, bloomScale: 1 }
    }

    case 'ripple': {
      // A sine wave travels from the first letter (left) to the last (right),
      // completing one cycle every ~1.25 s (0.8 Hz).
      const norm  = numChars > 1 ? ci / (numChars - 1) : 0
      const phase = norm * Math.PI * 2 - t * 0.001 * Math.PI * 2 * 0.8
      const amp   = 0.5 + 0.5 * Math.sin(phase)
      return { bassScale: amp, midScale: amp, bloomScale: amp }
    }

    case 'custom':
      // In custom mode all automatic per-letter reactions are zeroed out;
      // the LetterReactionAssignment array drives each letter individually.
      return { bassScale: 0, midScale: 0, bloomScale: 0 }

    default:
      return FULL
  }
}
