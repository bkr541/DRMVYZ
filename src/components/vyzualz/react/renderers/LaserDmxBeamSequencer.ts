/**
 * BPM-synchronized Beam Matrix sequencer — pure functions, no side effects.
 *
 * The sequencer maps beat time → which beam is active and how far along its
 * travel path it is.  All functions are deterministic given the same inputs,
 * so seeking / seeking backward produces identical results without re-running
 * any accumulated state.
 *
 * Sequence timing model:
 *   absoluteBeat = mi.rhythm.beatIndex + mi.rhythm.beatPhase   (monotonically increasing)
 *   sequencePos  = absoluteBeat * stepsPerBeat
 *   activeStep   = floor(sequencePos) % numBeams
 *   stepPhase    = sequencePos % 1                              (0–1 within current step)
 *
 * For resetOnDownbeat mode:
 *   beatForSeq   = beatInBar + beatPhase                        (resets each bar)
 */

import type { LaserDmxBeamSequence, LaserDmxSequenceMode } from '../ReactTypes'

// ── Public result type ────────────────────────────────────────────────────────

export interface BeamSequenceState {
  /** 1 = beam is active in this step; 0 = beam is silent. */
  gate:     number
  /** 0–1 travel progress within the current activation window. */
  progress: number
}

// ── Deterministic shuffle ─────────────────────────────────────────────────────

/** LCG-based Fisher-Yates shuffle.  Same seed always produces the same order. */
function deterministicShuffle(arr: string[], seed: number): string[] {
  const result = [...arr]
  let s = ((seed | 0) >>> 0) || 1
  const next = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ── Sequence order ────────────────────────────────────────────────────────────

/**
 * Compute the ordered beam IDs for a given sequence mode.
 *
 * @param sortedBeamIds  Beam IDs already sorted ascending by sequenceIndex.
 * @param mode           The sequence mode.
 * @param seed           Seed used only by 'randomSeeded' mode.
 * @returns Ordered array of beam IDs that defines the step-through order.
 */
export function computeSequenceOrder(
  sortedBeamIds: readonly string[],
  mode:          LaserDmxSequenceMode,
  seed:          number,
): string[] {
  const n = sortedBeamIds.length
  if (n === 0) return []

  switch (mode) {
    case 'all':
    case 'forward':
    case 'alternate': // alternate uses natural order; gate logic handles group alternation
    case 'custom':
      return [...sortedBeamIds]

    case 'reverse':
      return [...sortedBeamIds].reverse()

    case 'centerOut': {
      // Start at the center, then expand outward alternating left/right.
      const center = Math.floor(n / 2)
      const result: string[] = []
      for (let i = 0; result.length < n; i++) {
        const left  = center - i
        const right = center + i + (n % 2 === 0 ? 1 : 0)
        if (left >= 0)    result.push(sortedBeamIds[left])
        if (i > 0 && right < n) result.push(sortedBeamIds[right])
      }
      return result.slice(0, n)
    }

    case 'outsideIn': {
      const result: string[] = []
      let left = 0, right = n - 1
      while (left <= right) {
        result.push(sortedBeamIds[left++])
        if (left <= right) result.push(sortedBeamIds[right--])
      }
      return result
    }

    case 'randomSeeded':
      return deterministicShuffle([...sortedBeamIds], seed)
  }
}

// ── Per-beam gate + progress ──────────────────────────────────────────────────

/**
 * Compute the gate (0/1) and travel progress (0–1) for one beam position
 * within the sequence.
 *
 * @param beamOrderIndex  Position of this beam in the computed sequence order (0-based).
 *                        For rotateEveryBars, the caller has already adjusted this.
 * @param orderedCount    Total number of beams in the sequence.
 * @param beatForSeq      Absolute beat position driving the sequence.
 * @param sequence        The group's sequence settings.
 */
export function computeBeamSequenceState(
  beamOrderIndex: number,
  orderedCount:   number,
  beatForSeq:     number,
  sequence:       LaserDmxBeamSequence,
): BeamSequenceState {
  if (orderedCount === 0) return { gate: 0, progress: 0 }

  const seqPos    = beatForSeq * sequence.stepsPerBeat
  const rawStep   = Math.floor(seqPos)
  const stepPhase = seqPos - rawStep   // 0–1 within current step

  // 'all' — every beam active simultaneously; travel driven by step phase
  if (sequence.mode === 'all') {
    const progress = stepPhase
    return { gate: 1, progress }
  }

  // 'alternate' — step toggles between even-index and odd-index subgroups
  if (sequence.mode === 'alternate') {
    const activeGroup = rawStep % 2
    const beamGroup   = beamOrderIndex % 2
    if (beamGroup === activeGroup) {
      const gate     = stepPhase < sequence.stepGate ? 1 : 0
      const progress = sequence.stepGate > 0
        ? Math.min(1, stepPhase / sequence.stepGate)
        : 1
      return { gate, progress }
    }
    return { gate: 0, progress: 0 }
  }

  // All other modes: one beam active per step, cycling through the ordered list
  const activeStep = rawStep % orderedCount
  if (activeStep === beamOrderIndex) {
    const gate     = stepPhase < sequence.stepGate ? 1 : 0
    const progress = sequence.stepGate > 0
      ? Math.min(1, stepPhase / sequence.stepGate)
      : 1
    return { gate, progress }
  }

  return { gate: 0, progress: 0 }
}
