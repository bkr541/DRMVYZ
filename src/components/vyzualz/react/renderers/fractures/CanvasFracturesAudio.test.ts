import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import {
  CanvasFracturesAudioAdapter,
  modulateCanvasFracturesFragmentTransform,
  protectCanvasFracturesFragmentEffects,
  resolveCanvasFracturesParticleAuraFallbackFrame,
} from './CanvasFracturesAudio'
import type { CanvasFracturesResolvedFragmentEffects } from './CanvasFracturesTypes'

function frame(patch: {
  timeSec?: number
  trackId?: string
  bass?: number
  mid?: number
  high?: number
  kick?: number
  snare?: number
  hat?: number
  energy?: number
  relativeEnergy?: number
  flux?: number
  tension?: number
  build?: number
  drop?: number
  vocal?: number
  beatIndex?: number
  beatInBar?: number
  beatHit?: boolean
  beatPhase?: number
} = {}): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    timeSec: patch.timeSec ?? 4,
    frameId: Math.round((patch.timeSec ?? 4) * 60),
    sourceId: patch.trackId ?? 'track-a',
    trackId: patch.trackId ?? 'track-a',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass: patch.bass ?? 0.8,
      mid: patch.mid ?? 0.45,
      high: patch.high ?? 0.62,
      normalizedBass: patch.bass ?? 0.8,
      normalizedMid: patch.mid ?? 0.45,
      normalizedHigh: patch.high ?? 0.62,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.95,
      beatIndex: patch.beatIndex ?? 8,
      beatInBar: patch.beatInBar ?? 0,
      beatHit: patch.beatHit ?? true,
      beatPhase: patch.beatPhase ?? 0,
      downbeatHit: (patch.beatInBar ?? 0) === 0 && (patch.beatHit ?? true),
      kickHit: (patch.kick ?? 0.9) > 0,
      kickStrength: patch.kick ?? 0.9,
      snareHit: (patch.snare ?? 0.75) > 0,
      snareStrength: patch.snare ?? 0.75,
      hatHit: (patch.hat ?? 0.55) > 0,
      hatStrength: patch.hat ?? 0.55,
      transient: Math.max(patch.kick ?? 0.9, patch.snare ?? 0.75, patch.hat ?? 0.55),
      transientConfidence: 0.9,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: patch.energy ?? 0.7,
      percentile: patch.relativeEnergy ?? 0.82,
      spectralFlux: patch.flux ?? 0.66,
      tension: patch.tension ?? 0.58,
      buildProgress: patch.build ?? 0.72,
      dropImpact: patch.drop ?? 0.8,
    },
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      vocals: patch.vocal ?? 0.64,
      vocalEnergy: patch.vocal ?? 0.64,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: 'drop',
      label: 'Drop',
      startSec: 4,
      endSec: 12,
      progress: Math.max(0, Math.min(1, ((patch.timeSec ?? 4) - 4) / 8)),
      confidence: 0.95,
      source: 'analysis',
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
      lyrics: false,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.94,
      rhythm: 0.95,
      section: 0.92,
    },
  }
}

const sections = [
  { id: 'intro', label: 'Intro', type: 'intro' as const, startSec: 0, endSec: 4, intensity: 0.35, confidence: 0.9, source: 'auto' as const },
  { id: 'drop', label: 'Drop', type: 'drop' as const, startSec: 4, endSec: 12, intensity: 0.95, confidence: 0.95, source: 'auto' as const },
]

function context(
  sourceFrame: MusicIntelligenceFrame,
  options: {
    previous?: SharedPerformanceContext | null
    seekIdentity?: string
    loopIdentity?: string
    trackChangeIdentity?: string
  } = {},
): SharedPerformanceContext {
  return buildSharedPerformanceContext({
    audioTimeSec: sourceFrame.timeSec,
    frame: sourceFrame,
    resolvedSections: sections,
    trackIdentity: sourceFrame.trackId,
    previous: options.previous ?? null,
    seekIdentity: options.seekIdentity,
    loopIdentity: options.loopIdentity,
    trackChangeIdentity: options.trackChangeIdentity ?? `track:${sourceFrame.trackId}`,
  })
}

const fullControls = {
  audioResponse: 1,
  bassMotion: 1,
  transientGlitch: 1,
  structuralResponse: 1,
  reducedMotion: false,
}

function update(adapter: CanvasFracturesAudioAdapter, performanceContext: SharedPerformanceContext | null, patch: Partial<Parameters<CanvasFracturesAudioAdapter['update']>[0]> = {}) {
  return adapter.update({
    context: performanceContext,
    analyser: null,
    isPlaying: true,
    isPaused: false,
    nowSec: performanceContext?.audioTimeSec ?? 2,
    positionSec: performanceContext?.audioTimeSec ?? 2,
    trackIdentity: performanceContext?.trackIdentity ?? null,
    controls: fullControls,
    ...patch,
  })
}

describe('Canvas Fractures audio adapter', () => {
  it('maps the actual SharedPerformanceContext vocabulary into a compact Fractures frame', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const result = update(adapter, context(frame()))

    expect(result.source).toBe('shared-context')
    expect(result.bass).toBeGreaterThan(0)
    expect(result.mid).toBeCloseTo(0.45)
    expect(result.high).toBeGreaterThan(0)
    expect(result.overallEnergy).toBeCloseTo(0.7)
    expect(result.relativeEnergy).toBeCloseTo(0.82)
    expect(result.spectralFlux).toBeGreaterThan(0)
    expect(result.tension).toBeCloseTo(0.58)
    expect(result.buildProgress).toBeGreaterThan(0)
    expect(result.vocalEnergy).toBeGreaterThan(0)
    expect(result.render.bassMotion).toBeGreaterThan(0)
    expect(result.render.kickImpulse).toBeGreaterThan(0)
    expect(result.render.snareImpulse).toBeGreaterThan(0)
    expect(result.render.highShimmer).toBeGreaterThan(0)
    expect(result.render.distortion).toBeGreaterThan(0)
    expect(result.render.buildSeparation).toBeGreaterThan(0)
    expect(result.render.dropImpact).toBeGreaterThan(0)
    expect(result.render.vocalProtection).toBeGreaterThan(0)
    expect(result.structure).toMatchObject({
      topologyIdentity: 'audio-section:drop',
      previousTopologyIdentity: 'audio-section:intro',
    })
  })

  it('commits section topology on the next analyzed downbeat', () => {
    const staggeredSections = [
      { ...sections[0], endSec: 4.25 },
      { ...sections[1], startSec: 4.25 },
    ]
    const beforeCommitContext = buildSharedPerformanceContext({
      audioTimeSec: 4.3,
      frame: frame({ timeSec: 4.3, beatIndex: 8, beatInBar: 0, beatPhase: 0.6, kick: 0, snare: 0, hat: 0, drop: 0 }),
      resolvedSections: staggeredSections,
      trackIdentity: 'track-a',
      trackChangeIdentity: 'track:track-a',
    })
    const beforeCommit = update(new CanvasFracturesAudioAdapter(), beforeCommitContext)

    expect(beforeCommit.structure?.topologyIdentity).toBe('audio-section:intro')
    expect(beforeCommit.structure?.topologyBoundarySec).toBeCloseTo(6)

    const committedContext = buildSharedPerformanceContext({
      audioTimeSec: 6,
      frame: frame({ timeSec: 6, beatIndex: 12, beatInBar: 0, beatPhase: 0, kick: 0, snare: 0, hat: 0, drop: 0 }),
      resolvedSections: staggeredSections,
      trackIdentity: 'track-a',
      trackChangeIdentity: 'track:track-a',
    })
    const committed = update(new CanvasFracturesAudioAdapter(), committedContext)
    expect(committed.structure?.topologyIdentity).toBe('audio-section:drop')
    expect(committed.structure?.previousTopologyIdentity).toBe('audio-section:intro')
  })

  it('scales curated routes and disables every local modulation at Audio Response zero', () => {
    const sourceContext = context(frame({ drop: 0 }))
    const high = update(new CanvasFracturesAudioAdapter(), sourceContext)
    const low = update(new CanvasFracturesAudioAdapter(), sourceContext, {
      controls: { ...fullControls, bassMotion: 0.25, transientGlitch: 0.25, structuralResponse: 0.25 },
    })
    const off = update(new CanvasFracturesAudioAdapter(), sourceContext, {
      controls: { ...fullControls, audioResponse: 0 },
    })

    expect(low.render.bassMotion).toBeCloseTo(high.render.bassMotion * 0.25)
    expect(low.render.kickImpulse).toBeCloseTo(high.render.kickImpulse * 0.25)
    expect(low.render.buildSeparation).toBeCloseTo(high.render.buildSeparation * 0.25)
    const { dropDirection: _dropDirection, ...disabledRoutes } = off.render
    expect(Object.values(disabledRoutes).every(value => value === 0)).toBe(true)
    expect(off.structure).toBeNull()
    expect(off.bass).toBeGreaterThan(0)
  })

  it('uses local attack/release smoothing and predictable transient decay', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const first = update(adapter, context(frame({ timeSec: 4, bass: 1, kick: 1, snare: 0, hat: 0, drop: 0 })))
    const secondContext = context(frame({ timeSec: 4.05, bass: 0, kick: 0, snare: 0, hat: 0, drop: 0, beatIndex: 8 }))
    const second = update(adapter, secondContext, { nowSec: 4.05, positionSec: 4.05 })

    expect(first.render.kickImpulse).toBeGreaterThan(0)
    expect(second.bass).toBeGreaterThan(0)
    expect(second.bass).toBeLessThan(first.bass)
    expect(second.render.kickImpulse).toBeGreaterThan(0)
    expect(second.render.kickImpulse).toBeLessThan(first.render.kickImpulse)
  })

  it('attenuates motion, suppresses flash, and omits added structural changes for reduced motion', () => {
    const sourceContext = context(frame())
    const full = update(new CanvasFracturesAudioAdapter(), sourceContext)
    const reduced = update(new CanvasFracturesAudioAdapter(), sourceContext, {
      controls: { ...fullControls, reducedMotion: true },
    })

    expect(reduced.render.bassMotion).toBeLessThan(full.render.bassMotion)
    expect(reduced.render.kickImpulse).toBeLessThan(full.render.kickImpulse)
    expect(reduced.render.flash).toBe(0)
    expect(reduced.structure).toBeNull()
  })

  it('clamps oversized controls and signals to safe render bounds', () => {
    const result = update(new CanvasFracturesAudioAdapter(), context(frame({
      bass: 4,
      mid: 3,
      high: 5,
      kick: 4,
      snare: 4,
      hat: 4,
      energy: 4,
      relativeEnergy: 4,
      flux: 4,
      tension: 4,
      build: 4,
      drop: 4,
      vocal: 4,
    })), {
      controls: {
        audioResponse: 4,
        bassMotion: 4,
        transientGlitch: 4,
        structuralResponse: 4,
        reducedMotion: false,
      },
    })

    const { dropDirection, flash, ...unitRoutes } = result.render
    expect(Object.values(unitRoutes).every(value => value >= 0 && value <= 1)).toBe(true)
    expect(dropDirection === -1 || dropDirection === 1).toBe(true)
    expect(flash).toBeLessThanOrEqual(0.65)
  })

  it('decays an active transient while paused instead of accumulating it', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const activeContext = context(frame({ timeSec: 4, kick: 1, snare: 0, hat: 0, drop: 0 }))
    const active = update(adapter, activeContext)
    const paused = update(adapter, activeContext, {
      nowSec: 4.08,
      positionSec: 4,
      isPlaying: false,
      isPaused: true,
    })

    expect(active.render.kickImpulse).toBeGreaterThan(0)
    expect(paused.render.kickImpulse).toBeLessThan(active.render.kickImpulse)
  })

  it('keeps low-confidence partial analysis continuous while omitting unavailable structure', () => {
    const partialFrame = frame({ timeSec: 2, kick: 0, snare: 0, hat: 0, drop: 0 })
    partialFrame.capabilities = {
      ...partialFrame.capabilities,
      beatGrid: false,
      sections: false,
    }
    partialFrame.confidence = {
      ...partialFrame.confidence,
      section: 0,
    }
    const partialContext = buildSharedPerformanceContext({
      audioTimeSec: 2,
      frame: partialFrame,
      resolvedSections: [],
      trackIdentity: 'track-partial',
      trackChangeIdentity: 'track:track-partial',
    })
    const result = update(new CanvasFracturesAudioAdapter(), partialContext)

    expect(result.source).toBe('shared-context')
    expect(result.render.bassMotion).toBeGreaterThan(0)
    expect(result.structure).toBeNull()
  })

  it('uses Particle Aura analyser fallback without inventing structural signals', () => {
    const analyser = {
      frequencyBinCount: 32,
      getByteFrequencyData(data: Uint8Array) {
        data.fill(220, 0, 3)
        data.fill(120, 5, 17)
        data.fill(180, 20)
      },
    } as unknown as AnalyserNode
    const result = update(new CanvasFracturesAudioAdapter(), null, {
      analyser,
      nowSec: 3,
      positionSec: 3,
      isPlaying: true,
      isPaused: false,
      trackIdentity: null,
    })

    expect(result.source).toBe('analyser-fallback')
    expect(result.bass).toBeGreaterThan(0.5)
    expect(result.high).toBeGreaterThan(0)
    expect(result.render.kickImpulse).toBeGreaterThan(0)
    expect(result.structure).toBeNull()
  })

  it('matches Particle Aura no-track autonomous fallback values', () => {
    const expected = resolveCanvasFracturesParticleAuraFallbackFrame({
      nowSec: 2.5,
      analyser: null,
      frequencyData: null,
      isPlaying: false,
      isPaused: true,
      previousBass: 0,
      heldBeat: 0,
    }).frame
    const actual = update(new CanvasFracturesAudioAdapter(), null, {
      nowSec: 2.5,
      positionSec: 0,
      isPlaying: false,
      isPaused: true,
      trackIdentity: null,
    })

    expect(actual.source).toBe('autonomous-fallback')
    expect(actual.bass).toBeCloseTo(expected.bass)
    expect(actual.mid).toBeCloseTo(expected.mid)
    expect(actual.high).toBeCloseTo(expected.high)
    expect(actual.overallEnergy).toBeCloseTo(expected.overallEnergy)
    expect(actual.phraseProgress).toBeCloseTo(expected.phraseProgress)
    expect(actual.sectionProgress).toBeCloseTo(expected.sectionProgress)
  })

  it('resets envelopes on track replacement and suppresses replacement-frame hits', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const before = update(adapter, context(frame({ trackId: 'track-a', kick: 1, drop: 0 })))
    const replacement = update(adapter, context(frame({ trackId: 'track-b', timeSec: 0.2, kick: 1, drop: 1 })), {
      nowSec: 4.1,
      positionSec: 0.2,
      trackIdentity: 'track-b',
    })

    expect(before.render.kickImpulse).toBeGreaterThan(0)
    expect(replacement.resetReason).toBe('track-replacement')
    expect(replacement.render.kickImpulse).toBe(0)
    expect(replacement.render.dropImpact).toBe(0)
  })

  it('resets on explicit seeks without firing the drop under the playhead', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const initial = context(frame({ timeSec: 3.9, kick: 0, snare: 0, hat: 0, drop: 0 }), { seekIdentity: 'seek:0' })
    update(adapter, initial)
    const sought = context(frame({ timeSec: 4.1, kick: 1, drop: 1 }), {
      previous: initial,
      seekIdentity: 'seek:1',
    })
    const result = update(adapter, sought, { nowSec: 4.1, positionSec: 4.1 })

    expect(sought.seekDetected).toBe(true)
    expect(result.resetReason).toBe('seek')
    expect(result.render.kickImpulse).toBe(0)
    expect(result.render.dropImpact).toBe(0)
  })

  it('resets at loop wraps and does not accumulate the loop-start drop', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const beforeLoop = context(frame({ timeSec: 11.9, kick: 0, drop: 0, beatIndex: 23 }))
    update(adapter, beforeLoop)
    const afterLoop = context(frame({ timeSec: 4.05, kick: 1, drop: 1, beatIndex: 8 }), { previous: beforeLoop })
    const result = update(adapter, afterLoop, { nowSec: 12, positionSec: 4.05 })

    expect(afterLoop.loopWrapDetected).toBe(true)
    expect(result.resetReason).toBe('loop')
    expect(result.render.kickImpulse).toBe(0)
    expect(result.render.dropImpact).toBe(0)
  })

  it('does not retrigger the same drop occurrence after a brief signal dip', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const firstContext = context(frame({ timeSec: 4, kick: 0, snare: 0, hat: 0, drop: 1 }))
    const first = update(adapter, firstContext)
    const dippedContext = context(frame({ timeSec: 4.05, kick: 0, snare: 0, hat: 0, drop: 0 }), { previous: firstContext })
    const dipped = update(adapter, dippedContext, { nowSec: 4.05, positionSec: 4.05 })
    const risenContext = context(frame({ timeSec: 4.1, kick: 0, snare: 0, hat: 0, drop: 1 }), { previous: dippedContext })
    const risen = update(adapter, risenContext, { nowSec: 4.1, positionSec: 4.1 })

    expect(first.render.dropImpact).toBeGreaterThan(0)
    expect(dipped.render.dropImpact).toBeLessThan(first.render.dropImpact)
    expect(risen.render.dropImpact).toBeLessThan(dipped.render.dropImpact)
  })

  it('treats one held drop signal as one event identity', () => {
    const adapter = new CanvasFracturesAudioAdapter()
    const heldDrop = context(frame({ timeSec: 4, kick: 0, snare: 0, hat: 0, drop: 1 }))
    const first = update(adapter, heldDrop)
    const second = update(adapter, heldDrop, { nowSec: 4.05, positionSec: 4.05 })
    const third = update(adapter, heldDrop, { nowSec: 4.1, positionSec: 4.1 })

    expect(first.render.dropImpact).toBeGreaterThan(0)
    expect(second.render.dropImpact).toBeLessThan(first.render.dropImpact)
    expect(third.render.dropImpact).toBeLessThan(second.render.dropImpact)
  })

  it('adds temporary motion without mutating the deterministic fragment baseline', () => {
    const plan = generateCanvasFracturesPlan({
      presetId: 'canvas-fractures',
      sourceIdentity: 'audio-transform',
      mediaType: 'image',
      variationSeed: 42,
      topologyRevision: 0,
      layoutRevision: 0,
      mode: 'mixed',
      intensity: 0.7,
      focusProtection: 0.7,
      focusX: 0.5,
      focusY: 0.5,
      composition: 0.6,
      placementMode: 'balanced',
      quality: 'balanced',
      anchorMode: 'alwaysVisible',
    })
    const fragment = plan.fragments.find(candidate => candidate.anchorRole === 'fragment') ?? plan.fragments[0]
    const baseline = { ...fragment.currentTransform }
    const modulated = modulateCanvasFracturesFragmentTransform({
      fragment,
      centerX: fragment.currentTransform.centerX * 1280,
      centerY: fragment.currentTransform.centerY * 720,
      scale: fragment.currentTransform.scale,
      fitWidth: 1280,
      fitHeight: 720,
      framePositionSec: 4,
      audio: {
        bassMotion: 1,
        anchorBreathing: 1,
        kickImpulse: 1,
        snareImpulse: 1,
        highShimmer: 1,
        distortion: 1,
        buildSeparation: 1,
        dropImpact: 0.5,
        dropDirection: 1,
        vocalProtection: 0,
        downbeatPulse: 1,
        flash: 1,
      },
    })

    expect(modulated.scale).not.toBe(fragment.currentTransform.scale)
    expect(modulated.centerX).not.toBe(fragment.currentTransform.centerX * 1280)
    expect(fragment.currentTransform).toEqual(baseline)
  })

  it('temporarily protects focal fragments without rewriting effect assignments', () => {
    const plan = generateCanvasFracturesPlan({
      presetId: 'canvas-fractures', sourceIdentity: 'focus', mediaType: 'image', variationSeed: 7,
      topologyRevision: 0, layoutRevision: 0, mode: 'mixed', intensity: 0.7,
      focusProtection: 1, focusX: 0.5, focusY: 0.5, composition: 0.5,
      placementMode: 'balanced', quality: 'balanced', anchorMode: 'alwaysVisible',
    })
    const focus = plan.fragments.find(fragment => fragment.anchorRole === 'focus') ?? plan.fragments[0]
    const effects: CanvasFracturesResolvedFragmentEffects = {
      blendMode: 'difference', posterization: 1, posterizeLevels: 3, hueShift: 1, duotone: 1,
      shadow: 1, shadowOffsetPx: 10, shadowBlurPx: 10, duplicateCount: 2, copyOpacity: 1,
      copyOffsetPx: 10, flash: 1, blur: 1, sharpen: 1, dissolve: 1,
    }
    const protectedEffects = protectCanvasFracturesFragmentEffects({
      fragment: focus,
      effects,
      audio: { ...fullRenderState(), vocalProtection: 1 },
    })

    expect(protectedEffects.flash).toBeLessThan(effects.flash)
    expect(protectedEffects.dissolve).toBeLessThan(effects.dissolve)
    expect(protectedEffects.duplicateCount).toBe(0)
    expect(focus.effectAssignment).toBe(plan.fragments.find(fragment => fragment.id === focus.id)?.effectAssignment)
  })

  it('has no Auto Performance gate and contains no shared-audio write calls', () => {
    const adapterSource = readFileSync(fileURLToPath(new URL('./CanvasFracturesAudio.ts', import.meta.url)), 'utf8')
    const shellSource = readFileSync(fileURLToPath(new URL('../../ReactCanvasEngineShell.tsx', import.meta.url)), 'utf8')
    expect(adapterSource).not.toContain('autoPerformance')
    expect(adapterSource).not.toContain('AudioFeatureBus.setFrame')
    expect(adapterSource).not.toContain('AudioFeatureBus.updatePartial')
    expect(adapterSource).not.toContain('musicIntelligenceEngine')
    expect(shellSource).toContain('if (!particleReconstructionActive && !fragmentCollageActive)')
    expect(shellSource).toContain('performanceContextRef={particlePerformanceContextRef}')
  })
})

function fullRenderState() {
  return {
    bassMotion: 0,
    anchorBreathing: 0,
    kickImpulse: 0,
    snareImpulse: 0,
    highShimmer: 0,
    distortion: 0,
    buildSeparation: 0,
    dropImpact: 0,
    dropDirection: 1 as const,
    vocalProtection: 0,
    downbeatPulse: 0,
    flash: 0,
  }
}
