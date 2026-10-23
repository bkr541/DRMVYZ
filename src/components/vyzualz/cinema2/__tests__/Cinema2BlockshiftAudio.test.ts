import { describe, expect, it } from 'vitest'
import { blockshiftAudioFixture, type BlockshiftAudioProfile } from '../../../../test/support/Cinema2BlockshiftAudioFixtures'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST as manifest, CINEMA2_BLOCKSHIFT_PARAMETER_IDS as ids } from '../presets/Cinema2BlockshiftPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'
import { createCinema2BlockshiftNativeModuleDefinition, type Cinema2BlockshiftModuleInstance } from '../modules/Cinema2BlockshiftNativeModule'
import { Cinema2ModuleResourceScope } from '../modules/Cinema2ModuleResources'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2BlockshiftAudioRuntime, CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS, type Cinema2BlockshiftAudioCue, type Cinema2BlockshiftAudioChannels } from '../modules/blockshift/Cinema2BlockshiftAudio'
import { buildCinema2BlockshiftLayout, cinema2BlockshiftHalfExtents } from '../modules/blockshift/Cinema2BlockshiftLayout'
import { blendCinema2BlockshiftPoses } from '../modules/blockshift/Cinema2BlockshiftOrchestration'
import { CINEMA2_BLOCKSHIFT_PATTERN_IDS } from '../modules/blockshift/Cinema2BlockshiftDomain'

function harness() {
  const compiled = compileCinema2NativePreset(manifest)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const plan = compiled.plan, state = new Cinema2ParameterState(plan.parameters)
  let instance: Cinema2BlockshiftModuleInstance
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId ? state.getValue(target.parameterId) : target.authoredBaseValue,
    dispatchAction: event => instance.handleAction?.('musicalCue', event),
  })
  const targets = new Map(plan.targets.targets.filter(t => t.kind === 'module').map(t => [t.property, t]))
  const unused = () => { throw new Error('Unused test facet') }
  const context: Cinema2ModuleCreateContext = {
    module: manifest.modules![0]!, resources: new Cinema2ModuleResourceScope(createCinemaMockWebGL(), () => {}),
    parameters: { get: name => { const target = targets.get(name); return target ? resolver.resolve(target.id).value : undefined }, getAuthored: unused, resolve: name => { const t = targets.get(name); return t ? resolver.resolve(t.id) : null } },
    targets: { getTarget: () => null, resolve: unused, dispatch: unused }, media: { get: () => null, getSlot: () => null }, randomness: { sample: unused, probability: unused, stream: unused, eventStream: unused },
  }
  instance = createCinema2BlockshiftNativeModuleDefinition().create(context) as Cinema2BlockshiftModuleInstance
  const choreography = new Cinema2ChoreographyRuntime(plan, state, resolver), director = new Cinema2VisualDirector()
  let source = blockshiftAudioFixture('silence', 0, 1), sequence = 1, visualId = 0
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => source, getPublicationMeta: () => ({ sequence, publishedAtMs: source.timeSec * 1000, publisherId: 'p5-test', kind: 'frame' }) })
  const update = (profile: BlockshiftAudioProfile, time = source.timeSec + 0.1, options: { paused?: boolean; repeat?: boolean; republish?: boolean; track?: string; noSource?: boolean } = {}) => {
    if (options.republish) { source = { ...source, timeSec: time, frameId: source.frameId + 1 }; sequence++ }
    else if (!options.repeat) { source = blockshiftAudioFixture(profile, time, source.frameId + 1, options.track); sequence++ }
    const audio = bridge.capture(++visualId)
    const frame: Cinema2ModuleFrameReadContext = { frameId: visualId, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 0.1, contextGeneration: 1, viewport: { width: 960, height: 540, dpr: 1 }, audio: options.noSource ? null : audio, director: director.capture(audio),
      transport: { sourcePresent: !options.noSource, playing: !options.paused, paused: !!options.paused, animationActive: !options.paused, analysisActive: true, trackId: source.trackId!, timeSec: time, bpm: 120, bpmSync: false } }
    choreography.update(frame); instance.lifecycle.update({ frame, parameters: context.parameters, targets: context.targets })
    return instance.inspect()
  }
  return { state, instance, update, choreography }
}

describe('BLOCKSHIFT P5 shared Audio Intelligence', () => {
  it('maps all continuous channels through real shared choreography without persistent mutation', () => {
    const h = harness(); h.update('silence')
    const before = h.state.serialize()
    expect(h.update('bass').audio.channels).toMatchObject({ subPressure: 0.95, bassPressure: 0.9, audioEnergy: 0.8 })
    expect(h.update('mids').audio.channels.midTilt).toBe(0.9)
    expect(h.update('highs').audio.channels).toMatchObject({ highGlint: 0.9, spectralGlint: 0.8 })
    expect(h.update('vocals').audio.channels.vocalRestraint).toBeGreaterThan(0)
    expect(h.update('build').audio.channels.buildTension).toBe(0.9)
    expect(h.state.serialize()).toEqual(before)
    expect(h.choreography.getSnapshot().diagnostics).toEqual([])
  })

  it.each(CINEMA2_AFTERHOURS_TRIGGER_IDS)('switches only on fresh canonical %s events, honoring OFF, manual selection and stale identities', trigger => {
    const h = harness(); h.state.setPersistentValue(ids.patternChange, true); h.state.setPersistentValue(ids.trigger, trigger)
    const profile: BlockshiftAudioProfile = trigger === 'beat2' || trigger === 'beat4' ? 'beat' : trigger === 'bar4' || trigger === 'bar8' ? 'bar' : trigger
    const first = h.update(profile, 0.1)
    expect(first.pattern).toBe('stagger')
    const switched = h.update(profile, 0.2)
    expect(switched.pattern).not.toBe('stagger')
    expect(h.update(profile, 0.2, { repeat: true }).pattern).toBe(switched.pattern)
    h.state.setPersistentValue(ids.pattern, 'wave')
    expect(h.update(profile, 0.2, { repeat: true }).pattern).toBe('wave')
    expect(h.state.getValue(ids.patternChange)).toBe(true)
    h.update(profile, 0.3, { paused: true })
    expect(h.update(profile, 0.3, { repeat: true }).pattern).toBe('wave')
    expect(h.update(profile, 0.4).pattern).not.toBe('wave')
    h.state.setPersistentValue(ids.patternChange, false)
    expect(h.update(profile, 0.5).pattern).toBe('wave')
    expect(h.state.getValue(ids.pattern)).toBe('wave')
  })

  it('does not count a structural phrase and its held clock fallback as separate events on a new publication', () => {
    const h = harness(); h.state.setPersistentValue(ids.patternChange, true); h.state.setPersistentValue(ids.trigger, 'phrase')
    h.update('silence'); const once = h.update('phrase').pattern
    expect(h.update('phrase', 0.21, { republish: true }).pattern).toBe(once)
  })

  it('dispatches distinct kick/snare/downbeat/bar/phrase/section/drop envelopes, deduplicates and suppresses activation/resume', () => {
    const h = harness()
    expect(h.update('kick').audio.envelopes.kick).toBe(0)
    expect(h.update('kick').audio.envelopes.kick).toBeGreaterThan(0.9)
    const repeated = h.update('kick', 0.2, { repeat: true }).audio
    expect(repeated.envelopes.kick).toBeLessThan(0.9)
    expect(repeated.consumed).toBe(1)
    for (const profile of ['snare', 'downbeat', 'bar', 'phrase', 'section', 'drop'] as const) expect(h.update(profile).audio.envelopes[profile]).toBeGreaterThan(0)
    expect(h.instance.inspect().pattern).toBe('stagger') // Pattern Change OFF does not disable reactions.
    const before = h.instance.inspect().audio
    h.update('kick', 1, { paused: true })
    expect(h.instance.inspect().audio.envelopes).toEqual(before.envelopes)
    const consumed = before.consumed
    expect(h.update('kick', 1, { repeat: true }).audio.consumed).toBe(consumed)
    expect(h.update('kick', 1.1).audio.consumed).toBe(consumed + 1)
    expect(h.update('kick', 0, { track: 'replacement-source' }).audio).toMatchObject({ consumed: 0, envelopes: { kick: 0, snare: 0 } })
    expect(h.update('kick', 0.1, { track: 'replacement-source' }).audio.consumed).toBe(1)
    expect(h.update('kick', 0, { track: 'replacement-source' }).audio.consumed).toBe(0) // backward seek/loop
    expect(h.update('silence', 0.2, { noSource: true }).audio.channels).toEqual(CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS)
  })

  it('applies physical bass/mid motion, distinguishable kick/snare, vocal restraint and hard disables', () => {
    const base = buildCinema2BlockshiftLayout(), runtime = new Cinema2BlockshiftAudioRuntime()
    const input = { channels: { ...CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS } as Cinema2BlockshiftAudioChannels, cues: [] as Cinema2BlockshiftAudioCue[], active: true, reset: false, deltaSeconds: 0.05, motionAmount: 1, reactivity: 1, sectionType: 'verse' }
    runtime.update(input)
    const result = (channels = input.channels, cues: Cinema2BlockshiftAudioCue[] = []) => { runtime.update({ ...input, channels, cues }); return runtime.apply(base, 1, 45) }
    const bass = result({ ...input.channels, bassPressure: 1, subPressure: 1 })
    expect(bass.pose.map(b => b.position)).not.toEqual(base.map(b => b.position))
    expect(result({ ...input.channels, midTilt: 1 }).pose.map(b => b.rotation)).not.toEqual(base.map(b => b.rotation))
    runtime.reset(); runtime.update(input)
    const kick = result(input.channels, [{ kind: 'kick', id: 'k', strength: 1 }])
    runtime.reset(); runtime.update(input)
    const snare = result(input.channels, [{ kind: 'snare', id: 's', strength: 1 }])
    expect(kick.pose.map(b => b.position)).not.toEqual(snare.pose.map(b => b.position))
    const moving = result({ ...input.channels, bassPressure: 1 })
    runtime.update({ ...input, motionAmount: 0, channels: input.channels })
    expect(runtime.apply(base, 1, 45)).toEqual(moving)
    expect(runtime.apply(base, 0, 45).pose).toBe(base)
    expect(runtime.apply(base, 0, 45).emission.every(n => n === 1)).toBe(true)
    const restrained = new Cinema2BlockshiftAudioRuntime(); restrained.update({ ...input, channels: { ...input.channels, bassPressure: 1, vocalRestraint: 1 } })
    const unrestrained = new Cinema2BlockshiftAudioRuntime(); unrestrained.update({ ...input, channels: { ...input.channels, bassPressure: 1 } })
    const distance = (pose: typeof base) => pose.reduce((sum, b, i) => sum + Math.hypot(...b.position.map((n, a) => n - base[i]!.position[a]!)), 0)
    expect(distance(restrained.apply(base, 1, 0).pose)).toBeLessThan(distance(unrestrained.apply(base, 1, 0).pose))
  })

  it('keeps maximal combined audio safe during every pattern and transitions at geometry extrema', () => {
    const runtime = new Cinema2BlockshiftAudioRuntime()
    const input = { channels: Object.fromEntries(Object.keys(CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS).map(k => [k, 1])) as Cinema2BlockshiftAudioChannels, cues: [] as Cinema2BlockshiftAudioCue[], active: true, reset: false, deltaSeconds: 0.01, motionAmount: 1, reactivity: 1, sectionType: 'drop' }
    runtime.update(input); runtime.update({ ...input, cues: Object.keys(runtime.inspect().envelopes).map(kind => ({ kind: kind as Cinema2BlockshiftAudioCue['kind'], id: kind, strength: 1 })) })
    for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const phase of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) for (const size of [1.35, 3]) for (const spread of [0.5, 3]) {
      const base = buildCinema2BlockshiftLayout({ pattern, phase, blockSize: size, spread, depth: 1, rotationRange: 45 })
      const poses = [base, ...CINEMA2_BLOCKSHIFT_PATTERN_IDS.filter(to => to !== pattern).map(to => blendCinema2BlockshiftPoses(base, buildCinema2BlockshiftLayout({ pattern: to, phase: (phase + 0.3) % 1, blockSize: size, spread, depth: 1, rotationRange: 45 }), 0.5))]
      for (const pose of poses) {
      const result = runtime.apply(pose, 1, 45)
      for (const b of result.pose) {
        expect(Math.hypot(...b.position) + b.size * Math.sqrt(3) / 2).toBeLessThanOrEqual(300)
        expect(Math.hypot(...b.position) - b.size * Math.sqrt(3) / 2).toBeGreaterThanOrEqual(2.5 - 1e-8)
        for (const other of result.pose.slice(0, b.index)) expect(b.position.some((n, a) => Math.abs(n - other.position[a]!) >= cinema2BlockshiftHalfExtents(b)[a]! + cinema2BlockshiftHalfExtents(other)[a]! + 1.5 - 1e-8)).toBe(true)
      }
      expect(result.emission.every(n => n <= 1 && n >= 0)).toBe(true)
      expect(result.pose.map(b => b.size)).toEqual(base.map(b => b.size))
      }
    }
  })
})

describe('BLOCKSHIFT P6 shared Director/Auto integration', () => {
  it('routes real Director values and fresh build/drop actions while never changing persisted controls', () => {
    const h = harness(); h.state.setPersistentValue(ids.autoPerformance, true); h.update('silence')
    const before = h.state.serialize()
    expect(h.update('build').performance.overlay?.kind).toBe('build')
    expect(h.update('build').performance.director.directorBuild).toBeGreaterThan(0.5)
    expect(h.instance.inspect().performance.directorGain).toBeLessThanOrEqual(1.25)
    expect(h.update('drop').performance.overlay?.kind).toBe('drop')
    expect(h.state.serialize()).toEqual(before)
    expect(h.state.getValue(ids.pattern)).toBe('stagger')
    expect(h.state.getValue(ids.patternChange)).toBe(false)
    expect(h.choreography.getSnapshot().diagnostics).toEqual([])
  })

  it('cancels on same-frame manual Pattern/geometry edits, suppresses stale build/drop and lets the live underlying pattern advance', () => {
    const h = harness(); h.state.setPersistentValue(ids.autoPerformance, true); h.state.setPersistentValue(ids.patternChange, true); h.state.setPersistentValue(ids.trigger, 'kick')
    h.update('silence'); h.update('build'); h.update('build')
    h.state.setPersistentValue(ids.pattern, 'wave')
    const manual = h.update('drop')
    expect(manual).toMatchObject({ pattern: 'wave', transitionProgress: 1, performance: { overlay: null, cooldown: 2 } })
    h.update('silence'); h.update('build')
    expect(h.instance.inspect().performance.overlay).toBe(null)
    h.update('kick'); expect(h.instance.inspect().pattern).not.toBe('wave')
    for (let i = 0; i < 12; i++) h.update('silence')
    expect(h.update('build').performance.overlay?.kind).toBe('build')
    const previousRuntimePattern = h.instance.inspect().pattern
    const runtimePattern = h.update('kick').pattern
    expect(runtimePattern).not.toBe(previousRuntimePattern)
    expect(h.instance.inspect().performance.overlay?.kind).toBe('build')
    h.state.setPersistentValue(ids.spread, 1.5)
    expect(h.update('drop').performance.overlay).toBe(null)
    expect(h.state.getValue(ids.pattern)).toBe('wave')
    expect(h.state.getValue(ids.patternChange)).toBe(true)
    expect(h.state.getValue(ids.trigger)).toBe('kick')
  })

  it('defaults Auto OFF, consumes disabled events, freezes physical automation at master zero and clears on source/seek/audio zero', () => {
    const h = harness(); expect(h.state.getValue(ids.autoPerformance)).toBe(false)
    h.update('silence'); expect(h.update('build').performance.overlay).toBe(null)
    h.state.setPersistentValue(ids.autoPerformance, true)
    expect(h.update('build').performance.overlay).toBe(null)
    h.update('silence'); h.update('build'); h.update('build')
    const before = h.instance.inspect().performance
    h.state.setPersistentValue(ids.motionAmount, 0)
    expect(h.update('drop').performance).toEqual(before)
    h.state.setPersistentValue(ids.audioReactivity, 0)
    expect(h.update('build').performance.overlay).toBe(null)
    h.state.setPersistentValue(ids.motionAmount, 0.55); h.state.setPersistentValue(ids.audioReactivity, 0.8)
    h.update('silence'); h.update('drop')
    expect(h.update('drop', 0, { track: 'new-source' }).performance.overlay).toBe(null)
    expect(h.state.getValue(ids.autoPerformance)).toBe(true)
  })
})
