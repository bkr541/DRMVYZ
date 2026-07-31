import type {
  PixGridAudioFrame,
  PixGridBuiltInAssetManifestEntry,
  PixGridFrameTransitionCompletedState,
  PixGridFrameTransitionConfig,
  PixGridLayer,
  PixGridLayerAnimation,
  PixGridProgramTransitionOverride,
} from './PixGridTypes'
import { easePixGridTransition } from './PixGridCellTransitions'
import { resolvePixGridMotionMultiplier } from './PixGridRuntimeControls'

export interface PixGridResolvedLayerAnimation {
  positionX: number
  positionY: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
  paletteOffset: number
  revealRow: number
  revealColumn: number
  revealRowFrom: 'start' | 'end' | 'center'
  revealColumnFrom: 'start' | 'end' | 'center'
  checkerAlternate: boolean
  frameIndex: number
  previousFrameIndex: number
  frameTransitionType: PixGridProgramTransitionOverride
  frameTransitionProgress: number
  frameTransitionDuration: number
  frameTransitionSeed: number
  frameTransitionDirection: 'forward' | 'reverse'
  frameTransitionOrigin: Readonly<{ x: number; y: number }>
  frameTransitionOnSectionEntry: boolean
  frameTransitionCompletedState: PixGridFrameTransitionCompletedState
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function triangle(value: number): number {
  const phase = fract(value)
  return 1 - Math.abs(phase * 2 - 1)
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

const SECTION_SEED = {
  intro: 1,
  verse: 2,
  build: 3,
  preDrop: 4,
  drop: 5,
  breakdown: 6,
  bridge: 7,
  outro: 8,
  unknown: 9,
} as const

function deterministicHash(...values: number[]): number {
  let hash = 0x811c9dc5
  for (const value of values) {
    hash ^= Math.round(Number.isFinite(value) ? value : 0) >>> 0
    hash = Math.imul(hash, 0x01000193)
    hash ^= hash >>> 13
  }
  return hash >>> 0
}

export function resolvePixGridBoundedValue(
  base: number,
  offset: number,
  boundary: PixGridLayerAnimation['boundary'],
  min = 0,
  max = 1,
): number {
  const range = Math.max(0.000001, max - min)
  const raw = base + offset
  if (boundary === 'clamp') return Math.max(min, Math.min(max, raw))
  if (boundary === 'bounce') return min + triangle((raw - min) / (range * 2)) * range
  return min + fract((raw - min) / range) * range
}

function audioValue(frame: PixGridAudioFrame, source: PixGridLayerAnimation['audioSource']): number {
  if (source === 'kick') return clamp01(frame.sourceValues?.kick ?? ((frame.kickHit ?? frame.beatHit) ? 1 : 0))
  if (source === 'snare') return frame.snareHit ? 1 : 0
  if (source === 'hat') return frame.hatHit ? 1 : 0
  if (source === 'mid') return clamp01(frame.mid)
  if (source === 'high') return clamp01(frame.high)
  if (source === 'volume') return clamp01(frame.volume)
  return clamp01(frame.bass)
}

function animationClockValue(frame: PixGridAudioFrame, animation: PixGridLayerAnimation): number {
  switch (animation.clock ?? 'time') {
    case 'beat': return frame.motionClockBeat ?? ((frame.beatIndex ?? 0) + clamp01(frame.beatPhase))
    case 'bar': return frame.motionClockBar ?? ((frame.barIndex ?? 0) + ((frame.beatIndex ?? 0) % 4 + clamp01(frame.beatPhase)) / 4)
    case 'sectionBeat': return frame.motionClockSectionBeat ?? frame.beatsSinceSectionStart ?? ((frame.beatIndex ?? 0) + clamp01(frame.beatPhase))
    case 'sectionBar': return frame.motionClockSectionBar ?? frame.barsSinceSectionStart ?? ((frame.barIndex ?? 0) + ((frame.beatIndex ?? 0) % 4 + clamp01(frame.beatPhase)) / 4)
    case 'sectionProgress': return frame.motionClockSectionProgress ?? clamp01(frame.sectionProgress ?? 0)
    case 'sign': return frame.motionClockSign ?? frame.signClock ?? frame.motionClockBar ?? frame.absoluteBar ?? (frame.barIndex ?? 0)
    case 'cue': return 0
    case 'time':
    default: return frame.motionClockTime ?? frame.audioTime
  }
}

function animationSectionType(frame: PixGridAudioFrame) {
  return frame.motionClockSectionType !== undefined ? frame.motionClockSectionType : frame.sectionType
}

function animationSectionSpeed(frame: PixGridAudioFrame, animation: PixGridLayerAnimation): number {
  if (animation.clock === 'sign') return 1
  const sectionType = animationSectionType(frame)
  const speed = sectionType ? animation.sectionSpeeds?.[sectionType] : animation.sectionSpeeds?.unknown
  const baseSpeed = Math.max(0, Number.isFinite(speed) ? speed! : 1)
  const progressAmount = sectionType
    ? animation.sectionProgressSpeed?.[sectionType]
    : animation.sectionProgressSpeed?.unknown
  const progress = clamp01(frame.motionClockSectionProgress ?? frame.sectionProgress ?? 0)
  return baseSpeed * (1 + progress * Math.max(0, Number.isFinite(progressAmount) ? progressAmount! : 0))
}

function animationClockRate(frame: PixGridAudioFrame, animation: PixGridLayerAnimation): number {
  if (animation.clock !== 'sign') return animationSectionSpeed(frame, animation)
  const sectionType = animationSectionType(frame)
  const cadence = sectionType ? animation.sectionSpeeds?.[sectionType] : animation.sectionSpeeds?.unknown
  return Math.max(0, Number.isFinite(cadence) ? cadence! : 0)
}

function effectiveMotion(frame: PixGridAudioFrame, sceneMotionMultiplier: number): number {
  const hasIntegratedClock = frame.motionClockTime != null
    || frame.motionClockBeat != null
    || frame.motionClockBar != null
    || frame.motionClockSign != null
    || frame.motionClockSectionBeat != null
    || frame.motionClockSectionBar != null
    || frame.motionClockSectionProgress != null
  return hasIntegratedClock
    ? Math.max(0, Number.isFinite(sceneMotionMultiplier) ? sceneMotionMultiplier : 1)
    : resolvePixGridMotionMultiplier(frame.motionMultiplier, sceneMotionMultiplier)
}

function animationTime(frame: PixGridAudioFrame, animation: PixGridLayerAnimation, sceneMotionMultiplier: number): number {
  return animationClockValue(frame, animation)
    * animation.speed
    * animationSectionSpeed(frame, animation)
    * effectiveMotion(frame, sceneMotionMultiplier)
    + animation.phase
}

function transitionConfig(frame: PixGridAudioFrame, animation: PixGridLayerAnimation): PixGridFrameTransitionConfig | null {
  const sectionType = animationSectionType(frame)
  return (sectionType ? animation.sectionFrameTransitions?.[sectionType] : animation.sectionFrameTransitions?.unknown)
    ?? animation.frameTransition
    ?? null
}

function transitionSeed(
  layer: PixGridLayer,
  frame: PixGridAudioFrame,
  config: PixGridFrameTransitionConfig,
  previousFrameIndex: number,
  frameIndex: number,
): number {
  if (config.seedMode === 'fixed') return Math.round(config.seed ?? layer.seed) >>> 0
  if (config.seedMode === 'layer') return Math.round(layer.seed) >>> 0
  if (config.seedMode === 'section') {
    const sectionType = animationSectionType(frame) ?? 'unknown'
    return deterministicHash(
      layer.seed,
      SECTION_SEED[sectionType],
      frame.sectionOccurrence ?? 0,
      frame.dropOccurrence ?? 0,
      frame.phraseIndex ?? 0,
    )
  }
  return deterministicHash(layer.seed, previousFrameIndex, frameIndex)
}

function transitionCompletedState(config: PixGridFrameTransitionConfig): PixGridFrameTransitionCompletedState {
  return config.type === 'powerOff' && config.holdAfterCompletion !== false
    ? 'transparent'
    : 'target'
}

function resolveFrameCycle(
  resolved: PixGridResolvedLayerAnimation,
  layer: PixGridLayer,
  asset: PixGridBuiltInAssetManifestEntry,
  frame: PixGridAudioFrame,
  animation: PixGridLayerAnimation,
  time: number,
  motionMultiplier: number,
): void {
  const count = Math.max(1, asset.frameCount ?? 1)
  const frameRate = Math.max(1, Math.abs(animation.amount || 1))
  const framePosition = time * frameRate
  const rawFrame = Math.floor(framePosition)
  const frameIndex = positiveModulo(rawFrame, count)
  const config = transitionConfig(frame, animation)
  resolved.frameIndex = frameIndex
  resolved.previousFrameIndex = positiveModulo(rawFrame - 1, count)
  if (!config || config.type === 'cut' || count <= 1) return

  const duration = clamp01(config.durationFraction)
  const hasExplicitSignTransition = animation.clock === 'sign' && (
    Object.prototype.hasOwnProperty.call(frame, 'motionClockSignTransition')
    || Object.prototype.hasOwnProperty.call(frame, 'signTransitionClock')
  )
  const explicitSignTransition = frame.motionClockSignTransition !== undefined
    ? frame.motionClockSignTransition
    : frame.signTransitionClock
  let rawProgress = duration <= 0 ? 1 : clamp01(fract(framePosition) / duration)
  let entryTransition = false

  if (hasExplicitSignTransition) {
    if (explicitSignTransition == null) {
      if (!config.onSectionEntry) return
      const entryClock = Math.max(0, (
        frame.motionClockSectionBar
        ?? frame.barsSinceSectionStart
        ?? 0
      ) * effectiveMotion(frame, motionMultiplier))
      rawProgress = duration <= 0 ? 1 : clamp01(entryClock / duration)
      resolved.previousFrameIndex = frameIndex
      entryTransition = true
    } else {
      rawProgress = duration <= 0 ? 1 : clamp01(Math.max(0, explicitSignTransition) / duration)
    }
  } else {
    const rate = Math.abs(animation.speed * animationClockRate(frame, animation) * effectiveMotion(frame, motionMultiplier) * frameRate)
    if (rate <= 1e-10) {
      if (!config.onSectionEntry) return
      const entryClock = Math.max(0, (
        frame.motionClockSectionBar
        ?? frame.barsSinceSectionStart
        ?? 0
      ) * effectiveMotion(frame, motionMultiplier))
      rawProgress = duration <= 0 ? 1 : clamp01(entryClock / duration)
      resolved.previousFrameIndex = frameIndex
      entryTransition = true
    }
  }

  resolved.frameTransitionType = config.type
  resolved.frameTransitionProgress = easePixGridTransition(rawProgress, config.easing)
  resolved.frameTransitionDuration = duration
  resolved.frameTransitionSeed = transitionSeed(layer, frame, config, resolved.previousFrameIndex, frameIndex)
  resolved.frameTransitionDirection = config.direction ?? 'forward'
  resolved.frameTransitionOrigin = {
    x: clamp01(config.origin?.x ?? 0.5),
    y: clamp01(config.origin?.y ?? 0.5),
  }
  resolved.frameTransitionOnSectionEntry = entryTransition
  resolved.frameTransitionCompletedState = transitionCompletedState(config)
}

export function resolvePixGridLayerAnimation(
  layer: PixGridLayer,
  asset: PixGridBuiltInAssetManifestEntry,
  frame: PixGridAudioFrame,
  motionMultiplier = 1,
): PixGridResolvedLayerAnimation {
  const resolved: PixGridResolvedLayerAnimation = {
    positionX: layer.position.x,
    positionY: layer.position.y,
    scaleX: layer.scale.x,
    scaleY: layer.scale.y,
    rotation: layer.rotation,
    opacity: 1,
    paletteOffset: 0,
    revealRow: 1,
    revealColumn: 1,
    revealRowFrom: 'start',
    revealColumnFrom: 'start',
    checkerAlternate: false,
    frameIndex: 0,
    previousFrameIndex: 0,
    frameTransitionType: 'cut',
    frameTransitionProgress: 1,
    frameTransitionDuration: 0,
    frameTransitionSeed: Math.round(layer.seed) >>> 0,
    frameTransitionDirection: 'forward',
    frameTransitionOrigin: { x: 0.5, y: 0.5 },
    frameTransitionOnSectionEntry: false,
    frameTransitionCompletedState: 'target',
  }

  for (const animation of layer.animations) {
    const time = animationTime(frame, animation, motionMultiplier)
    const amount = animation.amount
    switch (animation.mode) {
      case 'static':
        break
      case 'pulse': {
        const pulse = 0.5 + 0.5 * Math.sin(time * Math.PI * 2)
        const multiplier = 1 + pulse * amount
        resolved.scaleX *= multiplier
        resolved.scaleY *= multiplier
        break
      }
      case 'bounce': {
        const offset = (triangle(time) * 2 - 1) * amount
        if (animation.axis === 'x') resolved.positionX = resolvePixGridBoundedValue(layer.position.x, offset, animation.boundary)
        else resolved.positionY = resolvePixGridBoundedValue(layer.position.y, offset, animation.boundary)
        break
      }
      case 'horizontalScroll':
        resolved.positionX = resolvePixGridBoundedValue(layer.position.x, time * amount, animation.boundary)
        break
      case 'verticalScroll':
        resolved.positionY = resolvePixGridBoundedValue(layer.position.y, time * amount, animation.boundary)
        break
      case 'pingPong': {
        const offset = (triangle(time) * 2 - 1) * amount
        if (animation.axis === 'y') resolved.positionY = resolvePixGridBoundedValue(layer.position.y, offset, 'clamp')
        else resolved.positionX = resolvePixGridBoundedValue(layer.position.x, offset, 'clamp')
        break
      }
      case 'rotate': {
        const turns = animation.stepped ? Math.floor(time) : time
        resolved.rotation += turns * amount * 360
        break
      }
      case 'paletteCycle':
        resolved.paletteOffset += Math.floor(time * Math.max(1, Math.abs(amount)))
        break
      case 'blink': {
        const on = fract(time) < clamp01(amount || 0.5)
        resolved.opacity *= on ? 1 : 0
        break
      }
      case 'revealRow':
        resolved.revealRowFrom = animation.revealFrom ?? 'start'
        resolved.revealRow = animation.clock === 'cue'
          ? clamp01(time)
          : animation.boundary === 'bounce' ? triangle(time) : clamp01(fract(time) / Math.max(0.01, amount || 1))
        break
      case 'revealColumn':
        resolved.revealColumnFrom = animation.revealFrom ?? 'start'
        resolved.revealColumn = animation.clock === 'cue'
          ? clamp01(time)
          : animation.boundary === 'bounce' ? triangle(time) : clamp01(fract(time) / Math.max(0.01, amount || 1))
        break
      case 'checkerAlternate':
        resolved.checkerAlternate = Math.floor(time) % 2 !== 0
        break
      case 'frameCycle':
        resolveFrameCycle(resolved, layer, asset, frame, animation, time, motionMultiplier)
        break
      case 'audioAmplitudeScale': {
        const multiplier = 1 + audioValue(frame, animation.audioSource) * amount
        resolved.scaleX *= multiplier
        resolved.scaleY *= multiplier
        break
      }
      case 'beatStepMovement': {
        const step = Math.floor(time)
        const offset = step * amount
        if (animation.axis === 'y') resolved.positionY = resolvePixGridBoundedValue(layer.position.y, offset, animation.boundary)
        else resolved.positionX = resolvePixGridBoundedValue(layer.position.x, offset, animation.boundary)
        break
      }
    }
  }

  return resolved
}
