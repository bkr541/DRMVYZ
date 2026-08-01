import type { ReactSectionType } from '../ReactTypes'
import type { PixGridAudioFrame, PixGridSectionBarSpan } from './PixGridTypes'

const SIGN_CLOCK_EPSILON = 1e-9

export const PIX_GRID_NEON_MARQUEE_SIGN_CADENCE: Readonly<Record<ReactSectionType, number>> = Object.freeze({
  intro: 0,
  verse: 1 / 8,
  build: 1 / 4,
  preDrop: 0,
  drop: 1 / 4,
  breakdown: 1 / 16,
  bridge: 1 / 8,
  outro: 0,
  unknown: 1 / 8,
})

interface PixGridCadenceSegment {
  startBar: number
  endBar: number
  rate: number
  startClock: number
  endClock: number
}

export interface PixGridSectionCadenceClockState {
  clock: number
  /** Scaled clock distance since the latest real sign boundary, or null before the first boundary. */
  transitionClock: number | null
  /** Raw sign units per bar at the latest real sign boundary. */
  transitionRate: number
  /** Absolute sign epochs on either side of the latest real boundary. */
  sourceFrame: number | null
  targetFrame: number | null
}

function finiteNonNegative(value: number | undefined): number {
  return Math.max(0, Number.isFinite(value) ? value! : 0)
}

function cadenceFor(
  type: ReactSectionType | null | undefined,
  cadence: Readonly<Partial<Record<ReactSectionType, number>>>,
): number {
  const value = cadence[type ?? 'unknown'] ?? cadence.unknown ?? 0
  return finiteNonNegative(value)
}

function normalizedSpans(sectionTimeline: readonly PixGridSectionBarSpan[]): PixGridSectionBarSpan[] {
  return [...sectionTimeline]
    .map(span => ({
      ...span,
      startBar: finiteNonNegative(span.startBar),
      endBar: Math.max(finiteNonNegative(span.startBar), finiteNonNegative(span.endBar)),
    }))
    .sort((left, right) => left.startBar - right.startBar || left.endBar - right.endBar || left.id.localeCompare(right.id))
}

function appendSegment(
  segments: PixGridCadenceSegment[],
  startBar: number,
  endBar: number,
  rate: number,
  startClock: number,
): number {
  if (endBar <= startBar + SIGN_CLOCK_EPSILON) return startClock
  const endClock = startClock + (endBar - startBar) * rate
  segments.push({ startBar, endBar, rate, startClock, endClock })
  return endClock
}

function resolveCadenceSegments(
  absoluteBar: number,
  sectionTimeline: readonly PixGridSectionBarSpan[],
  cadence: Readonly<Partial<Record<ReactSectionType, number>>>,
): { targetBar: number; clock: number; segments: PixGridCadenceSegment[] } {
  const targetBar = finiteNonNegative(absoluteBar)
  const spans = normalizedSpans(sectionTimeline)
  const segments: PixGridCadenceSegment[] = []
  let clock = 0
  let cursor = 0

  for (const span of spans) {
    if (cursor >= targetBar - SIGN_CLOCK_EPSILON) break
    if (span.endBar <= cursor + SIGN_CLOCK_EPSILON) continue

    if (span.startBar > cursor + SIGN_CLOCK_EPSILON) {
      const gapEnd = Math.min(targetBar, span.startBar)
      clock = appendSegment(segments, cursor, gapEnd, cadenceFor('unknown', cadence), clock)
      cursor = gapEnd
      if (cursor >= targetBar - SIGN_CLOCK_EPSILON) break
    }

    const activeStart = Math.max(cursor, span.startBar)
    const activeEnd = Math.min(targetBar, span.endBar)
    clock = appendSegment(segments, activeStart, activeEnd, cadenceFor(span.type, cadence), clock)
    cursor = Math.max(cursor, activeEnd)
  }

  if (cursor < targetBar - SIGN_CLOCK_EPSILON) {
    clock = appendSegment(segments, cursor, targetBar, cadenceFor('unknown', cadence), clock)
  }

  return { targetBar, clock: Math.max(0, clock), segments }
}

/**
 * Integrates section-authored rates on the authoritative absolute bar timeline.
 * A section boundary changes only the future slope. It never resets the clock.
 */
export function resolvePixGridSectionCadenceClockState(
  absoluteBar: number,
  sectionTimeline: readonly PixGridSectionBarSpan[],
  cadence: Readonly<Partial<Record<ReactSectionType, number>>>,
  scale = 1,
): PixGridSectionCadenceClockState {
  const resolved = resolveCadenceSegments(absoluteBar, sectionTimeline, cadence)
  const safeScale = finiteNonNegative(scale)
  const scaledClock = resolved.clock * safeScale
  const targetIndex = Math.floor(scaledClock + SIGN_CLOCK_EPSILON)
  if (safeScale <= SIGN_CLOCK_EPSILON || targetIndex <= 0) {
    return { clock: resolved.clock, transitionClock: null, transitionRate: 0, sourceFrame: null, targetFrame: null }
  }

  const rawThreshold = targetIndex / safeScale
  for (const segment of resolved.segments) {
    if (segment.rate <= SIGN_CLOCK_EPSILON) continue
    const crossedInsideSegment = rawThreshold > segment.startClock + SIGN_CLOCK_EPSILON
      && rawThreshold <= segment.endClock + SIGN_CLOCK_EPSILON
    if (!crossedInsideSegment) continue

    const crossingBar = segment.startBar + (rawThreshold - segment.startClock) / segment.rate
    const transitionRate = segment.rate
    return {
      clock: resolved.clock,
      transitionClock: Math.max(0, resolved.targetBar - crossingBar) * transitionRate * safeScale,
      transitionRate,
      sourceFrame: targetIndex - 1,
      targetFrame: targetIndex,
    }
  }

  return { clock: resolved.clock, transitionClock: null, transitionRate: 0, sourceFrame: null, targetFrame: null }
}

export function resolvePixGridSectionCadenceClock(
  absoluteBar: number,
  sectionTimeline: readonly PixGridSectionBarSpan[],
  cadence: Readonly<Partial<Record<ReactSectionType, number>>>,
): number {
  return resolvePixGridSectionCadenceClockState(absoluteBar, sectionTimeline, cadence).clock
}

function rawAbsoluteBar(frame: PixGridAudioFrame): number {
  if (Number.isFinite(frame.absoluteBar)) return finiteNonNegative(frame.absoluteBar)
  if (Number.isFinite(frame.barIndex)) return finiteNonNegative(frame.barIndex) + finiteNonNegative(frame.barProgress)
  const beatIndex = finiteNonNegative(frame.beatIndex)
  return (beatIndex + Math.max(0, Math.min(1, Number.isFinite(frame.beatPhase) ? frame.beatPhase : 0))) / 4
}

/** Opt-in preset timing adapter. Other frame-based assets retain their clocks. */
export function applyPixGridPresetSignClock(
  frame: PixGridAudioFrame,
  presetId: string,
): PixGridAudioFrame {
  if (presetId !== 'pix-grid-neon-marquee-cycle') return frame
  const previewBar = Number.isFinite(frame.previewElapsedBar)
    ? finiteNonNegative(frame.previewElapsedBar)
    : null
  const previewType = previewBar != null ? frame.sectionType : null
  const absoluteBar = rawAbsoluteBar(frame)
  const sectionTimeline = frame.sectionBarTimeline ?? []
  const terminalOutro = previewBar == null && frame.sectionType === 'outro'
    ? normalizedSpans(sectionTimeline).find(span => (
        span.type === 'outro'
        && absoluteBar >= span.startBar - SIGN_CLOCK_EPSILON
        && absoluteBar <= span.endBar + SIGN_CLOCK_EPSILON
      )) ?? null
    : null
  const state = previewBar != null && previewType
    ? resolvePixGridSectionCadenceClockState(
        previewBar,
        [{
          id: `editor-preview:${previewType}`,
          type: previewType,
          startBar: 0,
          endBar: previewBar + 1,
        }],
        PIX_GRID_NEON_MARQUEE_SIGN_CADENCE,
      )
    : terminalOutro
      ? {
          ...resolvePixGridSectionCadenceClockState(
            Math.max(0, terminalOutro.startBar - 1e-7),
            sectionTimeline,
            PIX_GRID_NEON_MARQUEE_SIGN_CADENCE,
          ),
          transitionClock: null,
          transitionRate: 0,
          sourceFrame: null,
          targetFrame: null,
        }
      : resolvePixGridSectionCadenceClockState(
          absoluteBar,
          sectionTimeline,
          PIX_GRID_NEON_MARQUEE_SIGN_CADENCE,
        )
  return {
    ...frame,
    signClock: state.clock,
    signTransitionClock: state.transitionClock,
    signTransitionRate: state.transitionRate,
    signTransitionSourceFrame: state.sourceFrame,
    signTransitionTargetFrame: state.targetFrame,
  }
}
