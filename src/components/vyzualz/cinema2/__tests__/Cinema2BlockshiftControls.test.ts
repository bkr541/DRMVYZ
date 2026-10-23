import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { createCinema2BlockshiftNativeModuleDefinition, type Cinema2BlockshiftModuleInstance } from '../modules/Cinema2BlockshiftNativeModule'
import { Cinema2ModuleResourceScope } from '../modules/Cinema2ModuleResources'
import { CINEMA2_BLOCKSHIFT_PATTERN_IDS } from '../modules/blockshift/Cinema2BlockshiftDomain'
import { buildCinema2BlockshiftLayout, cinema2BlockshiftHalfExtents } from '../modules/blockshift/Cinema2BlockshiftLayout'
import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST as manifest, CINEMA2_BLOCKSHIFT_PARAMETER_IDS as ids } from '../presets/Cinema2BlockshiftPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'

function compile() {
  const result = compileCinema2NativePreset(manifest)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return result.plan
}
const frame = (index: number, bpm = 120): Cinema2ModuleFrameReadContext => ({
  frameId: index + 1, timestampMs: index * 100, deltaTimeSec: 0.1, elapsedTimeSec: index * 0.1, contextGeneration: 1,
  viewport: { width: 960, height: 540, dpr: 1 }, audio: null, director: null,
  transport: { sourcePresent: true, playing: true, analysisActive: false, paused: false, animationActive: true, trackId: 'clock-fixture', timeSec: index * 0.1, bpmSync: false, bpm },
})
function fixture() {
  const values: Record<string, Cinema2JsonValue> = { ...manifest.modules![0]!.parameters }
  const renderer = { updateInstances: vi.fn(), draw: vi.fn(), dispose: vi.fn(), estimateGpuBytes: () => 8856 }
  const resources = new Cinema2ModuleResourceScope(createCinemaMockWebGL(), () => {})
  const unused = () => { throw new Error('Unused fixture facet') }
  const context: Cinema2ModuleCreateContext = {
    module: manifest.modules![0]!, resources,
    parameters: { get: name => values[name], getAuthored: () => { throw new Error('Must read resolved parameters') }, resolve: () => null },
    targets: { getTarget: () => null, resolve: unused, dispatch: unused }, media: { get: () => null, getSlot: () => null },
    randomness: { sample: unused, probability: unused, stream: unused, eventStream: unused },
  }
  const instance = createCinema2BlockshiftNativeModuleDefinition(() => renderer).create(context) as Cinema2BlockshiftModuleInstance
  const update = (input: Cinema2ModuleFrameReadContext) => instance.lifecycle.update({ frame: input, parameters: context.parameters, targets: context.targets })
  return { values, instance, renderer, update, resources }
}

describe('BLOCKSHIFT manual controls and basic timing', () => {
  it('declares four generic parents and exposes controls with native consumers', () => {
    const definitions = manifest.parameters ?? []
    expect(new Set(definitions.filter(p => p.exposure !== 'hidden').map(p => p.designParentGroup))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    for (const definition of definitions.filter(p => p.exposure !== 'hidden')) expect(['master-controls', 'design', 'effects', 'palette']).toContain(definition.designParentGroup)
    expect(definitions.find(p => p.id === ids.bloom)).toMatchObject({ exposure: 'primary', designParentGroup: 'effects', min: 0, max: 1, defaultValue: 0.3 })
    expect(definitions.find(p => p.id === ids.trigger)?.options).toBe(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(definitions.find(p => p.id === ids.patternChange)).toMatchObject({ type: 'boolean', defaultValue: false })
  })

  it('places camera controls in Master Controls, shows conditional sliders/Trigger, and preserves authored values', () => {
    const plan = compile(), state = new Cinema2ParameterState(plan.parameters)
    const visible = () => createCinema2DesignParentGroupModel(plan, state.getSnapshot()).flatMap(parent => [...parent.controls, ...parent.groups.flatMap(group => group.controls)]).map(control => control.definition.id)
    const master = () => createCinema2DesignParentGroupModel(plan, state.getSnapshot()).find(parent => parent.id === 'master-controls')!.controls
    expect(master().map(control => control.definition.id)).toEqual(expect.arrayContaining([ids.cameraMotion, ids.cameraFloatAmount]))
    expect(master().find(control => control.definition.id === ids.cameraFloatAmount)?.definition.label).toBe('Camera Motion Intensity')
    const motion = () => createCinema2DesignParentGroupModel(plan, state.getSnapshot()).find(parent => parent.id === 'design')!.groups.find(group => group.label === 'Motion')!.controls.map(control => control.definition.id)
    expect(motion()).toContain(ids.orbitCamera)
    expect(visible()).not.toContain(ids.orbitIntensity)
    state.setPersistentValue(ids.orbitCamera, true)
    state.setPersistentValue(ids.orbitIntensity, 0.75)
    expect(motion().slice(-2)).toEqual([ids.orbitCamera, ids.orbitIntensity])
    state.setPersistentValue(ids.cameraFloatAmount, 0.8)
    state.setPersistentValue(ids.cameraMotion, false)
    expect(master().map(control => control.definition.id)).toContain(ids.cameraMotion)
    expect(visible()).not.toContain(ids.cameraFloatAmount)
    expect(visible()).not.toContain(ids.orbitCamera)
    expect(visible()).not.toContain(ids.orbitIntensity)
    state.setPersistentValue(ids.cameraMotion, true)
    expect(master().map(control => control.definition.id)).toContain(ids.cameraFloatAmount)
    expect(state.getValue(ids.cameraFloatAmount)).toBe(0.8)
    expect(motion().slice(-2)).toEqual([ids.orbitCamera, ids.orbitIntensity])
    expect(visible()).not.toContain(ids.trigger)
    expect(state.setPersistentValue(ids.patternChange, true).ok).toBe(true)
    expect(visible()).toContain(ids.trigger)
    state.setPersistentValue(ids.trigger, 'phrase')
    state.setPersistentValue(ids.pattern, 'orbit')
    expect(state.getValue(ids.patternChange)).toBe(true)
    state.setPersistentValue(ids.patternChange, false)
    expect(visible()).not.toContain(ids.trigger)
    expect(state.getValue(ids.trigger)).toBe('phrase')
    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore(state.serialize()).ok).toBe(true)
    expect(restored.getValue(ids.pattern)).toBe('orbit')
    expect(restored.getValue(ids.trigger)).toBe('phrase')
    expect(restored.getValue(ids.orbitCamera)).toBe(true)
    expect(restored.getValue(ids.orbitIntensity)).toBe(0.75)
  })

  it('provides six distinct static manual formations with safe control extrema', () => {
    const silhouettes = new Set(CINEMA2_BLOCKSHIFT_PATTERN_IDS.map(pattern => JSON.stringify(buildCinema2BlockshiftLayout({ pattern }).map(block => block.position))))
    expect(silhouettes.size).toBe(6)
    for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const blockSize of [1.05, 1.35, 1.8, 3]) for (const spread of [0.5, 1, 1.8, 3]) for (const depth of [0, 0.45, 1]) {
      const blocks = buildCinema2BlockshiftLayout({ pattern, blockSize, spread, depth, rotationRange: 45 })
      const radius = Math.sqrt(3) * blockSize * 6 / 2
      for (const block of blocks) {
        expect(Math.hypot(...block.position) + radius).toBeLessThanOrEqual(300)
        expect(Math.hypot(...block.position) - radius).toBeGreaterThanOrEqual(2 - 1e-9)
        for (const other of blocks.slice(0, block.index)) expect(block.position.some((value, axis) => {
          const extent = (candidate: typeof block) => cinema2BlockshiftHalfExtents(candidate)[axis]!
          return Math.abs(value - other.position[axis]!) >= extent(block) + extent(other) + 1.5 - 1e-9
        })).toBe(true)
      }
    }
  })

  it('responds to every Spread interval at all block sizes and formations without changing model size', () => {
    for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const blockSize of [1.05, 1.35, 1.8, 3]) {
      let previous = -Infinity
      for (const spread of [0.5, 0.51, 1, 1.65, 1.8, 3]) {
        const blocks = buildCinema2BlockshiftLayout({ pattern, blockSize, spread })
        const extent = Math.max(...blocks.map(block => Math.hypot(...block.position)))
        expect(extent, `${pattern}, size ${blockSize}, spread ${spread}`).toBeGreaterThan(previous)
        expect(blocks.every(block => block.size === blockSize * 6)).toBe(true)
        previous = extent
      }
    }
  })

  it('moves the actual field around the viewer with the existing clock phase', () => {
    const first = buildCinema2BlockshiftLayout({ phase: 0 })
    const second = buildCinema2BlockshiftLayout({ phase: 0.25 })
    expect(first.map(block => block.position)).not.toEqual(second.map(block => block.position))
    expect(first.map(block => block.id)).toEqual(second.map(block => block.id))
    expect(manifest.parameters!.find(parameter => parameter.id === ids.blockSize)?.max).toBe(6)
    expect(manifest.parameters!.find(parameter => parameter.id === ids.spread)?.max).toBe(3)
  })

  it('reads changed resolved values without reading manifest defaults or mutating authored state', () => {
    const { values, instance, renderer, update } = fixture()
    values.pattern = 'orbit'; values.spread = 1.6; values.blockSize = 1.8
    update(frame(0))
    expect(instance.inspect().pattern).toBe('orbit')
    values.pattern = 'wave'; values.patternChange = true
    update(frame(1))
    expect(instance.inspect().pattern).toBe('wave')
    expect(values.patternChange).toBe(true)
    expect(renderer.dispose).not.toHaveBeenCalled()
  })

  it('uses real local BPM authority and rate, and freezes phase at zero motion and pause', () => {
    const advance = (bpm: number, sync: boolean, rate = 1) => {
      const f = fixture(); f.values.bpmSync = sync; f.values.motionRate = rate
      for (let i = 0; i <= 10; i++) f.update(frame(i, bpm))
      return f
    }
    const slow = advance(60, true), fast = advance(180, true), free = advance(180, false)
    expect(fast.instance.inspect().phase).toBeGreaterThan(slow.instance.inspect().phase * 2.5)
    expect(free.instance.inspect().phase).toBeCloseTo(advance(60, false).instance.inspect().phase)
    expect(advance(120, true, 2).instance.inspect().phase).toBeGreaterThan(advance(120, true).instance.inspect().phase * 1.9)
    const frozen = fast.instance.inspect().phase
    fast.values.motionAmount = 0
    fast.update(frame(11, 180)); fast.update(frame(12, 180))
    expect(fast.instance.inspect().phase).toBe(frozen)
    fast.values.motionAmount = 1
    const paused = frame(13, 180)
    fast.update({ ...paused, transport: { ...paused.transport!, paused: true, playing: false } })
    expect(fast.instance.inspect().phase).toBe(frozen)
  })

  it('keeps idle/no-source geometry still, including repeated render updates', () => {
    const f = fixture()
    for (let i = 0; i < 10; i++) f.update({ ...frame(i), transport: { ...frame(i).transport!, sourcePresent: false, playing: false } })
    expect(f.instance.inspect().phase).toBe(0)
    expect(f.instance.inspect().instanceCount).toBe(15)
  })
  it('holds manual selection through stale events and pause/resume, and resets on source/seek changes', () => {
    const f = fixture(); f.values.trigger = 'kick'; f.values.patternChange = true
    const eventFrame = (index: number, id: string) => ({ ...frame(index), audio: { discontinuity: { occurred: false }, rhythm: { bpm: { available: false }, beatIndex: { available: false }, beatPhase: { available: false }, kick: { id } } } as unknown as NonNullable<Cinema2ModuleFrameReadContext['audio']> })
    f.update(eventFrame(0, 'kick-0'))
    f.update(eventFrame(1, 'kick-1'))
    expect(f.instance.inspect().pattern).not.toBe('stagger')
    f.values.pattern = 'wave'
    f.update(eventFrame(2, 'kick-1')); f.update(eventFrame(3, 'kick-1'))
    expect(f.instance.inspect().pattern).toBe('wave'); expect(f.values.patternChange).toBe(true)
    const paused = eventFrame(4, 'kick-2')
    f.update({ ...paused, transport: { ...paused.transport!, playing: false, paused: true } })
    f.update(eventFrame(5, 'kick-2'))
    expect(f.instance.inspect().pattern).toBe('wave')
    f.update(eventFrame(6, 'kick-3'))
    expect(f.instance.inspect().pattern).not.toBe('wave')
    const changed = eventFrame(7, 'kick-4')
    f.update({ ...changed, transport: { ...changed.transport!, trackId: 'another-source', timeSec: 0 } })
    expect(f.instance.inspect()).toMatchObject({ phase: 0, pattern: 'wave', transitionProgress: 1 })
    const seek = eventFrame(8, 'kick-5')
    f.update({ ...seek, transport: { ...seek.transport!, trackId: 'another-source', timeSec: 9 } })
    expect(f.instance.inspect()).toMatchObject({ phase: 0, pattern: 'wave', transitionProgress: 1 })
  })

  it('runs manual transitions without a source, and freezes them on pause', () => {
    const f = fixture()
    const idle = (index: number) => ({ ...frame(index), deltaTimeSec: 0, transport: { ...frame(index).transport!, sourcePresent: false, playing: false } })
    f.update(idle(0)); f.values.pattern = 'orbit'; f.update(idle(1))
    expect(f.instance.inspect().transitionProgress).toBe(0)
    f.update(idle(2)); expect(f.instance.inspect().transitionProgress).toBeCloseTo(0.2)
    const paused = idle(3); f.update({ ...paused, transport: { ...paused.transport!, paused: true } })
    expect(f.instance.inspect().transitionProgress).toBeCloseTo(0.2)
    for (let index = 4; index <= 10; index++) f.update(idle(index))
    expect(f.instance.inspect().transitionProgress).toBe(1)
    expect(f.instance.inspect().phase).toBe(0)
  })

})
