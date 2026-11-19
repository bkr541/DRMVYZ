import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2AncientMachineNativeModule'
import { ANCIENT_MACHINE_CORE_MAX_RADIUS, ANCIENT_MACHINE_CORE_RADIUS, CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS, buildCinema2AncientMachineLayout, buildCinema2AncientMachineShaftDebris, packCinema2AncientMachineInstances } from '../modules/ancientMachine/Cinema2AncientMachineLayout'
import { Cinema2AncientMachineProgramController, createCinema2AncientMachineLookCycle } from '../modules/ancientMachine/Cinema2AncientMachineProgramController'
import { ANCIENT_MACHINE_ROCK_VARIANT_COUNT, buildCinema2AncientMachineRockGeometry } from '../modules/ancientMachine/Cinema2AncientMachineRockGeometry'
import { ANCIENT_MACHINE_COLLAR_CENTER_Z, ANCIENT_MACHINE_COLLAR_INNER_RADIUS, ANCIENT_MACHINE_SHAFT_VERTEX_BYTES, buildCinema2AncientMachineShaft } from '../modules/ancientMachine/Cinema2AncientMachineShaft'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, CINEMA2_ANCIENT_MACHINE_BUILD_CHARGE_ID, CINEMA2_ANCIENT_MACHINE_CAMERA_ID, CINEMA2_ANCIENT_MACHINE_DROP_IMPACT_ID, CINEMA2_ANCIENT_MACHINE_LOOK_ID, CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, CINEMA2_ANCIENT_MACHINE_PRESET_ID, CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, CINEMA2_ANCIENT_MACHINE_RHYTHM_RESPONSE_ID, CINEMA2_ANCIENT_MACHINE_ROCK_LIGHT_ID, CINEMA2_ANCIENT_MACHINE_TRIGGER_ID } from '../presets/Cinema2AncientMachinePreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { humMusicFrame } from './support/Cinema2HumNFrameFactory'

const CAPABILITIES = Object.freeze(['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] as const)
class FakeCanvas extends EventTarget {
  width = 640; height = 360; readonly getContext: ReturnType<typeof vi.fn>
  constructor(gl: WebGL2RenderingContext) { super(); this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) }
}

describe('Cinema 2.0 Ancient Machine preset', () => {
  it('builds deterministic mechanical layers that envelop the enlarged crystal in every direction', () => {
    const first = buildCinema2AncientMachineLayout(); const second = buildCinema2AncientMachineLayout()
    expect(first).toEqual(second); expect(first.instances).toHaveLength(444)
    expect(first.instances.filter(instance => instance.kind === 'tooth')).toHaveLength(36)
    expect(first.instances.filter(instance => instance.kind === 'glyph')).toHaveLength(72)
    expect(first.instances.filter(instance => instance.kind === 'plate')).toHaveLength(12)
    expect(ANCIENT_MACHINE_CORE_RADIUS).toBeCloseTo(.68 * 3)
    const octants = new Set<number>()
    for (const { center: [x, y, worldZ], kind } of first.instances) {
      const z = worldZ - ANCIENT_MACHINE_COLLAR_CENTER_Z
      const radius = Math.hypot(x, y, z)
      expect(radius).toBeGreaterThan(ANCIENT_MACHINE_CORE_MAX_RADIUS + .5)
      expect(radius).toBeLessThan(ANCIENT_MACHINE_COLLAR_INNER_RADIUS)
      if (kind === 'metal') octants.add(Number(x > 0) + 2 * Number(y > 0) + 4 * Number(z > 0))
    }
    expect(octants.size).toBe(8)
    expect(packCinema2AncientMachineInstances(first.instances)).toHaveLength(444 * CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
  })

  it('fills the shaft and the foreground throughout the inspection orbit', () => {
    const debris = buildCinema2AncientMachineShaftDebris()
    expect(debris).toEqual(buildCinema2AncientMachineShaftDebris())
    expect(debris.length).toBeGreaterThanOrEqual(27_000)
    for (const [min, max] of [[-31, -21], [-21, -10], [-10, 0], [0, 10], [10, 21], [21, 31]]) {
      expect(debris.filter(({ center: [, , z] }) => z >= min && z < max).length).toBeGreaterThan(3_500)
    }
    expect(debris.every(({ center: [x, y, z] }) => (
      Math.hypot(x, y) < 14 && Math.hypot(x, y, z - ANCIENT_MACHINE_COLLAR_CENTER_Z) >= 4.75
    ))).toBe(true)
    for (let degrees = -18; degrees < 342; degrees += 15) {
      const angle = degrees * Math.PI / 180
      const eye = [Math.sin(angle) * 12.48, 1.75, Math.cos(angle) * 12.48 - .4] as const
      const direction = [-eye[0], -eye[1], ANCIENT_MACHINE_COLLAR_CENTER_Z - eye[2]]
      const distance = Math.hypot(...direction)
      const foreground = debris.filter(({ center: [x, y, z] }) => {
        const offset = [x - eye[0], y - eye[1], z - eye[2]]
        const depth = (offset[0] * direction[0] + offset[1] * direction[1] + offset[2] * direction[2]) / distance
        const crossSection = offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2 - depth ** 2
        return depth > 2 && depth < distance - 4 && crossSection < (depth * .33) ** 2
      })
      expect(foreground.length, `foreground debris at ${degrees}°`).toBeGreaterThanOrEqual(10)
    }
  })

  it('ships all three legacy identities as authored looks and passes native gates', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_ANCIENT_MACHINE_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativePresetRegistry.get(CINEMA2_ANCIENT_MACHINE_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_ANCIENT_MACHINE_LOOK_ID)).toMatchObject({
      defaultValue: 'oracleLock', options: [{ value: 'oracleLock' }, { value: 'gearSun' }, { value: 'epochEngine' }],
    })
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.choreography?.rules.find(rule => rule.source.signal === 'continuous' && rule.source.path === 'audio.bands.bass')).toMatchObject({
      priority: 11,
      source: { smoothingMs: 90 },
      actions: [{ target: { property: 'bassPressure' } }],
    })
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok, compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  })

  it('provides Mainframe-equivalent Pattern Change and conditional Trigger controls', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error('Expected Ancient Machine to compile')
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID)).toMatchObject({ type: 'boolean', defaultValue: false })
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_ANCIENT_MACHINE_TRIGGER_ID)).toMatchObject({ type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, value: true }] })
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const labels = () => {
      const effects = createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).find(parent => parent.id === 'design')
      return [...(effects?.controls.map(control => control.definition.label) ?? []), ...(effects?.groups.flatMap(group => group.controls.map(control => control.definition.label)) ?? [])]
    }
    expect(labels()).not.toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, true)).toMatchObject({ ok: true })
    expect(labels()).toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_TRIGGER_ID, 'drop')).toMatchObject({ ok: true })
    const restored = new Cinema2ParameterState(compiled.plan.parameters); expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_ANCIENT_MACHINE_TRIGGER_ID)).toBe('drop')
  })

  it('cycles deterministically without repeats and returns authority when disabled', () => {
    const cycle = createCinema2AncientMachineLookCycle(index => [0.8, 0.2][index] ?? 0.5)
    const controller = new Cinema2AncientMachineProgramController(cycle)
    const base = { authoredLook: 'oracleLock' as const, patternChange: true, trigger: 'bar4' as const }
    expect(controller.update({ ...base, triggerEventId: 'bar:1' }).activeLook).toBe('oracleLock')
    const advanced = controller.update({ ...base, triggerEventId: 'bar:2' }); expect(advanced.activeLook).not.toBe('oracleLock')
    expect(controller.update({ ...base, triggerEventId: 'bar:2' }).changed).toBe(false)
    expect(controller.update({ ...base, patternChange: false, triggerEventId: 'bar:3' }).activeLook).toBe('oracleLock')
  })

  it('renders through the production registry, orbit camera, depth and four-pass graph', () => {
    const gl = createCinemaMockWebGL(); let scheduled: FrameRequestCallback | null = null
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, { presetId: CINEMA2_ANCIENT_MACHINE_PRESET_ID, requestAnimationFrame: vi.fn(callback => { scheduled = callback; return 1 }), cancelAnimationFrame: vi.fn(), renderQuality: 'high' })
    expect(created.error).toBeNull(); if (!created.runtime) throw new Error('Expected Ancient Machine runtime')
    expect(created.runtime.getCameraRuntimeSnapshot()).toMatchObject({ activeCameraId: CINEMA2_ANCIENT_MACHINE_CAMERA_ID })
    expect(created.runtime.getModuleRuntimeSnapshot().estimatedGpuBytes).toBeGreaterThan(0)
    created.runtime.resize({ width: 640, height: 360, dpr: 1 }); created.runtime.start(); (scheduled as FrameRequestCallback | null)?.(16)
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 4, failedPassCount: 0 })
    const shaft = buildCinema2AncientMachineShaft()
    expect(shaft.every(Number.isFinite)).toBe(true)
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, shaft.byteLength / ANCIENT_MACHINE_SHAFT_VERTEX_BYTES)
    const mechanism = buildCinema2AncientMachineLayout().instances
    const accentCount = mechanism.filter(({ kind }) => kind === 'glyph' || kind === 'internal-light').length
    const rockCount = mechanism.length - accentCount + buildCinema2AncientMachineShaftDebris().length
    expect(gl.drawElementsInstanced).toHaveBeenCalledWith(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, accentCount)
    const rockDraws = vi.mocked(gl.drawElementsInstanced).mock.calls.filter(([, indexCount]) => indexCount === 60)
    expect(rockDraws).toHaveLength(ANCIENT_MACHINE_ROCK_VARIANT_COUNT)
    expect(rockDraws.reduce((total, draw) => total + draw[4], 0)).toBe(rockCount)
    expect(rockDraws.every(draw => draw[4] > 0)).toBe(true)
    created.runtime.dispose()
  })

  it('lets manual stage and rock brightness coexist with live rhythm response', () => {
    const gl = createCinemaMockWebGL()
    gl.getUniformLocation = vi.fn((_program, name: string) => ({ name }) as unknown as WebGLUniformLocation)
    let scheduled: FrameRequestCallback | null = null
    let audio = humMusicFrame({ frameId: 1, timeSec: 10, energy: 0.8, trackId: 'ancient-machine-test' })
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => audio,
      getPublicationMeta: () => ({ sequence: audio.frameId, publishedAtMs: audio.timeSec * 1000, publisherId: 'ancient-machine-test', kind: 'frame' }),
    })
    const { runtime, error } = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_ANCIENT_MACHINE_PRESET_ID,
      audioIntelligenceBridge: bridge,
      transportSource: { getState: () => ({ sourcePresent: true, playing: true, analysisActive: true, paused: false, trackId: audio.trackId, timeSec: audio.timeSec }) },
      requestAnimationFrame: vi.fn(callback => { scheduled = callback; return 1 }),
      cancelAnimationFrame: vi.fn(),
    })
    if (!runtime) throw new Error(String(error))
    runtime.resize({ width: 640, height: 360, dpr: 1 })
    runtime.start()
    const frame = () => {
      audio = humMusicFrame({ frameId: audio.frameId + 1, timeSec: audio.timeSec + 0.05, energy: 0.8, trackId: 'ancient-machine-test' })
      scheduled?.(audio.timeSec * 1000)
    }
    const uniform = (name: string, method: 'uniform1f' | 'uniform1i' = 'uniform1f') =>
      vi.mocked(gl[method]).mock.calls.filter(([location]) => (location as { name?: string } | null)?.name === name).at(-1)?.[1]
    const state = runtime.getParameterState()
    state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, false)
    state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_ROCK_LIGHT_ID, 2.4)
    state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_BUILD_CHARGE_ID, 0.6)
    frame()
    expect(uniform('u_rockLightIntensity')).toBeCloseTo(2.4)
    expect(uniform('u_build')).toBeCloseTo(0.6)
    expect(uniform('u_look', 'uniform1i')).toBe(2)
    expect(uniform('u_energy')).toBe(0)
    state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_RHYTHM_RESPONSE_ID, true)
    state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_DROP_IMPACT_ID, 0.7)
    frame()
    expect(uniform('u_energy')).toBeGreaterThan(0)
    expect(uniform('u_drop')).toBeCloseTo(0.7)
    expect(uniform('u_look', 'uniform1i')).toBe(1)
    state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, true)
    frame()
    expect(uniform('u_build')).toBe(0)
    expect(uniform('u_drop')).toBe(0)
    expect(uniform('u_look', 'uniform1i')).toBe(0)
    runtime.dispose()
  })

  it('builds distinct rock silhouettes with outward-facing facets inside the original brick bounds', () => {
    const rocks = Array.from({ length: ANCIENT_MACHINE_ROCK_VARIANT_COUNT }, (_, variant) => buildCinema2AncientMachineRockGeometry(variant))
    expect(new Set(rocks.map(rock => rock.vertices.join(','))).size).toBe(rocks.length)
    for (const { vertices, indices } of rocks) {
      expect(indices).toHaveLength(60)
      expect(vertices.every(Number.isFinite)).toBe(true)
      for (let vertex = 0; vertex < vertices.length; vertex += 11) {
        const x = vertices[vertex]!, y = vertices[vertex + 1]!, z = vertices[vertex + 2]!
        const nx = vertices[vertex + 3]!, ny = vertices[vertex + 4]!, nz = vertices[vertex + 5]!
        expect(Math.max(Math.abs(x), Math.abs(y), Math.abs(z))).toBeLessThanOrEqual(.5)
        expect(x * nx + y * ny + z * nz).toBeGreaterThan(0)
      }
    }
  })
})
