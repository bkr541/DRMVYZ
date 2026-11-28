import { it } from 'vitest'
import assert from 'node:assert/strict'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset, type Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { createCinema2UserModelPreset } from '../presets/Cinema2UserModelPresetFactory'
import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { ifritMusicFixture, type IfritFixtureOptions } from '../../../../test/support/IfritMusicFixture'
import { createCinema2ModelAudioParameters, MODEL_AUDIO_TARGETS, MODEL_AUDIO_SLOT_COUNT } from './Cinema2ModelAudioChoreography'
import { CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS, CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'

function harness(kind: Cinema2UserModelPreviewKind = 'form', productionPlan?: Readonly<Cinema2CompiledPresetPlan>) {
  const id = (key: string) => `user-model-${kind}-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}` as Cinema2ParameterId
  const numeric: Cinema2ParameterManifest[] = MODEL_AUDIO_TARGETS.map(key => ({ id: id(key), label: key, type: 'float', defaultValue: 0, min: 0, max: 1, modulatable: true, choreographable: true }))
  const modes = Object.keys(CINEMA2_USER_MODEL_PREVIEWS), patterns = CINEMA2_USER_MODEL_PREVIEWS[kind]
  const enums = (key: string, value: string, options: readonly string[]): Cinema2ParameterManifest => ({ id: id(key), label: key, type: 'enum', defaultValue: value, options: options.map(value => ({ value, label: value })) })
  const visual: Cinema2ParameterManifest[] = [...numeric, enums('representation', 'default', ['default', ...modes]), enums('cinematicMaterial', 'original', ['original', 'neon', 'chrome']), enums('defaultRepresentation', kind, modes), enums('pattern', patterns[0], patterns), { id: id('autoPerformance'), label: 'Auto Performance', type: 'boolean', defaultValue: false }, { id: id('transitionDuration'), label: 'Transition', type: 'float', defaultValue: 0, min: 0, max: 3 }]
  const manifest = { schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id: `drmvyz.cinema2.phase-four-${kind}`, revision: 1, metadata: { name: 'Audio fixture' }, parameters: [...visual, ...createCinema2ModelAudioParameters(kind, visual)], modules: [{ id: 'fixture-module', typeId: 'three-scene', version: 1, config: { userModelPreview: kind }, parameters: { shardImpulse: 0, representation: 'default' }, parameterBindings: { shardImpulse: { $ref: id('shardImpulse') }, representation: { $ref: id('representation') } } }] } as unknown as Cinema2NativePresetManifest
  const compiled = compileCinema2NativePreset(manifest)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const plan = productionPlan ?? compiled.plan, state = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, { resolveBaseValue: t => t.parameterId ? state.getValue(t.parameterId) : t.authoredBaseValue })
  const runtime = new Cinema2ChoreographyRuntime(plan, state, resolver), director = new Cinema2VisualDirector()
  let t = 1, n = 1, fixture = ifritMusicFixture({ frameId: n, timeSec: t })
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => fixture, getPublicationMeta: () => ({ sequence: n, kind: 'frame', publisherId: 'phase-four', reason: null, publishedAtMs: t * 1000 }) })
  const edit = (key: string, value: unknown) => assert.equal(state.setPersistentValue(id(key), value).ok, true, key)
  for (let i = 1; i <= MODEL_AUDIO_SLOT_COUNT; i++) edit(`audioMap${i}Enabled`, false)
  const enable = (source = 'kick', target = 'shardImpulse', slot = 1) => { edit('audioMappingsEnabled', true); for (const [key, value] of Object.entries({ Enabled: true, Source: source, Target: target, Intensity: 1, Min: 0, Max: 1, Attack: .02, Release: .15, Smoothing: 0, Curve: 'linear' })) edit(`audioMap${slot}${key}`, value) }
  const frame = (options: Partial<IfritFixtureOptions> = {}, dt = .05, paused = false, missing = false) => {
    t = options.timeSec ?? t + (paused ? 0 : dt); n++; fixture = ifritMusicFixture({ timeSec: t, frameId: n, ...options })
    const audio = missing ? null : bridge.capture(n)
    runtime.update({ frameId: n, timestampMs: t * 1000, elapsedTimeSec: t, deltaTimeSec: paused ? 0 : dt, viewport: { width: 800, height: 600, dpr: 1 }, contextGeneration: 1, transport: { trackId: fixture.trackId, timeSec: t, playing: !paused, paused, sourcePresent: true, animationActive: !paused, analysisActive: !missing, bpm: options.bpm ?? 120 }, audio, director: audio ? director.capture(audio) : null } as Cinema2ModuleFrameReadContext)
  }
  const value = (key: string, module = false) => { const target = plan.targets.targets.find(t => t.parameterId === id(key) && t.kind === (module ? 'module' : 'parameter')); assert.ok(target, key); const result = resolver.resolve(target.id); assert.ok(result.ok, JSON.stringify(result.diagnostics)); return result.value }
  return { id, plan, state, edit, enable, frame, value, runtime }
}

it('maps actual bridge kick and snare events through the final resolver, not saved state', () => {
  const h = harness(); h.enable(); h.enable('snare', 'hologramFlash', 2); h.frame(); h.frame({ event: 'kick', eventId: 2 }); assert.ok(Number(h.value('shardImpulse')) > .2); assert.equal(h.value('shardImpulse'), h.value('shardImpulse', true)); assert.equal(h.state.getValue(h.id('shardImpulse')), 0); h.frame({ event: 'snare', eventId: 3 }); assert.ok(Number(h.value('hologramFlash')) > .2)
})
it('attack, release and repeated kick publication remain bounded and recover', () => {
  const h = harness(); h.enable(); h.edit('audioMap1Attack', .2); h.frame(); h.frame({ event: 'kick', eventId: 2 }); const first = Number(h.value('shardImpulse')); assert.ok(first > 0 && first < .5); h.frame({ event: 'kick', eventId: 3 }); assert.ok(Number(h.value('shardImpulse')) >= first); for (let i = 0; i < 45; i++) h.frame(); assert.ok(Number(h.value('shardImpulse')) < .01)
})
it('combines continuous routes, applies bounds, inversion and restores mappings', () => {
  const h = harness(); h.enable('bass', 'shatterSpread'); h.enable('high', 'shatterSpread', 2); h.edit('audioMap1Min', .2); h.edit('audioMap1Max', .6); h.edit('audioMap2Invert', true); for (let i = 0; i < 30; i++) h.frame({ bass: 1, high: 1 }); assert.ok(Math.abs(Number(h.value('shatterSpread')) - .3) < .05); const saved = h.state.serialize(); h.edit('audioMappingsEnabled', false); h.frame(); assert.equal(h.value('shatterSpread'), 0); assert.equal(h.state.restore(saved).ok, true); assert.equal(h.state.getValue(h.id('audioMap2Invert')), true)
})
it('quantizes to real beat events, not local timer ticks', () => {
  const h = harness(); h.enable(); h.edit('audioMap1Quantize', 'beat'); h.frame(); h.frame({ event: 'kick', eventId: 2 }); assert.equal(h.value('shardImpulse'), 0); h.frame(); assert.equal(h.value('shardImpulse'), 0); h.frame({ event: 'beat', eventId: 3 }); assert.ok(Number(h.value('shardImpulse')) > 0)
})
it('preserves a paused envelope and clears stale impulses on seek, missing audio and source replacement', () => {
  const h = harness(); h.enable(); h.frame(); h.frame({ event: 'kick', eventId: 2 }); const pulse = h.value('shardImpulse'); h.frame({}, .05, true); assert.equal(h.value('shardImpulse'), pulse); h.frame({ timeSec: 20 }); assert.equal(h.value('shardImpulse'), 0); h.frame({ event: 'kick', eventId: 3 }); h.frame({}, .05, false, true); assert.equal(h.value('shardImpulse'), 0); h.frame({ trackId: 'new-track' }); assert.equal(h.value('shardImpulse'), 0)
})
it('uses canonical drop events for transformations only when opted in, and honors manual override', () => {
  const h = harness(); h.edit('audioRepresentationDirector', true); h.edit('autoPerformance', true); h.frame(); h.frame({ event: 'drop', eventId: 23 }); assert.equal(h.value('representation'), 'shatter'); assert.equal(h.value('representation', true), 'shatter'); assert.equal(h.state.getValue(h.id('representation')), 'default'); h.edit('representation', 'voxel'); h.frame(); assert.equal(h.value('representation'), 'voxel'); h.edit('autoPerformance', false); h.frame({ event: 'drop', eventId: 24 }); assert.equal(h.value('representation'), 'voxel')
})
it('supports all six preset identities, without changing authored representation or pattern', () => {
  for (const kind of Object.keys(CINEMA2_USER_MODEL_PREVIEWS) as Cinema2UserModelPreviewKind[]) { const h = harness(kind); h.enable('build', 'cinematicBloom'); for (let i = 0; i < 12; i++) h.frame({ build: .1 + .07 * i }); assert.ok(Number(h.value('cinematicBloom')) > .2, kind); assert.equal(h.state.getValue(h.id('pattern')), CINEMA2_USER_MODEL_PREVIEWS[kind][0]); assert.equal(h.value('representation'), 'default') }
})
it('missing feature capability, silence and low-confidence signals never synthesize transients', () => {
  const h = harness(); h.enable(); h.enable('bass', 'dustImpulse', 2); for (let i = 0; i < 10; i++) h.frame({ featuresAvailable: false, event: 'kick', eventId: i, bass: 1 }); assert.equal(h.value('shardImpulse'), 0); assert.equal(h.value('dustImpulse'), 0); for (let i = 0; i < 10; i++) h.frame({ energy: 0, bass: 0 }); assert.equal(h.value('dustImpulse'), 0)
})

it('alternates the actual material target on canonical phrase boundaries without saving the override', () => {
  const h = harness(); h.edit('audioMappingsEnabled', true); h.edit('audioPhraseMaterial', 'neon'); h.frame(); h.frame({ event: 'phrase', eventId: 51 }); assert.equal(h.value('cinematicMaterial'), 'neon'); assert.equal(h.state.getValue(h.id('cinematicMaterial')), 'original'); h.frame({ event: 'phrase', eventId: 52 }); assert.equal(h.value('cinematicMaterial'), 'original')
})

it('persists a triggered destination and reassembles on a fresh canonical event without rewriting the authored mode', () => {
  const h = harness(); h.edit('audioTransitionTrigger', 'beat'); h.edit('audioTransitionDestination', 'dust'); h.edit('audioTransitionReturn', true)
  const saved = h.state.serialize(); h.edit('audioTransitionDestination', 'voxel'); assert.equal(h.state.restore(saved).ok, true)
  h.frame(); h.frame({ event: 'beat', eventId: 77 }); assert.equal(h.value('representation'), 'dust'); assert.equal(h.state.getValue(h.id('representation')), 'default')
  h.frame({ event: 'beat', eventId: 77 }, .2); assert.equal(h.value('representation'), 'dust')
  h.frame({ event: 'beat', eventId: 78 }, .2); assert.equal(h.value('representation'), 'default')
})

for (const kind of CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS) {
  it(`does not install the legacy audio mapping matrix for the registered ${kind} preview`, () => {
    const compiled = cinema2NativePresetRegistry.compile(createCinema2UserModelPreset(kind).id)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    assert.equal(compiled.plan.manifest.runtimeParameterConsumers, undefined)
    assert.ok(!compiled.plan.manifest.parameters?.some(p => String(p.id).includes('-audio-map')))
  })
}
