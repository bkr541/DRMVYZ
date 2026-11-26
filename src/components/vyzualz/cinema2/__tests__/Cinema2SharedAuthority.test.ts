import { strict as assert } from 'node:assert'
import { describe, it } from 'vitest'
import { cinema2NamespacedId, cinema2Ref, cinema2StableId, CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, type Cinema2CameraId, type Cinema2CameraManifest, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from '../modules/mainframe/Cinema2MainframePatternController'
import { Cinema2SayItPatternController, CINEMA2_SAY_IT_PATTERN_IDS } from '../modules/sayIt/Cinema2SayItPatternController'
import { resolveCinema2AfterhoursTriggerEventIdentity } from '../modules/Cinema2AfterhoursNativeModule'
import { COLOSSUS_PATTERNS, colossusArmPose } from '../modules/colossus/ColossusGeometry'
import { HONEY_PATTERN_IDS } from '../modules/honey/Cinema2HoneyDomain'
import { buildHoneyLayout } from '../modules/honey/Cinema2HoneyLayout'
import { sampleHoneyPattern } from '../modules/honey/Cinema2HoneyPatterns'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import type { Cinema2MoodFrame } from '../conductor/Cinema2MoodConductor'

const id = (name: string) => cinema2StableId<Cinema2ParameterId>(name)
const cameraId = cinema2StableId<Cinema2CameraId>('authority-camera')
const enabled = id('motion-enabled'), kick = id('kick-zoom'), safety = id('motion-safety'), sync = id('bpm-sync')
const ref = (name: Cinema2ParameterId) => cinema2Ref(name)

function cameraFixture(overrides: Partial<Cinema2CameraManifest> = {}) {
  const manifest: Cinema2NativePresetManifest = {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.authority-test'), revision: 1, metadata: { name: 'Authority fixture' },
    parameters: [
      { id: enabled, label: 'Camera Motion', type: 'boolean', defaultValue: true },
      { id: kick, label: 'Kick Zoom', type: 'boolean', defaultValue: true },
      { id: sync, label: 'BPM Sync', type: 'boolean', defaultValue: true },
      { id: safety, label: 'Motion Safety', type: 'enum', defaultValue: 'full', options: ['full', 'reduced', 'lockoff'].map(value => ({ value, label: value })) },
    ],
    cameras: [{ id: cameraId, label: 'Fixture camera', projection: 'perspective', transform: { position: [0, 0, 10] }, target: [0, 0, 0], fovDegrees: 50,
      rig: { kind: 'static' }, motion: { tempo: { referenceBpm: 120, weave: 1, punch: 5 }, fovRateLimitDegreesPerSecond: 15 },
      controls: { motionEnabled: ref(enabled), kickZoom: ref(kick), motionSafety: ref(safety), tempoSync: ref(sync) }, ...overrides }],
    defaults: { camera: cinema2Ref(cameraId) },
  } as Cinema2NativePresetManifest
  const compiled = compileCinema2NativePreset(manifest)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: t => t.parameterId == null ? t.authoredBaseValue : state.getValue(t.parameterId) })
  const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
  return { state, camera: new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial) }
}

/** Deterministic transport and canonical beat/kick fixture; no independent musical detector. */
function frame(step: number, { track = 'track-a', paused = false, source = true, bpm = 120, time = step / 60 }: { track?: string; paused?: boolean; source?: boolean; bpm?: number; time?: number } = {}): Cinema2ModuleFrameReadContext {
  const beat = time * bpm / 60
  const signal = (value: number) => ({ available: true, value })
  return { frameId: step + 1, timestampMs: step * 1000 / 60, deltaTimeSec: 1 / 60, elapsedTimeSec: time, contextGeneration: 1,
    viewport: { width: 1280, height: 720, dpr: 1 }, transport: { sourcePresent: source, playing: source && !paused, paused, analysisActive: source, animationActive: source && !paused, trackId: source ? track : null, timeSec: time, bpm },
    audio: source ? { discontinuity: { occurred: false, reason: null, generation: 1 }, rhythm: { bpm: signal(bpm), beatIndex: signal(Math.floor(beat)), beatPhase: signal(beat % 1), kick: { id: `${track}:kick:${Math.floor(beat)}`, strength: 1 } } } : null,
    director: null } as unknown as Cinema2ModuleFrameReadContext
}
const pose = (f: ReturnType<Cinema2CameraRuntime['update']>) => [f.position, f.target, f.fovDegrees, f.rollDegrees]

describe('Cinema 2.0 shared authority', () => {
  it('Camera Motion OFF immediately restores the base lens even with Kick Zoom on', () => {
    const { camera, state } = cameraFixture()
    for (let i = 0; i < 60; i++) camera.update(frame(i))
    assert.ok(camera.getFrame().fovDegrees < 50)
    state.setPersistentValue(enabled, false)
    for (let i = 60; i < 120; i++) assert.deepEqual(pose(camera.update(frame(i))), [[0, 0, 10], [0, 0, 0], 50, 0])
    assert.equal(state.getValue(kick), true)
  })

  it('honors a hard stop and reduced travel for a centered orbit', () => {
    const sample = (mode: string, on = true) => {
      const { camera, state } = cameraFixture({ motion: { orbit: { center: [0, 0, 0], angularSpeedDegreesPerSecond: 45 }, tempo: { referenceBpm: 120 } } })
      state.setPersistentValue(safety, mode)
      state.setPersistentValue(enabled, on)
      for (let i = 0; i <= 60; i++) camera.update(frame(i))
      return camera.getFrame()
    }
    const full = sample('full'), reduced = sample('reduced')
    assert.ok(Math.abs(full.position[0]) > 5)
    assert.ok(Math.abs(reduced.position[0]) > 0.5 && Math.abs(reduced.position[0]) < Math.abs(full.position[0]) * 0.5)
    assert.deepEqual(pose(sample('lockoff')), [[0, 0, 10], [0, 0, 0], 50, 0])
    assert.deepEqual(pose(sample('full', false)), [[0, 0, 10], [0, 0, 0], 50, 0])
  })

  it('holds a manual base through an absent event and rejects a previously observed trigger after switching back', () => {
    const controller = new Cinema2MainframePatternController(['a', 'b', 'c', 'd', 'e', 'f'] as const, 'a')
    const base = { authoredPattern: 'a' as const, patternChange: true, trigger: 'beat' as const, absoluteBeat: 0 }
    controller.update({ ...base, triggerEventId: null })
    assert.equal(controller.update({ ...base, triggerEventId: 'beat-1', absoluteBeat: 1 }).activePattern, 'b')
    const manual = { ...base, authoredPattern: 'd' as const }
    assert.equal(controller.update({ ...manual, triggerEventId: null, absoluteBeat: 1 }).activePattern, 'd')
    assert.equal(controller.update({ ...manual, triggerEventId: 'beat-1', absoluteBeat: 1 }).activePattern, 'd')
    assert.equal(controller.update({ ...manual, trigger: 'drop', triggerEventId: 'drop-1' }).activePattern, 'd')
    assert.equal(controller.update({ ...manual, triggerEventId: null }).activePattern, 'd')
    assert.equal(controller.update({ ...manual, triggerEventId: 'beat-1' }).activePattern, 'd')
    assert.equal(controller.update({ ...manual, triggerEventId: 'beat-2', absoluteBeat: 2 }).activePattern, 'e')
  })

  it('prevents the same replay in the typography controller used by Livewire', () => {
    const controller = new Cinema2SayItPatternController(CINEMA2_SAY_IT_PATTERN_IDS)
    const base = { authoredPattern: 'solid' as const, patternChange: true, trigger: 'beat' as const, absoluteBeat: 0 }
    controller.update({ ...base, triggerEventId: null })
    assert.equal(controller.update({ ...base, triggerEventId: 'beat-1' }).activePattern, 'pulse')
    const manual = { ...base, authoredPattern: 'alternate' as const }
    assert.equal(controller.update({ ...manual, triggerEventId: null }).activePattern, 'alternate')
    assert.equal(controller.update({ ...manual, triggerEventId: 'beat-1' }).activePattern, 'alternate')
  })

  it('keeps disabled motion fixed through pause, seek, no-track and two track replacements', () => {
    const { camera, state } = cameraFixture({ smoothingMs: 150 })
    for (let i = 0; i < 60; i++) camera.update(frame(i))
    state.setPersistentValue(enabled, false)
    const base = [[0, 0, 10], [0, 0, 0], 50, 0]
    assert.deepEqual(pose(camera.update(frame(60, { paused: true }))), base)
    assert.deepEqual(pose(camera.update(frame(61, { time: 20 }))), base)
    assert.deepEqual(pose(camera.update(frame(62, { source: false }))), base)
    assert.deepEqual(pose(camera.update(frame(63, { track: 'track-b', bpm: 150, time: 0 }))), base)
    assert.deepEqual(pose(camera.update(frame(64, { track: 'track-c', bpm: 100, time: 0 }))), base)
    state.setPersistentValue(enabled, true)
    const resumed = camera.update(frame(65, { track: 'track-c', bpm: 100, time: 1 / 60 }))
    assert.equal(resumed.fovDegrees, 50, 'held kick observed while disabled must not replay')
    state.setPersistentValue(sync, false)
    for (let i = 66; i < 180; i++) camera.update(frame(i, { track: 'track-c', bpm: 100, time: (i - 64) / 60 }))
    assert.ok(Math.abs(camera.getFrame().position[0]) > 0.01)
  })

  it('keeps the last trigger across same-value reselection and permits new identities after source reset', () => {
    const controller = new Cinema2MainframePatternController(['a', 'b', 'c'] as const, 'a')
    const base = { authoredPattern: 'a' as const, patternChange: true, trigger: 'drop' as const, absoluteBeat: 0 }
    controller.update({ ...base, triggerEventId: null })
    assert.equal(controller.update({ ...base, triggerEventId: 'drop-1' }).activePattern, 'b')
    assert.equal(controller.update({ ...base, triggerEventId: null, reselect: true }).activePattern, 'a')
    assert.equal(controller.update({ ...base, triggerEventId: 'drop-1' }).activePattern, 'a')
    assert.equal(controller.update({ ...base, triggerEventId: 'drop-2' }).activePattern, 'b')
    controller.reset()
    controller.update({ ...base, triggerEventId: null })
    assert.equal(controller.update({ ...base, triggerEventId: 'drop-1' }).activePattern, 'b')
  })

  it('routes published phrase and two drop boundaries without inventing or replaying a crossing', () => {
    const structural = (time: number) => ({ ...frame(1), audio: {
      upstream: { timeSec: time }, rhythm: { fixedClocks: { 16: { boundary: null } } },
      structure: { analyzedPhrases: { available: true, value: [{ id: 'phrase-1', timeSec: 8 }] }, semanticMoments: { available: true, value: [{ id: 'drop-1', type: 'drop', timeSec: 16 }, { id: 'drop-2', type: 'drop', timeSec: 32 }] } },
    } }) as unknown as Cinema2ModuleFrameReadContext
    assert.equal(resolveCinema2AfterhoursTriggerEventIdentity(structural(8), 'phrase', 7.9), 'phrase-1')
    assert.equal(resolveCinema2AfterhoursTriggerEventIdentity(structural(16), 'drop', 15.9), 'drop-1')
    assert.equal(resolveCinema2AfterhoursTriggerEventIdentity(structural(16), 'drop', 16), null)
    assert.equal(resolveCinema2AfterhoursTriggerEventIdentity(structural(32), 'drop', 31.9), 'drop-2')
    assert.equal(resolveCinema2AfterhoursTriggerEventIdentity(structural(32), 'drop', null), null)
  })

  it('preserves genuinely distinct native Colossus and Honey pattern samples', () => {
    const colossus = COLOSSUS_PATTERNS.map(({ value: pattern }) => JSON.stringify([0, 1, 2, 3].map(i => colossusArmPose(i, { pattern, phase: 2.3, routePhase: .2, reach: .5, articulation: .5, piston: .4, jaw: .4, release: 0, kick: 0, snare: 0, bass: 0, mid: 0, build: 0, vocal: 0, safety: 1 }))))
    assert.ok(new Set(colossus).size >= 6)
    const cells = buildHoneyLayout().slice(0, 20)
    const honey = HONEY_PATTERN_IDS.map(pattern => JSON.stringify(cells.map(cell => sampleHoneyPattern(pattern, cell, 2.3))))
    assert.ok(new Set(honey).size >= 6)
  })

  it('uses effective Auto controls without mutating saved Pattern Change or Trigger', () => {
    const resolver = new Cinema2PatternControlResolver()
    const saved = Object.freeze({ patternChange: true, trigger: 'drop' })
    const mood = { pattern: { patternChange: true, trigger: 'bar4' } } as Cinema2MoodFrame
    assert.deepEqual(resolver.update({ saved, mood, autoPerformance: true }), { patternChange: true, trigger: 'bar4', automatic: true })
    assert.deepEqual(resolver.update({ saved, mood, autoPerformance: false }), { ...saved, automatic: false })
    assert.deepEqual(resolver.update({ saved, mood: null, autoPerformance: true }), { ...saved, automatic: false })
  })
})
