import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import { stableCanvasFracturesHash } from './CanvasFracturesPlan'
import type {
  CanvasFractureFragment,
  CanvasFracturesResolvedFragmentEffects,
  CanvasFracturesStructuralIdentityFrame,
} from './CanvasFracturesTypes'

export type CanvasFracturesAudioSource = 'shared-context' | 'analyser-fallback' | 'autonomous-fallback'
export type CanvasFracturesAudioResetReason = 'track-replacement' | 'seek' | 'loop' | 'timeline-gap' | null

export interface CanvasFracturesAudioControls {
  audioResponse: number
  bassMotion: number
  transientGlitch: number
  structuralResponse: number
  reducedMotion?: boolean
}

export interface CanvasFracturesAudioRenderState {
  bassMotion: number
  anchorBreathing: number
  kickImpulse: number
  snareImpulse: number
  highShimmer: number
  distortion: number
  buildSeparation: number
  dropImpact: number
  dropDirection: -1 | 1
  vocalProtection: number
  downbeatPulse: number
  flash: number
}

export interface CanvasFracturesAudioFrame {
  source: CanvasFracturesAudioSource
  bass: number
  mid: number
  high: number
  kick: number
  snare: number
  hat: number
  overallEnergy: number
  relativeEnergy: number
  spectralFlux: number
  tension: number
  buildProgress: number
  dropImpact: number
  vocalEnergy: number
  beatPulse: number
  downbeatPulse: number
  sectionProgress: number
  phraseProgress: number
  sectionBoundary: boolean
  phraseBoundary: boolean
  render: CanvasFracturesAudioRenderState
  structure: CanvasFracturesStructuralIdentityFrame | null
  resetReason: CanvasFracturesAudioResetReason
}

export interface CanvasFracturesAudioAdapterInput {
  context: SharedPerformanceContext | null
  analyser?: AnalyserNode | null
  isPlaying: boolean
  isPaused: boolean
  nowSec: number
  positionSec: number
  trackIdentity?: string | null
  controls: CanvasFracturesAudioControls
}

type RawAudioFrame = Omit<CanvasFracturesAudioFrame, 'render' | 'structure' | 'resetReason'>

const ZERO_RENDER_STATE: CanvasFracturesAudioRenderState = {
  bassMotion: 0,
  anchorBreathing: 0,
  kickImpulse: 0,
  snareImpulse: 0,
  highShimmer: 0,
  distortion: 0,
  buildSeparation: 0,
  dropImpact: 0,
  dropDirection: 1,
  vocalProtection: 0,
  downbeatPulse: 0,
  flash: 0,
}

function clamp01(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0
}

function smoothValue(current: number, target: number, deltaSec: number, attackSec: number, releaseSec: number): number {
  const timeConstant = target > current ? attackSec : releaseSec
  const alpha = 1 - Math.exp(-Math.max(0, deltaSec) / Math.max(1e-4, timeConstant))
  return clamp01(current + (target - current) * alpha)
}

function decayEnvelope(current: number, deltaSec: number, releaseSec: number): number {
  return clamp01(current * Math.exp(-Math.max(0, deltaSec) / Math.max(1e-4, releaseSec)))
}

function averageByteRange(data: Uint8Array, startRatio: number, endRatio: number): number {
  const start = Math.max(0, Math.min(data.length - 1, Math.floor(data.length * startRatio)))
  const end = Math.max(start + 1, Math.min(data.length, Math.ceil(data.length * endRatio)))
  let sum = 0
  for (let index = start; index < end; index += 1) sum += data[index]
  return clamp01(sum / Math.max(1, end - start) / 255)
}

function resolveStructuralIdentity(
  context: SharedPerformanceContext | null,
  source: CanvasFracturesAudioSource,
  structuralScale: number,
): CanvasFracturesStructuralIdentityFrame | null {
  if (!context || source !== 'shared-context' || structuralScale <= 1e-5) return null

  const resolvedSection = context.resolvedSection
  const section = resolvedSection && resolvedSection.confidence > 0.1 ? resolvedSection : null
  const sectionIndex = section ? context.sections.findIndex(candidate => candidate.id === section.id) : -1
  const previousSection = sectionIndex > 0 ? context.sections[sectionIndex - 1] : null
  const secondsPerBeat = context.bpm > 0 ? 60 / context.bpm : 0
  const secondsPerBar = secondsPerBeat * Math.max(1, context.timeSignature)
  const currentBarStartSec = secondsPerBeat > 0
    ? context.audioTimeSec - (context.beatWithinBar + context.beatPhase) * secondsPerBeat
    : context.audioTimeSec
  const gridOriginSec = secondsPerBar > 0
    ? currentBarStartSec - Math.floor(context.absoluteBar + 1e-6) * secondsPerBar
    : 0
  const sectionCommitSec = section && context.capabilities.beatGrid && context.confidence.grid > 0.1 && secondsPerBar > 0
    ? gridOriginSec + Math.ceil(Math.max(0, section.startSec - gridOriginSec - 1e-6) / secondsPerBar) * secondsPerBar
    : section?.startSec ?? 0
  const currentTopologyIdentity = section ? `audio-section:${section.id}` : null
  const previousTopologyIdentity = previousSection
    ? `audio-section:${previousSection.id}`
    : currentTopologyIdentity
  const topologyIdentity = previousTopologyIdentity
    && currentTopologyIdentity
    && context.audioTimeSec + 1e-6 < sectionCommitSec
    ? previousTopologyIdentity
    : currentTopologyIdentity

  const hasPhraseGrid = context.capabilities.beatGrid && context.confidence.grid > 0.1 && context.bpm > 0
  const phraseDurationSec = hasPhraseGrid
    ? context.phraseLengthBars * context.timeSignature * 60 / context.bpm
    : 0
  const phraseBoundarySec = phraseDurationSec > 0
    ? Math.max(0, context.audioTimeSec - context.phraseProgress * phraseDurationSec)
    : 0
  const layoutIdentity = hasPhraseGrid ? `audio-phrase:${context.phraseIndex}` : null
  const previousLayoutIdentity = hasPhraseGrid
    ? `audio-phrase:${Math.max(0, context.phraseIndex - 1)}`
    : null

  if (!topologyIdentity && !layoutIdentity) return null
  return {
    topologyIdentity,
    previousTopologyIdentity: topologyIdentity === previousTopologyIdentity
      ? topologyIdentity
      : previousTopologyIdentity,
    topologyBoundarySec: sectionCommitSec,
    layoutIdentity,
    previousLayoutIdentity,
    layoutBoundarySec: phraseBoundarySec,
  }
}

function resolveContextFrame(context: SharedPerformanceContext): RawAudioFrame {
  const rhythm = context.intelligence.rhythm
  return {
    source: 'shared-context',
    bass: clamp01(context.bass),
    mid: clamp01(context.mid),
    high: clamp01(context.high),
    kick: context.kick ? clamp01(context.kickStrength) : 0,
    snare: context.snare ? clamp01(context.snareStrength) : 0,
    hat: context.hat ? clamp01(context.hatStrength) : 0,
    overallEnergy: clamp01(context.energy),
    relativeEnergy: clamp01(context.trackRelativeEnergy),
    spectralFlux: clamp01(context.spectralFlux),
    tension: clamp01(context.tension),
    buildProgress: clamp01(context.buildProgress),
    dropImpact: clamp01(context.dropImpact),
    vocalEnergy: clamp01(context.vocalEnergy),
    beatPulse: clamp01(Math.max(context.kickStrength, context.transient * 0.72)),
    downbeatPulse: context.downbeat && context.boundaries.beatBoundary ? 1 : 0,
    sectionProgress: clamp01(context.sectionProgress),
    phraseProgress: clamp01(context.phraseProgress),
    sectionBoundary: context.boundaries.sectionEntry,
    phraseBoundary: context.boundaries.performanceFourBarBoundary
      || rhythm.phrase4Hit
      || rhythm.phrase8Hit
      || rhythm.phrase16Hit
      || rhythm.phrase32Hit,
  }
}

/**
 * Particle Aura parity fallback. These analyser ranges, idle oscillators, and
 * fallback semantic values intentionally mirror CanvasParticleAuraLayer.
 */
export function resolveCanvasFracturesParticleAuraFallbackFrame(input: {
  nowSec: number
  analyser?: AnalyserNode | null
  frequencyData?: Uint8Array<ArrayBuffer> | null
  isPlaying: boolean
  isPaused: boolean
  previousBass: number
  heldBeat: number
}): { frame: RawAudioFrame; previousBass: number; heldBeat: number } {
  const now = Math.max(0, Number.isFinite(input.nowSec) ? input.nowSec : 0)
  let bass = 0.16 + Math.sin(now * 1.4) * 0.035
  let mid = 0.13 + Math.sin(now * 1.9) * 0.025
  let high = 0.12 + Math.sin(now * 2.7) * 0.025
  let beat = Math.max(0, Math.sin(now * 2.2)) * 0.22
  let previousBass = input.previousBass
  let heldBeat = input.heldBeat
  let source: CanvasFracturesAudioSource = 'autonomous-fallback'

  if (input.analyser && input.frequencyData && input.isPlaying && !input.isPaused) {
    input.analyser.getByteFrequencyData(input.frequencyData)
    bass = averageByteRange(input.frequencyData, 0, 0.09)
    mid = averageByteRange(input.frequencyData, 0.16, 0.52)
    high = averageByteRange(input.frequencyData, 0.62, 1)
    const bassDelta = bass - previousBass
    heldBeat = Math.max(0, heldBeat * 0.76, bass > 0.5 && bassDelta > 0.035 ? 1 : 0)
    beat = heldBeat
    previousBass = previousBass * 0.58 + bass * 0.42
    source = 'analyser-fallback'
  } else {
    previousBass = bass
  }

  return {
    frame: {
      source,
      bass: clamp01(bass),
      mid: clamp01(mid),
      high: clamp01(high),
      kick: clamp01(beat),
      snare: clamp01(Math.max(0, Math.sin(now * 1.1 + 1.7)) * high * 0.2),
      hat: clamp01(high * 0.35),
      downbeatPulse: beat > 0.9 ? 1 : 0,
      beatPulse: clamp01(beat),
      overallEnergy: clamp01(bass * 0.5 + mid * 0.28 + high * 0.22),
      relativeEnergy: clamp01(bass * 0.5 + mid * 0.28 + high * 0.22),
      spectralFlux: clamp01(high * 0.5),
      tension: clamp01(mid * 0.35),
      buildProgress: 0,
      dropImpact: clamp01(beat * bass),
      phraseProgress: (now / 8) % 1,
      sectionProgress: (now / 24) % 1,
      vocalEnergy: clamp01(mid * 0.22),
      sectionBoundary: false,
      phraseBoundary: false,
    },
    previousBass,
    heldBeat,
  }
}

export class CanvasFracturesAudioAdapter {
  private frequencyData: Uint8Array<ArrayBuffer> | null = null
  private frequencyAnalyser: AnalyserNode | null = null
  private lastNowSec: number | null = null
  private lastPositionSec: number | null = null
  private lastTrackIdentity: string | null = null
  private previousFallbackBass = 0
  private heldFallbackBeat = 0
  private smoothedBass = 0
  private smoothedHigh = 0
  private smoothedFlux = 0
  private smoothedBuild = 0
  private smoothedVocal = 0
  private kickEnvelope = 0
  private snareEnvelope = 0
  private hatEnvelope = 0
  private downbeatEnvelope = 0
  private dropEnvelope = 0
  private lastKickIdentity: string | null = null
  private lastSnareIdentity: string | null = null
  private lastHatIdentity: string | null = null
  private lastDropIdentity: string | null = null
  private fallbackKickActive = false
  private fallbackSnareActive = false
  private fallbackHatActive = false
  private dropActive = false

  reset(): void {
    this.lastNowSec = null
    this.lastPositionSec = null
    this.lastTrackIdentity = null
    this.previousFallbackBass = 0
    this.heldFallbackBeat = 0
    this.smoothedBass = 0
    this.smoothedHigh = 0
    this.smoothedFlux = 0
    this.smoothedBuild = 0
    this.smoothedVocal = 0
    this.resetTransients()
  }

  update(input: CanvasFracturesAudioAdapterInput): CanvasFracturesAudioFrame {
    const nowSec = Math.max(0, Number.isFinite(input.nowSec) ? input.nowSec : 0)
    const positionSec = Math.max(0, Number.isFinite(input.positionSec) ? input.positionSec : 0)
    const trackIdentity = input.trackIdentity ?? input.context?.trackIdentity ?? null
    const deltaSec = this.lastNowSec === null ? 1 / 60 : Math.max(0, Math.min(0.25, nowSec - this.lastNowSec))
    let resetReason: CanvasFracturesAudioResetReason = null

    if (this.lastNowSec !== null && trackIdentity !== this.lastTrackIdentity) resetReason = 'track-replacement'
    else if (input.context?.trackReplacementDetected) resetReason = 'track-replacement'
    else if (input.context?.seekDetected) resetReason = 'seek'
    else if (input.context?.loopWrapDetected) resetReason = 'loop'
    else if (this.lastPositionSec !== null) {
      const positionDelta = positionSec - this.lastPositionSec
      if (positionDelta < -0.05 || positionDelta > 1) resetReason = 'timeline-gap'
    }

    const contextActive = Boolean(input.context && input.isPlaying && !input.isPaused)
    let raw: RawAudioFrame
    if (contextActive && input.context) {
      raw = resolveContextFrame(input.context)
    } else {
      if (input.analyser !== this.frequencyAnalyser) {
        this.frequencyAnalyser = input.analyser ?? null
        this.frequencyData = input.analyser
          ? new Uint8Array(Math.max(1, input.analyser.frequencyBinCount))
          : null
      }
      const fallback = resolveCanvasFracturesParticleAuraFallbackFrame({
        nowSec,
        analyser: input.analyser,
        frequencyData: this.frequencyData,
        isPlaying: input.isPlaying,
        isPaused: input.isPaused,
        previousBass: this.previousFallbackBass,
        heldBeat: this.heldFallbackBeat,
      })
      raw = fallback.frame
      this.previousFallbackBass = fallback.previousBass
      this.heldFallbackBeat = fallback.heldBeat
    }

    if (this.lastNowSec === null) {
      this.smoothedBass = raw.bass
      this.smoothedHigh = raw.high
      this.smoothedFlux = raw.spectralFlux
      this.smoothedBuild = raw.buildProgress
      this.smoothedVocal = raw.vocalEnergy
      this.updateTransientEnvelopes(input.context, raw, 0)
    } else if (resetReason) {
      this.resetTransients()
      this.smoothedBass = raw.bass
      this.smoothedHigh = raw.high
      this.smoothedFlux = raw.spectralFlux
      this.smoothedBuild = raw.buildProgress
      this.smoothedVocal = raw.vocalEnergy
      this.consumeCurrentEvents(input.context, raw)
    } else {
      this.smoothedBass = smoothValue(this.smoothedBass, raw.bass, deltaSec, 0.07, 0.24)
      this.smoothedHigh = smoothValue(this.smoothedHigh, raw.high, deltaSec, 0.045, 0.16)
      this.smoothedFlux = smoothValue(this.smoothedFlux, raw.spectralFlux, deltaSec, 0.035, 0.14)
      this.smoothedBuild = smoothValue(this.smoothedBuild, raw.buildProgress, deltaSec, 0.12, 0.28)
      this.smoothedVocal = smoothValue(this.smoothedVocal, raw.vocalEnergy, deltaSec, 0.08, 0.22)
      this.updateTransientEnvelopes(input.context, raw, deltaSec)
    }

    const master = clamp01(input.controls.audioResponse)
    const bassScale = master * clamp01(input.controls.bassMotion)
    const glitchScale = master * clamp01(input.controls.transientGlitch)
    const structuralScale = master * clamp01(input.controls.structuralResponse)
    const dropKey = input.context
      ? `${input.context.trackIdentity ?? 'none'}:${input.context.sectionId ?? 'none'}:${input.context.dropOccurrence}`
      : `fallback:${Math.floor(nowSec / 8)}`
    const dropDirection: -1 | 1 = (stableCanvasFracturesHash(dropKey) & 1) === 0 ? 1 : -1
    const reducedMotionScale = input.controls.reducedMotion ? 0.3 : 1
    const motionTimeSec = raw.source === 'shared-context' ? positionSec : nowSec

    const render: CanvasFracturesAudioRenderState = master <= 1e-5
      ? { ...ZERO_RENDER_STATE, dropDirection }
      : {
          bassMotion: clamp01(this.smoothedBass * bassScale * reducedMotionScale),
          anchorBreathing: clamp01(this.smoothedBass * bassScale * reducedMotionScale * (0.72 + Math.sin(motionTimeSec * 0.78) * 0.18)),
          kickImpulse: clamp01(this.kickEnvelope * glitchScale * reducedMotionScale),
          snareImpulse: clamp01(this.snareEnvelope * glitchScale * reducedMotionScale),
          highShimmer: clamp01((this.smoothedHigh * 0.7 + this.hatEnvelope * 0.5) * glitchScale * reducedMotionScale),
          distortion: clamp01(Math.max(this.smoothedFlux, raw.tension * 0.55) * glitchScale * reducedMotionScale),
          buildSeparation: clamp01(this.smoothedBuild * structuralScale * reducedMotionScale),
          dropImpact: clamp01(this.dropEnvelope * structuralScale * reducedMotionScale),
          dropDirection,
          vocalProtection: clamp01(this.smoothedVocal * structuralScale),
          downbeatPulse: clamp01(this.downbeatEnvelope * structuralScale * reducedMotionScale),
          flash: input.controls.reducedMotion
            ? 0
            : Math.min(0.65, clamp01(
                this.kickEnvelope * 0.42 * glitchScale
                + this.snareEnvelope * 0.5 * glitchScale
                + this.dropEnvelope * 0.72 * structuralScale
                + this.downbeatEnvelope * 0.22 * structuralScale,
              )),
        }

    const structure = resolveStructuralIdentity(
      input.context,
      raw.source,
      input.controls.reducedMotion ? 0 : structuralScale,
    )
    this.lastNowSec = nowSec
    this.lastPositionSec = positionSec
    this.lastTrackIdentity = trackIdentity

    return {
      ...raw,
      bass: this.smoothedBass,
      high: this.smoothedHigh,
      spectralFlux: this.smoothedFlux,
      buildProgress: this.smoothedBuild,
      vocalEnergy: this.smoothedVocal,
      render,
      structure,
      resetReason,
    }
  }

  private resetTransients(): void {
    this.kickEnvelope = 0
    this.snareEnvelope = 0
    this.hatEnvelope = 0
    this.downbeatEnvelope = 0
    this.dropEnvelope = 0
    this.lastKickIdentity = null
    this.lastSnareIdentity = null
    this.lastHatIdentity = null
    this.lastDropIdentity = null
    this.fallbackKickActive = false
    this.fallbackSnareActive = false
    this.fallbackHatActive = false
    this.dropActive = false
  }

  private consumeCurrentEvents(context: SharedPerformanceContext | null, raw: RawAudioFrame): void {
    if (context) {
      const prefix = `${context.trackIdentity ?? 'none'}:${context.beatIndex}`
      if (context.kick) this.lastKickIdentity = `${prefix}:kick`
      if (context.snare) this.lastSnareIdentity = `${prefix}:snare`
      if (context.hat) this.lastHatIdentity = `${prefix}:hat`
      if (raw.dropImpact > 0.16) this.lastDropIdentity = this.resolveDropIdentity(context)
    } else {
      this.fallbackKickActive = raw.kick > 0.08
      this.fallbackSnareActive = raw.snare > 0.05
      this.fallbackHatActive = raw.hat > 0.08
    }
    this.dropActive = raw.dropImpact > 0.16
  }

  private updateTransientEnvelopes(context: SharedPerformanceContext | null, raw: RawAudioFrame, deltaSec: number): void {
    this.kickEnvelope = decayEnvelope(this.kickEnvelope, deltaSec, 0.18)
    this.snareEnvelope = decayEnvelope(this.snareEnvelope, deltaSec, 0.22)
    this.hatEnvelope = decayEnvelope(this.hatEnvelope, deltaSec, 0.11)
    this.downbeatEnvelope = decayEnvelope(this.downbeatEnvelope, deltaSec, 0.28)
    this.dropEnvelope = decayEnvelope(this.dropEnvelope, deltaSec, 0.72)

    if (context) {
      const prefix = `${context.trackIdentity ?? 'none'}:${context.beatIndex}`
      const kickIdentity = `${prefix}:kick`
      const snareIdentity = `${prefix}:snare`
      const hatIdentity = `${prefix}:hat`
      if (context.kick && kickIdentity !== this.lastKickIdentity) {
        this.kickEnvelope = Math.max(this.kickEnvelope, raw.kick)
        this.lastKickIdentity = kickIdentity
      }
      if (context.snare && snareIdentity !== this.lastSnareIdentity) {
        this.snareEnvelope = Math.max(this.snareEnvelope, raw.snare)
        this.lastSnareIdentity = snareIdentity
      }
      if (context.hat && hatIdentity !== this.lastHatIdentity) {
        this.hatEnvelope = Math.max(this.hatEnvelope, raw.hat)
        this.lastHatIdentity = hatIdentity
      }
      if (raw.downbeatPulse > 0) this.downbeatEnvelope = Math.max(this.downbeatEnvelope, raw.downbeatPulse)
    } else {
      const kickActive = raw.kick > 0.08
      const snareActive = raw.snare > 0.05
      const hatActive = raw.hat > 0.08
      if (kickActive && !this.fallbackKickActive) this.kickEnvelope = Math.max(this.kickEnvelope, raw.kick)
      if (snareActive && !this.fallbackSnareActive) this.snareEnvelope = Math.max(this.snareEnvelope, raw.snare)
      if (hatActive && !this.fallbackHatActive) this.hatEnvelope = Math.max(this.hatEnvelope, raw.hat)
      this.fallbackKickActive = kickActive
      this.fallbackSnareActive = snareActive
      this.fallbackHatActive = hatActive
      if (raw.downbeatPulse > 0) this.downbeatEnvelope = Math.max(this.downbeatEnvelope, raw.downbeatPulse)
    }

    const dropActive = raw.dropImpact > 0.16
    if (context) {
      const dropIdentity = this.resolveDropIdentity(context)
      if (dropActive && dropIdentity !== this.lastDropIdentity) {
        this.dropEnvelope = Math.max(this.dropEnvelope, raw.dropImpact)
        this.lastDropIdentity = dropIdentity
      }
    } else if (dropActive && !this.dropActive) {
      this.dropEnvelope = Math.max(this.dropEnvelope, raw.dropImpact)
    }
    this.dropActive = dropActive
  }

  private resolveDropIdentity(context: SharedPerformanceContext): string {
    return `${context.trackIdentity ?? 'none'}:${context.sectionId ?? 'none'}:${context.dropOccurrence}`
  }
}

export function modulateCanvasFracturesFragmentTransform(input: {
  fragment: CanvasFractureFragment
  centerX: number
  centerY: number
  scale: number
  fitWidth: number
  fitHeight: number
  framePositionSec?: number | null
  audio?: CanvasFracturesAudioRenderState | null
}): { centerX: number; centerY: number; scale: number } {
  const audio = input.audio
  if (!audio) return { centerX: input.centerX, centerY: input.centerY, scale: input.scale }

  const focusProtection = input.fragment.anchorRole === 'focus' ? audio.vocalProtection : 0
  const destructiveScale = 1 - focusProtection * 0.78
  const radialX = input.fragment.currentTransform.centerX - 0.5
  const radialY = input.fragment.currentTransform.centerY - 0.5
  const dropSpread = audio.dropImpact * audio.dropDirection * 0.2
  const spread = (audio.bassMotion * 0.055 + audio.buildSeparation * 0.14 + dropSpread) * destructiveScale
  const minDimension = Math.max(1, Math.min(input.fitWidth, input.fitHeight))
  const kickDistance = minDimension * 0.024 * audio.kickImpulse * destructiveScale
  const glitchEligible = input.fragment.effectRole === 'glitch'
    || input.fragment.effectRole === 'displacement'
    || input.fragment.effectRole === 'texture'
  const snareDistance = glitchEligible ? minDimension * 0.035 * audio.snareImpulse : 0
  const time = Number.isFinite(input.framePositionSec) ? Number(input.framePositionSec) : 0
  const jitterPhase = time * 37 + input.fragment.effectAssignment.phase * Math.PI * 2
  const jitterDistance = minDimension * 0.0024 * audio.highShimmer * destructiveScale
  const sliceHorizontal = Math.abs(input.fragment.effectAssignment.directionX) >= Math.abs(input.fragment.effectAssignment.directionY)
  const sliceSign = (input.fragment.effectAssignment.seed & 1) === 0 ? 1 : -1

  const centerX = input.centerX
    + radialX * input.fitWidth * spread
    + input.fragment.effectAssignment.directionX * kickDistance
    + (sliceHorizontal ? sliceSign * snareDistance : 0)
    + Math.sin(jitterPhase) * jitterDistance
  const centerY = input.centerY
    + radialY * input.fitHeight * spread
    + input.fragment.effectAssignment.directionY * kickDistance
    + (!sliceHorizontal ? sliceSign * snareDistance : 0)
    + Math.cos(jitterPhase * 1.13) * jitterDistance
  const scaleModulation = 1
    + audio.bassMotion * 0.045
    + audio.kickImpulse * 0.055
    + audio.buildSeparation * 0.035
    + audio.dropImpact * audio.dropDirection * 0.085
  const scale = Math.max(0.72, Math.min(1.22, input.scale * scaleModulation))

  return { centerX, centerY, scale }
}

export function protectCanvasFracturesFragmentEffects(input: {
  fragment: CanvasFractureFragment
  effects: CanvasFracturesResolvedFragmentEffects
  audio?: CanvasFracturesAudioRenderState | null
}): CanvasFracturesResolvedFragmentEffects {
  const protection = input.fragment.anchorRole === 'focus'
    ? clamp01(input.audio?.vocalProtection ?? 0)
    : 0
  if (protection <= 1e-5) return input.effects
  const destructive = 1 - protection * 0.82
  return {
    ...input.effects,
    posterization: input.effects.posterization * destructive,
    hueShift: input.effects.hueShift * (1 - protection * 0.55),
    duotone: input.effects.duotone * (1 - protection * 0.6),
    duplicateCount: protection > 0.55 ? 0 : input.effects.duplicateCount,
    flash: input.effects.flash * destructive,
    blur: input.effects.blur * destructive,
    sharpen: input.effects.sharpen * (1 - protection * 0.35),
    dissolve: input.effects.dissolve * destructive,
  }
}
