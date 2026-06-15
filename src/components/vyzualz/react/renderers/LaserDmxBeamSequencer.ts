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
 *   sequencePos  = phasedBeat * stepsPerBeat                   (phasedBeat accounts for phaseSpread)
 *   activeStep   = floor(sequencePos) % numBeams
 *   stepPhase    = sequencePos % 1                             (0–1 within current step)
 *
 * phaseSpread:
 *   The beam at visual order position i has its sequence clock shifted back by
 *   i * phaseSpread beats.  0 = all in sync; 0.25 = 1-beat stagger over 4 beams.
 *
 * beatsPerTravel (compiler concern, not sequencer):
 *   The compiler converts stepPhase → travel progress using
 *   travelProgress = (stepPhase / stepsPerBeat) / beatsPerTravel.
 *   The sequencer just returns stepPhase so the compiler can apply that formula.
 *
 * For resetOnDownbeat mode:
 *   beatForSeq   = beatInBar + beatPhase                        (resets each bar)
 */

import type { LaserDmxBeamSequence, LaserDmxSequenceMode } from '../ReactTypes'

// ── Public result type ────────────────────────────────────────────────────────

export interface BeamSequenceState {
  /** 1 = beam is active in this step's gate window; 0 = beam is silent. */
  gate:     number
  /** Legacy: stepPhase / stepGate, clamped to 1 (kept for backward compat). */
  progress: number
  /** Raw 0–1 position within the current step period (before gate clamping).
   *  Used by the compiler to compute beatsPerTravel-relative travel progress:
   *    travelProgress = (stepPhase / stepsPerBeat) / beatsPerTravel */
  stepPhase: number
  /** Visual order position of this beam in the sequence (0-based).
   *  Used by the compiler to determine direction for 'alternate' mode. */
  beamOrderIndex: number
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
      // Bounded, deterministic center-out expansion.
      // Odd n: emit center beam first, then alternate left/right outward.
      // Even n: emit center-left then center-right pair first, then expand.
      // Loop bound is O(n/2) — never visits an index twice, never infinite.
      const result: string[] = []
      if (n % 2 === 1) {
        const mid = Math.floor(n / 2)
        result.push(sortedBeamIds[mid])
        for (let d = 1; mid - d >= 0; d++) {
          result.push(sortedBeamIds[mid - d])
          if (mid + d < n) result.push(sortedBeamIds[mid + d])
        }
      } else {
        const mid = n / 2          // first right-side index of center pair
        for (let d = 0; mid - 1 - d >= 0; d++) {
          result.push(sortedBeamIds[mid - 1 - d])
          result.push(sortedBeamIds[mid + d])
        }
      }
      return result
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
 * Compute the gate (0/1) and travel progress for one beam position
 * within the sequence.
 *
 * @param visualOrderIndex  Visual order position (0-based) in orderedIds.
 *                          Used for phaseSpread offset and returned as beamOrderIndex.
 * @param stepIndex         Effective step assignment for gate calculation.
 *                          For rotateEveryBars: caller provides (i - rotation + n) % n.
 * @param orderedCount      Total number of beams in the sequence.
 * @param beatForSeq        Absolute beat position driving the sequence.
 * @param sequence          The group's sequence settings.
 */
export function computeBeamSequenceState(
  visualOrderIndex: number,
  stepIndex:        number,
  orderedCount:     number,
  beatForSeq:       number,
  sequence:         LaserDmxBeamSequence,
): BeamSequenceState {
  if (orderedCount === 0) return { gate: 0, progress: 0, stepPhase: 0, beamOrderIndex: 0 }

  // Apply phase spread: shift each beam's local clock back by its position × phaseSpread.
  // phaseSpread is in BEATS: beam i is delayed by i * phaseSpread beats.
  const phasedBeat = beatForSeq - visualOrderIndex * sequence.phaseSpread

  const seqPos    = phasedBeat * sequence.stepsPerBeat
  const rawStep   = Math.floor(seqPos)
  const stepPhase = seqPos - rawStep   // 0–1 within current step (before gate)

  // 'all' — every beam active simultaneously; progress = raw stepPhase (0–1).
  // stepGate gates the "on" window only; travel progress is step phase directly.
  if (sequence.mode === 'all') {
    const gate = stepPhase < sequence.stepGate ? 1 : 0
    return { gate, progress: stepPhase, stepPhase, beamOrderIndex: visualOrderIndex }
  }

  // 'alternate' — step toggles between even-index and odd-index subgroups
  if (sequence.mode === 'alternate') {
    const activeGroup = rawStep % 2
    const beamGroup   = stepIndex % 2
    if (beamGroup === activeGroup) {
      const gate     = stepPhase < sequence.stepGate ? 1 : 0
      const progress = sequence.stepGate > 0
        ? Math.min(1, stepPhase / sequence.stepGate)
        : 1
      return { gate, progress, stepPhase, beamOrderIndex: visualOrderIndex }
    }
    return { gate: 0, progress: 0, stepPhase, beamOrderIndex: visualOrderIndex }
  }

  // All other modes: one beam active per step, cycling through the ordered list
  const activeStep = rawStep % orderedCount
  if (activeStep === stepIndex) {
    const gate     = stepPhase < sequence.stepGate ? 1 : 0
    const progress = sequence.stepGate > 0
      ? Math.min(1, stepPhase / sequence.stepGate)
      : 1
    return { gate, progress, stepPhase, beamOrderIndex: visualOrderIndex }
  }

  return { gate: 0, progress: 0, stepPhase, beamOrderIndex: visualOrderIndex }
}
