import { describe, expect, it } from 'vitest'
import { compilePixGridDeckRasterFrame } from '../PixGridDeckCompilerCore'
import { resolvePixGridDeckTransitionPairPolicy } from '../PixGridDeckDomain'
import { compilePixGridDeckPreparedFrameTransition, createPixGridDeckTransitionCacheKey } from '../PixGridDeckTransitionPlanner'
import { getPixGridMotionProfile, resolvePixGridMotionDynamics, resolvePixGridMotionProfile } from '../PixGridMotionProfiles'
import {
  PIX_GRID_PRESET_DEFINITIONS,
  PIX_GRID_REFERENCE_SEQUENCE,
  PixGridPresetRegistry,
  pixGridPresetRegistry,
  resolvePixGridRegisteredSequenceSource,
  validatePixGridPresetDefinitions,
} from '../PixGridPresetRegistry'
import { materializePixGridSequenceDeck } from '../PixGridSequenceDefinition'
import { resolvePixGridSequencePlan } from '../PixGridSequenceClock'
import type { PixGridAudioFrame } from '../PixGridTypes'

function frame(id: string, variant: number) {
  const width = 16
  const height = 12
  const raster = new Uint8Array(width * height * 4)
  const alpha = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const lit = ((x * (variant + 2) + y * (variant + 3)) % (5 + variant)) < 2
    const cell = y * width + x
    const offset = cell * 4
    raster.set([40 + variant * 40, 210 - variant * 25, 240, lit ? 255 : 0], offset)
    alpha[cell] = lit ? 255 : 0
  }
  return compilePixGridDeckRasterFrame({ cacheKey: `frame:${id}`, mediaId: `source:${id}`, sourceFingerprint: `legacy:${id}`, sourceRevision: 1, rasterPixels: raster, sourceAlpha: alpha, width, height, transparentBackground: '#000000', hasAlpha: true })
}

const silentFrame: PixGridAudioFrame = {
  audioTime: 1, bass: 0, mid: 0, high: 0, volume: 0, beatHit: false, beatPhase: 0, isPlaying: true,
  sourceValues: {},
}

describe('PixGrid declarative preset registry', () => {
  it('registers each built-in exactly once and resolves every dependency', () => {
    const ids = pixGridPresetRegistry.presetIds()
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      'pix-grid-bass-beacon', 'pix-grid-geometric-reactor', 'pix-grid-pixel-parade',
      'pix-grid-media-deck-producer', 'pix-grid-reference-symbol-morph',
    ]))
    expect(pixGridPresetRegistry.issues).toEqual([])
    for (const definition of pixGridPresetRegistry.list()) {
      expect(definition.motionProfiles.length).toBeGreaterThan(0)
      if (definition.performanceProgramId) expect(definition.performanceProgram?.id).toBe(definition.performanceProgramId)
    }
  })

  it('rejects duplicates and reports missing dependencies with actionable paths', () => {
    const original = PIX_GRID_PRESET_DEFINITIONS[0]!
    const issues = validatePixGridPresetDefinitions([
      original,
      { ...original, motionProfileIds: ['does-not-exist'], performanceProgramId: 'missing-program' },
    ])
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['duplicate-preset-id', 'missing-motion-profile', 'missing-performance-program']))
    expect(issues.every(issue => issue.presetId && issue.path)).toBe(true)
    expect(new PixGridPresetRegistry([original, original]).list()).toHaveLength(0)
  })

  it('materializes generated and asset sequence sources through the existing Deck compiler contract', async () => {
    const definition = pixGridPresetRegistry.get('pix-grid-reference-symbol-morph')!
    const deck = definition.sequenceDeck!
    expect(deck.items.map(item => item.id)).toEqual(['heart-occurrence', 'skull-occurrence', 'lightning-occurrence', 'star-occurrence'])
    expect(deck.generatedPresetId).toBe(definition.id)
    const blob = resolvePixGridRegisteredSequenceSource(deck.items[0]!.mediaId)
    expect(blob?.type).toBe('image/svg+xml')
    expect(await blob?.text()).toContain('<svg')
  })

  it('uses one sequence clock and transition compiler for the four-image reference preset', () => {
    const deck = materializePixGridSequenceDeck(PIX_GRID_REFERENCE_SEQUENCE, 'pix-grid-reference-symbol-morph')
    const frames = deck.items.map((item, index) => frame(item.id, index))
    const preparedFrames = deck.items.map((item, index) => ({ itemId: item.id, frameId: frames[index]!.cacheKey }))
    const at = (bar: number) => resolvePixGridSequencePlan({
      deck, preparedFrames, autoPerformanceEnabled: false, motion: 1, transportMode: 'reconstruct',
      timeline: { absoluteBar: bar, sequenceBar: bar, sectionType: 'unknown', sectionId: 'reference', sceneId: null, trackIdentity: 'reference-track', presetId: deck.generatedPresetId, timelineRevision: '1', beatsPerBar: 4 },
    })!
    expect([0, 1, 2, 3].map(bar => at(bar).activeItemId)).toEqual(deck.items.map(item => item.id))
    expect(at(4).activeItemId).toBe('heart-occurrence')
    expect(at(2.5)).toEqual(at(2.5))

    for (let index = 0; index < deck.items.length; index += 1) {
      const source = deck.items[index]!
      const target = deck.items[(index + 1) % deck.items.length]!
      const sourceFrame = frames[index]!
      const targetFrame = frames[(index + 1) % frames.length]!
      const policy = resolvePixGridDeckTransitionPairPolicy(deck.configuration.transitionPolicy, source.id, target.id)
      const resolvedProfile = resolvePixGridMotionProfile({ configuration: deck.configuration, sourceItemId: source.id, targetItemId: target.id })
      const settings = { requestedMode: policy.mode, sourceItemId: source.id, targetItemId: target.id, durationFraction: policy.durationFraction, preferredStrategy: resolvedProfile.profile.preferredStrategy }
      const plan = compilePixGridDeckPreparedFrameTransition({ cacheKey: createPixGridDeckTransitionCacheKey({ sourceFrameCacheKey: sourceFrame.cacheKey, targetFrameCacheKey: targetFrame.cacheKey, settings }), source: sourceFrame, target: targetFrame, settings })
      expect(plan.mode).toBe('pixelTransport')
      expect(resolvedProfile.source).toBe('pair')
    }
  })
})

describe('PixGrid motion profiles and Audio Intelligence routing', () => {
  it('resolves pair, scene, preset, then engine precedence', () => {
    const deck = materializePixGridSequenceDeck(PIX_GRID_REFERENCE_SEQUENCE, 'pix-grid-reference-symbol-morph')
    expect(resolvePixGridMotionProfile({ configuration: deck.configuration, sceneId: 'reference-symbol-morph-drop', sourceItemId: 'heart-occurrence', targetItemId: 'skull-occurrence' }).source).toBe('pair')
    expect(resolvePixGridMotionProfile({ configuration: deck.configuration, sceneId: 'reference-symbol-morph-drop', sourceItemId: 'star-occurrence', targetItemId: 'lightning-occurrence' }).source).toBe('scene')
    expect(resolvePixGridMotionProfile({ configuration: deck.configuration, sourceItemId: 'star-occurrence', targetItemId: 'lightning-occurrence' }).source).toBe('preset')
    expect(resolvePixGridMotionProfile({ configuration: { transitionPolicy: deck.configuration.transitionPolicy }, sourceItemId: 'star-occurrence', targetItemId: 'lightning-occurrence' }).source).toBe('engine')
  })

  it('routes kick, snare, bass, build, and drop without changing authoritative transition progress', () => {
    const profile = getPixGridMotionProfile('explosive-reconstruction')
    const quiet = resolvePixGridMotionDynamics({ profile, audioFrame: silentFrame, choreography: { motionScale: 1, energy: 0, impact: 0 }, transitionActive: true })
    const active = resolvePixGridMotionDynamics({
      profile,
      audioFrame: { ...silentFrame, bass: 0.8, kickHit: true, snareHit: true, buildProgress: 0.9, dropImpactHit: true, sourceValues: { bass: 0.8, kick: 1, snare: 1, buildProgress: 0.9, dropImpact: 1 } },
      choreography: { motionScale: 1, energy: 0.7, impact: 0.8 }, transitionActive: true,
    })
    expect(active.regionPulse).toBeGreaterThan(quiet.regionPulse)
    expect(active.dispersal).toBeGreaterThan(quiet.dispersal)
    expect(active.reconstruction).toBeGreaterThan(quiet.reconstruction)
    expect(active.completionEmphasis).toBeGreaterThan(quiet.completionEmphasis)
    expect(active).not.toHaveProperty('transitionProgress')
  })

  it('ignores disabled and duplicate route identities', () => {
    const base = getPixGridMotionProfile('balanced')
    const profile = { ...base, audioRoutes: [
      { ...base.audioRoutes[0]!, id: 'same', source: 'kick' as const, target: 'regionPulse' as const, amount: 0.4 },
      { ...base.audioRoutes[0]!, id: 'same', source: 'kick' as const, target: 'regionPulse' as const, amount: 1 },
      { ...base.audioRoutes[0]!, id: 'disabled', enabled: false, source: 'kick' as const, target: 'regionPulse' as const, amount: 1 },
    ] }
    const dynamics = resolvePixGridMotionDynamics({ profile, audioFrame: { ...silentFrame, kickHit: true, sourceValues: { kick: 1 } }, choreography: { motionScale: 1, energy: 0, impact: 0 }, transitionActive: true })
    expect(dynamics.regionPulse).toBeCloseTo(0.4)
  })
})
