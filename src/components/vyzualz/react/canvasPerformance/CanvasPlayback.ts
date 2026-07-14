import { performanceDeterministicUnit } from '../../../../features/performanceCore'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasMediaItem } from '../ReactTypes'
import type { CanvasLayerRole, CanvasResolvedPlayback } from './CanvasPerformanceTypes'

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function modulo(value: number, divisor: number): number {
  if (!Number.isFinite(divisor) || divisor <= 0) return 0
  return ((value % divisor) + divisor) % divisor
}

export function canvasSecondsPerBeat(context: SharedPerformanceContext): number {
  return context.bpm > 0 ? 60 / context.bpm : 0.5
}

export function canvasSecondsPerBar(context: SharedPerformanceContext): number {
  return canvasSecondsPerBeat(context) * Math.max(1, context.timeSignature || 4)
}

export function canvasMusicalDurationToSeconds(
  context: SharedPerformanceContext,
  duration: '1/8beat' | '1/4beat' | '1/2beat' | '1beat' | '2beats' | '1bar' | '2bars',
): number {
  const beat = canvasSecondsPerBeat(context)
  switch (duration) {
    case '1/8beat': return beat / 8
    case '1/4beat': return beat / 4
    case '1/2beat': return beat / 2
    case '2beats': return beat * 2
    case '1bar': return canvasSecondsPerBar(context)
    case '2bars': return canvasSecondsPerBar(context) * 2
    default: return beat
  }
}

export function resolveCanvasQuantizedBlockStart(
  context: SharedPerformanceContext,
  bars: 1 | 2 | 4 | 8 | 16,
): number {
  const secondsPerBeat = canvasSecondsPerBeat(context)
  const beatWithinBar = Math.max(0, context.beatWithinBar) + clamp(context.beatPhase, 0, 1)
  const barStart = Math.max(0, context.audioTimeSec - beatWithinBar * secondsPerBeat)
  const barsIntoBlock = modulo(context.absoluteTrackBarIndex, bars)
  return Math.max(0, barStart - barsIntoBlock * canvasSecondsPerBar(context))
}

export function resolveCanvasSafePlaybackRate(media: CanvasMediaItem, context: SharedPerformanceContext): number {
  const sourceBpm = finite(media.bpm, 0)
  if (sourceBpm <= 0 || context.bpm <= 0) return 1
  const ratio = context.bpm / sourceBpm
  return ratio >= 0.75 && ratio <= 1.333 ? clamp(ratio, 0.75, 1.333) : 1
}

export function resolveCanvasDeterministicInPoint(
  media: CanvasMediaItem,
  context: SharedPerformanceContext,
  loopDurationSec: number,
  identity: string,
): number {
  const duration = Math.max(0, finite(media.durationSec, 0))
  if (media.type !== 'video' || duration <= 0 || loopDurationSec <= 0) return 0
  const safeWindow = Math.max(0, duration - Math.min(duration, loopDurationSec))
  if (safeWindow <= 0.05) return 0
  const unit = performanceDeterministicUnit(
    context.trackIdentity,
    identity,
    context.sectionFamily,
    context.sectionOccurrence,
    context.performanceFourBarBlockIndex,
    media.id,
  )
  const raw = unit * safeWindow
  const frameDuration = media.fps && media.fps > 0 ? 1 / media.fps : 1 / 30
  return Math.floor(raw / frameDuration) * frameDuration
}

function loopBarsForContext(context: SharedPerformanceContext, role: CanvasLayerRole): 1 | 2 | 4 | 8 | 16 | null {
  if (role === 'transition' || role === 'mask') return 1
  if (context.sectionType === 'preDrop') return 1
  if (context.sectionType === 'drop') return role === 'hero' ? 4 : role === 'texture' ? 2 : 1
  if (context.sectionType === 'build') return role === 'hero' ? 4 : 2
  if (context.sectionType === 'intro' || context.sectionType === 'outro') return 8
  if (context.sectionType === 'breakdown' || context.sectionType === 'bridge') return 8
  return 4
}

export function resolveCanvasPlayback(
  media: CanvasMediaItem | null,
  context: SharedPerformanceContext,
  role: CanvasLayerRole,
  identity: string,
): CanvasResolvedPlayback {
  const quantizeBars = loopBarsForContext(context, role)
  const secondsPerBar = canvasSecondsPerBar(context)
  const desiredLoopDuration = quantizeBars ? secondsPerBar * quantizeBars : 0
  const mediaDuration = Math.max(0, finite(media?.durationSec, 0))
  const playbackRate = media ? resolveCanvasSafePlaybackRate(media, context) : 1
  const loopDuration = mediaDuration > 0
    ? Math.min(mediaDuration / playbackRate, desiredLoopDuration || mediaDuration / playbackRate)
    : desiredLoopDuration
  const inPointSec = media ? resolveCanvasDeterministicInPoint(media, context, Math.max(0.001, loopDuration), identity) : 0
  const blockStart = quantizeBars ? resolveCanvasQuantizedBlockStart(context, quantizeBars) : context.audioTimeSec
  const phaseElapsed = Math.max(0, context.audioTimeSec - blockStart)
  const phaseSec = media?.type === 'video' && loopDuration > 0
    ? inPointSec + modulo(phaseElapsed * playbackRate, loopDuration * playbackRate)
    : 0
  const endSec = mediaDuration > 0
    ? Math.min(mediaDuration, inPointSec + Math.max(0.001, loopDuration * playbackRate))
    : 0
  const preDropHold = context.sectionType === 'preDrop' && context.sectionProgress >= 0.72
  const releaseOnDropImpact = context.sectionType === 'drop' && context.dropImpact > 0.1

  return {
    playbackRate,
    inPointSec,
    phaseSec: clamp(phaseSec, 0, Math.max(0, mediaDuration - 0.01)),
    loopRange: {
      startSec: inPointSec,
      endSec,
      bars: quantizeBars,
    },
    quantizeBars,
    startOnDownbeat: true,
    phraseAlignedReset: context.boundaries.performanceSixteenBarBoundary || context.boundaries.macroSectionEntry,
    sectionAligned: context.boundaries.sectionEntry || context.boundaries.macroSectionEntry,
    frameHold: preDropHold && !releaseOnDropImpact,
    releaseOnDropImpact,
  }
}

export function isCanvasPlaybackPhaseDiscontinuous(
  previous: CanvasResolvedPlayback | null | undefined,
  next: CanvasResolvedPlayback,
  toleranceSec = 0.18,
): boolean {
  if (!previous) return true
  if (Math.abs(previous.playbackRate - next.playbackRate) > 0.01) return true
  if (previous.loopRange.bars !== next.loopRange.bars) return true
  if (next.frameHold) return false
  return Math.abs(previous.phaseSec - next.phaseSec) > toleranceSec && next.phaseSec < previous.phaseSec
}
